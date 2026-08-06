/**
 * L'appariement : émettre une invitation, l'accepter, et obtenir un tandem.
 *
 * C'est le geste fondateur du produit, et il ne pouvait pas aboutir. Aucune des
 * sept premières migrations n'accorde `insert` sur `public.tandems` — le seul
 * grant est `select, update` (migration `…_000002`, ligne 178). La migration
 * `…_000004` ayant passé `accept_tandem_invitation` en `security invoker`, la
 * fonction s'exécute avec les droits de l'appelant et se heurte à
 * `42501 permission denied for table tandems`. La politique
 * `tandems_insert_member`, créée par cette même migration, ne pouvait rien y
 * faire : une politique RLS ne donne aucun droit, elle restreint un droit qui
 * doit exister par ailleurs.
 *
 * `20260806143500_appariement_possible` accorde ce droit, et le referme aussitôt
 * par la politique : on ne crée un tandem que là où l'on figure, et seulement
 * avec quelqu'un dont on détient une invitation vivante.
 *
 * Comme partout dans cette suite, chaque test négatif s'appuie sur un témoin
 * positif : si le témoin tombe, c'est le harnais qui a lâché, pas la politique.
 * Et l'on mesure des faits — un identifiant rendu, une ligne présente, un statut
 * changé — jamais la seule absence d'erreur.
 */
import { describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

type Decor = { inviteur: Utilisateur; invitee: Utilisateur; token: string }

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Deux comptes et une invitation en attente, posés hors transaction.
 *
 * `commeService` n'ouvre pas de transaction : le décor survit donc à la
 * transaction — annulée en sortant — dans laquelle l'invitée acceptera. C'est
 * la condition pour que l'acceptation voie l'invitation.
 */
const monterInvitation = async (options: {
  expiration?: string
  statut?: string
  emailInvitee?: 'invitee' | 'inviteur'
} = {}): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const inviteur = await creerUtilisateur(client, `inviteur-${suffixe}@test.local`)
    const invitee = await creerUtilisateur(client, `invitee-${suffixe}@test.local`)
    const destinataire = options.emailInvitee === 'inviteur' ? inviteur.email : invitee.email

    const { rows } = await client.query<{ token: string }>(
      `insert into public.tandem_invitations (inviter_id, invitee_email, status, expires_at)
       values ($1, $2, $3, timezone('utc', now()) + $4::interval)
       returning token`,
      [inviteur.id, destinataire, options.statut ?? 'pending', options.expiration ?? '7 days'],
    )
    return { inviteur, invitee, token: rows[0].token }
  })
}

/** Appelle la RPC sous l'identité donnée, et rend l'identifiant du tandem. */
const accepter = (qui: Utilisateur, token: string) =>
  commeUtilisateur(qui, async (client) => {
    const { rows } = await client.query<{ id: string | null }>(
      'select public.accept_tandem_invitation($1)::text as id',
      [token],
    )
    return rows[0].id
  })

