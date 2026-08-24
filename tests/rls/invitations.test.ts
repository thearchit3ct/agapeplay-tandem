/**
 * Ce que l'écran des invitations demande à la base, et rien d'autre.
 *
 * `invitation-bloquee.test.ts` couvre l'**émission** — qui a le droit d'envoyer
 * une invitation, et à qui. Ce fichier couvre ce qui vient après : qui la
 * **voit**, qui peut la **reprendre**, et sur quoi l'interface s'appuie pour
 * décider d'afficher un bouton ou une phrase.
 *
 * Trois affirmations de `apps/web/src/invitations.ts` sont éprouvées ici, parce
 * que l'écran serait faux si l'une d'elles cédait :
 *
 * 1. Une lecture sans filtre rend exactement les invitations émises par
 *    l'appelant et celles qui visent son adresse — c'est
 *    `invitations_select_participant` qui trie, pas le client.
 * 2. Une révocation refusée par le `using` **ne lève pas** : elle touche zéro
 *    ligne. D'où le `.select()` de retour, sans lequel l'écran annoncerait une
 *    annulation qui n'a pas eu lieu.
 * 3. `tandem_contact_bloque` et `tandem_paire_bloquee` répondent vrai sur les
 *    paires bloquées de l'appelant — ce sont elles qui décident du bouton
 *    d'annulation et du masquage des invitations reçues.
 *
 * S'y ajoute la règle qui a fait naître `etatInvitation` : **rien ne fait
 * passer une invitation périmée à `expired`**. Le dernier test le montre sur la
 * base réelle, faute de quoi la règle de domaine serait une précaution contre
 * un danger imaginaire.
 *
 * Comme partout dans cette suite, chaque test négatif s'appuie sur un témoin
 * positif : si le témoin tombe, c'est le harnais qui a lâché, pas la politique.
 *
 * ---------------------------------------------------------------------------
 * Ce que la vérification par mutation a appris
 * ---------------------------------------------------------------------------
 *
 * Premier essai : `invitations_update_participant` relâchée en `using (true)`.
 * **Aucun test n'a rougi.** Plutôt que d'en conclure que le `using` était
 * décoratif, la cause a été cherchée — et elle vaut d'être écrite.
 *
 * Un tiers est arrêté par **deux barrières indépendantes**. PostgreSQL applique
 * aussi les politiques SELECT à un UPDATE dès que celui-ci lit des colonnes
 * (`where`, `returning`) : `invitations_select_participant` filtre donc la
 * ligne avant même que le `using` de la politique UPDATE soit consulté. Il a
 * fallu relâcher les deux pour faire rougir « un tiers échoue en silence » —
 * et « un tiers n'en voit aucune trace » avec lui, les neuf autres restant
 * verts.
 *
 * Le message d'erreur alors obtenu est le second enseignement :
 *
 *     error: new row violates row-level security policy for table "tandem_invitations"
 *
 * Autrement dit, **c'est la politique SELECT qui rend le refus silencieux**. Si
 * le `using` portait seul, le tiers atteindrait le `with check`, qui lève. Un
 * client qui ne lirait que `error` serait donc correct aujourd'hui par accident
 * et faux demain, au premier resserrement de la politique de lecture — raison
 * de plus pour que `revoquerInvitation` lise la ligne revenue au lieu de se
 * fier à l'absence d'erreur.
 */
import { describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

type Decor = { inviteur: Utilisateur; destinataire: Utilisateur; invitationId: string }

/**
 * Une invitation vivante, d'un inviteur vers un destinataire.
 *
 * Posée hors transaction (`commeService` n'en ouvre pas) : elle survit donc aux
 * transactions annulées dans lesquelles les tests liront et écriront.
 */
const monterInvitation = async (bloquee = false): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const inviteur = await creerUtilisateur(client, `inviteur-${suffixe}@test.local`)
    const destinataire = await creerUtilisateur(client, `destinataire-${suffixe}@test.local`)

    const { rows } = await client.query<{ id: string }>(
      'insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2) returning id::text',
      [inviteur.id, destinataire.email],
    )

    // Le blocage est posé *après* l'invitation : c'est l'ordre exact de l'écart
    // décrit au doc 21 — « une invitation antérieure à un blocage ».
    if (bloquee) {
      await client.query(
        "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $2)",
        [inviteur.id, destinataire.id],
      )
    }
    return { inviteur, destinataire, invitationId: rows[0].id }
  })
}