describe('accepter une invitation', () => {
  it('TÉMOIN — l’invitée voit bien l’invitation qui lui est adressée', async () => {
    // Sans ce témoin, un échec de l'acceptation pourrait tenir au décor plutôt
    // qu'aux droits : invitation absente, e-mail des claims mal posé, harnais
    // qui rollback trop tôt. Ici on vérifie que la lecture, elle, passe.
    const { invitee, token } = await monterInvitation()

    const vu = await commeUtilisateur(invitee, async (client) => {
      const { rows } = await client.query<{ status: string }>(
        'select status from public.tandem_invitations where token = $1',
        [token],
      )
      return rows
    })

    expect(vu).toEqual([{ status: 'pending' }])
  })

  it('l’invitée accepte, et le tandem existe', async () => {
    // Trois faits, pas un seul : un identifiant rendu, une ligne active qui
    // réunit les deux personnes, et l'invitation consommée. Un retour NULL
    // silencieux — le mode de défaillance de `on conflict do nothing` — serait
    // vert si l'on se contentait de « ça n'a pas planté ».
    const { inviteur, invitee, token } = await monterInvitation()

    const resultat = await commeUtilisateur(invitee, async (client) => {
      const { rows: rpc } = await client.query<{ id: string | null }>(
        'select public.accept_tandem_invitation($1)::text as id',
        [token],
      )
      const tandemId = rpc[0].id

      const { rows: tandem } = await client.query<{ status: string; a: string; b: string }>(
        'select status, participant_a_id::text as a, participant_b_id::text as b from public.tandems where id = $1',
        [tandemId],
      )
      const { rows: invitation } = await client.query<{ status: string; accepted_by: string | null }>(
        'select status, accepted_by::text from public.tandem_invitations where token = $1',
        [token],
      )

      return { tandemId, tandem: tandem[0], invitation: invitation[0] }
    })

    expect(resultat.tandemId).toEqual(expect.any(String))
    expect(resultat.tandem).toEqual({ status: 'active', a: inviteur.id, b: invitee.id })
    expect(resultat.invitation).toEqual({ status: 'accepted', accepted_by: invitee.id })
  })

  it('un tiers ne peut pas consommer le code d’une autre', async () => {
    // Mesuré : le refus remonte `invitation_not_found`, pas
    // `invitation_email_mismatch` comme le laisserait croire la lecture de la
    // fonction. Depuis son passage en `security invoker` (`…_000004`), son
    // `select … for update` est soumis à `invitations_select_participant` : le
    // tiers ne voit tout simplement pas la ligne, et la garde d'e-mail placée
    // juste après n'est jamais atteinte pour lui. Elle ne sert plus qu'à
    // l'inviteur qui tenterait un code adressé à quelqu'un d'autre. Le refus est
    // réel et pour la bonne raison — c'est la RLS qui l'a produit — mais le
    // message n'est pas celui qu'on attendrait.
    const { token } = await monterInvitation()
    const curieux = await commeService((client) => creerUtilisateur(client, `curieux-${marque()}@test.local`))

    await expect(accepter(curieux, token)).rejects.toThrow(/invitation_not_found/)
  })

  it('… et c’est bien la RLS qui le lui cache', async () => {
    // Le complément du test précédent : sans lui, « not found » resterait
    // ambigu — code inconnu ou ligne masquée ? Le témoin du haut de ce fichier
    // dit que la destinataire, elle, voit la même invitation.
    const { token } = await monterInvitation()
    const curieux = await commeService((client) => creerUtilisateur(client, `curieux-${marque()}@test.local`))

    const vu = await commeUtilisateur(curieux, async (client) => {
      const { rowCount } = await client.query('select 1 from public.tandem_invitations where token = $1', [token])
      return rowCount
    })

    expect(vu).toBe(0)
  })

  it('l’inviteur ne s’apparie pas avec lui-même', async () => {
    // Invitation adressée à sa propre adresse : l'e-mail concorde, seule la
    // garde d'auto-acceptation reste entre lui et un tandem à un participant.
    const { inviteur, token } = await monterInvitation({ emailInvitee: 'inviteur' })

    await expect(accepter(inviteur, token)).rejects.toThrow(/invitation_self_acceptance/)
  })

  it('un code périmé n’ouvre rien', async () => {
    const { invitee, token } = await monterInvitation({ expiration: '-1 day' })

    await expect(accepter(invitee, token)).rejects.toThrow(/invitation_not_found/)
  })

  it('un code déjà consommé n’ouvre rien une seconde fois', async () => {
    // Montage volontairement différent du test précédent : ici l'invitation est
    // valide dans le temps mais son statut n'est plus `pending`. Les deux cas
    // remontent le même message — les deux prédicats vivent dans le même
    // `select … for update` — mais ils ne testent pas la même chose.
    const { invitee, token } = await monterInvitation({ statut: 'accepted' })

    await expect(accepter(invitee, token)).rejects.toThrow(/invitation_not_found/)
  })
})

describe('se ré-apparier autour d’un blocage', () => {
  /**
   * Tant que l'insertion était impossible, ce contournement était hors
   * d'atteinte. Réparer l'appariement le rend atteignable : l'index
   * `tandems_active_pair_idx` ne couvre que les statuts `active` et `paused`,
   * une paire dont le tandem est `blocked` n'occupe donc aucune place et un
   * second tandem pourrait naître à côté du premier.
   */
  const monterPaireBloquee = async () => {
    const suffixe = marque()
    return commeService(async (client) => {
      const claire = await creerUtilisateur(client, `claire-${suffixe}@test.local`)
      const indesirable = await creerUtilisateur(client, `indesirable-${suffixe}@test.local`)

      await client.query(
        "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $1)",
        [claire.id, indesirable.id],
      )

      // Le contournement réaliste : la personne bloquée relance par une
      // nouvelle invitation, que la personne qui a bloqué accepte.
      const { rows } = await client.query<{ token: string }>(
        'insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2) returning token',
        [indesirable.id, claire.email],
      )
      return { claire, indesirable, token: rows[0].token }
    })
  }

  it('TÉMOIN — sans blocage, la même invitation aboutit', async () => {
    const { invitee, token } = await monterInvitation()
    await expect(accepter(invitee, token)).resolves.toEqual(expect.any(String))
  })

  it('la paire bloquée ne peut pas repartir sur un tandem neuf', async () => {
    // Interdit même à celle qui a bloqué : le chemin sanctionné pour revenir en
    // arrière est de lever le blocage sur la ligne existante, geste tracé et
    // réservé à `blocked_by`. Recréer un tandem à côté effacerait cette trace.
    const { claire, token } = await monterPaireBloquee()

    await expect(accepter(claire, token)).rejects.toThrow(/row-level security/i)
  })

  it('le blocage tient aussi contre une insertion directe', async () => {
    // Sans passer par la RPC : la politique doit tenir seule, c'est elle le
    // rempart si un client parle à PostgREST en direct.
    const { claire, indesirable } = await monterPaireBloquee()

    await expect(
      commeUtilisateur(claire, (client) =>
        client.query('insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2)', [
          claire.id,
          indesirable.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('créer un tandem en direct, sans la RPC', () => {
  // Le `grant insert` ouvre la table à PostgREST : n'importe quel client
  // authentifié peut tenter l'insertion sans passer par
  // `accept_tandem_invitation`. C'est la politique, et elle seule, qui décide.

  it('TÉMOIN — avec une invitation vivante, l’insertion directe passe', async () => {
    // Ce témoin dit que la politique n'est pas un simple « non » : le chemin
    // légitime reste ouvert. Les tests suivants mesurent donc une
    // discrimination, pas une porte murée.
    const { inviteur, invitee } = await monterInvitation()

    const cree = await commeUtilisateur(invitee, async (client) => {
      const { rowCount } = await client.query(
        'insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2)',
        [inviteur.id, invitee.id],
      )
      return rowCount
    })

    expect(cree).toBe(1)
  })

  it('GARDE — on ne s’apparie pas à quelqu’un qui ne nous a pas invité', async () => {
    // Le cœur du risque ouvert par le grant : sur un produit qui met en
    // relation des mineurs et des mentors adultes, un appariement unilatéral
    // serait une porte d'entrée. Ici, aucune invitation n'existe entre les deux.
    const suffixe = marque()
    const [entreprenant, cible] = await commeService(async (client) => [
      await creerUtilisateur(client, `entreprenant-${suffixe}@test.local`),
      await creerUtilisateur(client, `cible-${suffixe}@test.local`),
    ])

    await expect(
      commeUtilisateur(entreprenant, (client) =>
        client.query('insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2)', [
          entreprenant.id,
          cible.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('GARDE — on ne crée pas un tandem où l’on ne figure pas', async () => {
    // Même avec une invitation valide entre deux tiers : le spectateur n'est
    // pas dans la ligne, la politique le refuse.
    const { inviteur, invitee } = await monterInvitation()
    const spectateur = await commeService((client) => creerUtilisateur(client, `spectateur-${marque()}@test.local`))

    await expect(
      commeUtilisateur(spectateur, (client) =>
        client.query('insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2)', [
          inviteur.id,
          invitee.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('GARDE — une invitation périmée n’autorise plus l’insertion directe', async () => {
    // La RPC refuse déjà le code périmé ; la politique doit le refuser aussi,
    // sinon le grant rendrait la péremption contournable en une requête.
    const { inviteur, invitee } = await monterInvitation({ expiration: '-1 day' })

    await expect(
      commeUtilisateur(invitee, (client) =>
        client.query('insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2)', [
          inviteur.id,
          invitee.id,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})