const invitationsVues = (qui: Utilisateur) =>
  commeUtilisateur(qui, async (client) => {
    const { rows } = await client.query<{ id: string; inviter_id: string }>(
      'select id::text, inviter_id::text from public.tandem_invitations',
    )
    return rows
  })

describe('voir ses invitations', () => {
  it('TÉMOIN — l’inviteur voit celle qu’il a émise', async () => {
    // Le témoin de tout ce fichier : la lecture sans filtre rend bien quelque
    // chose, donc les listes vides ci-dessous mesurent une discrimination et
    // non une table muette.
    const { inviteur, invitationId } = await monterInvitation()

    expect(await invitationsVues(inviteur)).toContainEqual({ id: invitationId, inviter_id: inviteur.id })
  })

  it('le destinataire voit l’invitation qui vise son adresse', async () => {
    // La seconde branche d'`invitations_select_participant`, celle par e-mail.
    // C'est elle qui alimente la liste « Reçues » de l'écran.
    const { inviteur, destinataire, invitationId } = await monterInvitation()

    expect(await invitationsVues(destinataire)).toContainEqual({ id: invitationId, inviter_id: inviteur.id })
  })

  it('un tiers n’en voit aucune trace', async () => {
    // Ce qui autorise l'écran à lire sans `.or(...)` : la politique trie déjà.
    // Si elle cédait, un client sans filtre publierait les invitations de tout
    // le monde.
    const { invitationId } = await monterInvitation()
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-${marque()}@test.local`))

    expect((await invitationsVues(tiers)).map((ligne) => ligne.id)).not.toContain(invitationId)
  })
})

describe('reprendre une invitation', () => {
  const revoquer = (qui: Utilisateur, invitationId: string) =>
    commeUtilisateur(qui, async (client) => {
      const { rowCount, rows } = await client.query<{ status: string }>(
        "update public.tandem_invitations set status = 'revoked' where id = $1 returning status",
        [invitationId],
      )
      return { rowCount, statut: rows[0]?.status ?? null }
    })

  it('TÉMOIN — l’inviteur reprend la sienne', async () => {
    // Le chemin d'écriture que l'écran emprunte, et la raison pour laquelle ce
    // chantier n'a demandé aucune migration : le droit et la politique
    // existaient déjà.
    const { inviteur, invitationId } = await monterInvitation()

    expect(await revoquer(inviteur, invitationId)).toEqual({ rowCount: 1, statut: 'revoked' })
  })

  it('un tiers échoue en silence, sans lever', async () => {
    // Le piège que le `.select()` de `revoquerInvitation` couvre : le `using`
    // d'`invitations_update_participant` ne reconnaît pas le tiers, l'UPDATE
    // touche zéro ligne, et PostgREST rendrait `error: null`. Un écran qui ne
    // lirait que l'erreur féliciterait pour une annulation jamais faite.
    const { invitationId } = await monterInvitation()
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-${marque()}@test.local`))

    expect(await revoquer(tiers, invitationId)).toEqual({ rowCount: 0, statut: null })
  })

  it('ÉCART ASSUMÉ — sur une paire bloquée, l’inviteur ne peut plus reprendre', async () => {
    // Doc 21, « Écarts connus et assumés ». Le `with check` appelle
    // `not tandem_contact_bloque(invitee_email)` et la nouvelle ligne porte
    // toujours l'adresse bloquée : le refus **lève**. L'écran ne le répare pas,
    // il l'affiche — le chemin de retour sanctionné reste de lever le blocage.
    const { inviteur, invitationId } = await monterInvitation(true)

    await expect(revoquer(inviteur, invitationId)).rejects.toThrow(/row-level security/i)
  })
})

describe('ce sur quoi l’écran décide d’afficher un bouton', () => {
  it('tandem_contact_bloque reconnaît l’adresse d’une paire bloquée', async () => {
    // La fondation de `revocationInvitation(etat, contactBloque)` du côté des
    // invitations émises : sans ce « vrai », l'écran proposerait un bouton dont
    // le test précédent montre qu'il lèverait.
    const { inviteur, destinataire } = await monterInvitation(true)

    const reponse = await commeUtilisateur(inviteur, async (client) => {
      const { rows } = await client.query<{ r: boolean }>('select public.tandem_contact_bloque($1) as r', [destinataire.email])
      return rows[0].r
    })

    expect(reponse).toBe(true)
  })

  it('TÉMOIN — et laisse passer une adresse sans blocage', async () => {
    // Le complément indispensable : sans lui, une fonction qui rendrait `true`
    // en toute circonstance passerait le test précédent, et l'écran
    // n'afficherait plus jamais de bouton d'annulation.
    const { inviteur, destinataire } = await monterInvitation()

    const reponse = await commeUtilisateur(inviteur, async (client) => {
      const { rows } = await client.query<{ r: boolean }>('select public.tandem_contact_bloque($1) as r', [destinataire.email])
      return rows[0].r
    })

    expect(reponse).toBe(false)
  })

  it('tandem_paire_bloquee reconnaît un inviteur bloqué, et lui seul', async () => {
    // La fondation du masquage des invitations reçues. Une invitation ne porte
    // que l'uuid de son émetteur, jamais son adresse — d'où cette fonction-ci
    // plutôt que la précédente. Les deux assertions vont ensemble : un `true`
    // constant masquerait toutes les invitations reçues du produit.
    const { inviteur, destinataire } = await monterInvitation(true)
    const ordinaire = await commeService((client) => creerUtilisateur(client, `ordinaire-${marque()}@test.local`))

    const reponses = await commeUtilisateur(destinataire, async (client) => {
      const { rows } = await client.query<{ bloque: boolean; libre: boolean }>(
        'select public.tandem_paire_bloquee($1, $2) as bloque, public.tandem_paire_bloquee($1, $3) as libre',
        [destinataire.id, inviteur.id, ordinaire.id],
      )
      return rows[0]
    })

    expect(reponses).toEqual({ bloque: true, libre: false })
  })
})

describe('la péremption', () => {
  it('ne change jamais le statut : « pending » survit à sa date', async () => {
    // La raison d'être d'`etatInvitation`. Aucun trigger, aucun cron ne fait
    // passer `status` à `expired` : `expires_at` est le seul juge. Un écran qui
    // lirait le statut afficherait « en attente de réponse » indéfiniment.
    const suffixe = marque()
    const { inviteur, invitationId } = await commeService(async (client) => {
      const inviteur = await creerUtilisateur(client, `inviteur-${suffixe}@test.local`)
      const { rows } = await client.query<{ id: string }>(
        `insert into public.tandem_invitations (inviter_id, invitee_email, expires_at)
         values ($1, $2, timezone('utc', now()) - interval '1 day') returning id::text`,
        [inviteur.id, `perime-${suffixe}@test.local`],
      )
      return { inviteur, invitationId: rows[0].id }
    })

    const ligne = await commeUtilisateur(inviteur, async (client) => {
      const { rows } = await client.query<{ status: string; perimee: boolean }>(
        "select status, expires_at <= timezone('utc', now()) as perimee from public.tandem_invitations where id = $1",
        [invitationId],
      )
      return rows[0]
    })

    expect(ligne).toEqual({ status: 'pending', perimee: true })
  })

  it('mais la rend inacceptable : la base, elle, lit bien la date', async () => {
    // L'autre moitié de la même règle. Si `accept_tandem_invitation` ignorait
    // `expires_at`, la péremption ne serait qu'un affichage — et l'écran
    // mentirait dans l'autre sens en déclarant morte une invitation vivante.
    const suffixe = marque()
    const { destinataire, jeton } = await commeService(async (client) => {
      const inviteur = await creerUtilisateur(client, `inviteur-${suffixe}@test.local`)
      const destinataire = await creerUtilisateur(client, `destinataire-${suffixe}@test.local`)
      const { rows } = await client.query<{ token: string }>(
        `insert into public.tandem_invitations (inviter_id, invitee_email, expires_at)
         values ($1, $2, timezone('utc', now()) - interval '1 day') returning token`,
        [inviteur.id, destinataire.email],
      )
      return { destinataire, jeton: rows[0].token }
    })

    await expect(
      commeUtilisateur(destinataire, (client) =>
        client.query('select public.accept_tandem_invitation($1)', [jeton])),
    ).rejects.toThrow(/invitation_not_found/)
  })
})
