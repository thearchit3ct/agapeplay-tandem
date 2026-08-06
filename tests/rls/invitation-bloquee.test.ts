/**
 * Un blocage ferme le canal de contact, pas seulement l'appariement.
 *
 * `20260806150000_appariement_possible` a fermé le ré-appariement : la paire dont
 * un tandem est bloqué ne peut plus en créer un neuf. Ce qui restait ouvert est
 * en amont — l'**émission** de l'invitation. `invitations_insert_inviter`
 * (migration `…_000002`) n'exige qu'une chose, `auth.uid() = inviter_id`. La
 * personne écartée pouvait donc continuer à envoyer des codes : l'acceptation
 * échouait, mais la sollicitation arrivait quand même, ce qui est précisément ce
 * qu'un blocage doit faire cesser.
 *
 * Deux chemins d'émission, tous deux exercés ici : l'`insert` direct (celui de
 * `apps/web/src/App.tsx:406`) et l'`update` d'une invitation déjà posée, qui
 * permettait de viser une adresse neutre puis de la remplacer.
 *
 * Comme partout dans cette suite, chaque test négatif s'appuie sur un témoin
 * positif : si le témoin tombe, c'est le harnais qui a lâché, pas la politique.
 */
import { describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

type Decor = { claire: Utilisateur; ecarte: Utilisateur }

/**
 * Claire a bloqué la personne écartée. Le décor est posé hors transaction
 * (`commeService` n'en ouvre pas) : il survit donc aux transactions annulées
 * dans lesquelles les tests émettront leurs invitations.
 */
const monterBlocage = async (): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const claire = await creerUtilisateur(client, `claire-${suffixe}@test.local`)
    const ecarte = await creerUtilisateur(client, `ecarte-${suffixe}@test.local`)

    await client.query(
      "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $1)",
      [claire.id, ecarte.id],
    )
    return { claire, ecarte }
  })
}

const inviter = (qui: Utilisateur, adresse: string) =>
  commeUtilisateur(qui, async (client) => {
    const { rowCount } = await client.query(
      'insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2)',
      [qui.id, adresse],
    )
    return rowCount
  })

describe('inviter quelqu’un qui vous a bloqué', () => {
  it('TÉMOIN — sans blocage, l’invitation part', async () => {
    // Le témoin de tout ce fichier : il dit que le chemin ordinaire reste
    // ouvert, donc que les refus ci-dessous mesurent une discrimination et non
    // une porte murée.
    const suffixe = marque()
    const [emetteur, destinataire] = await commeService(async (client) => [
      await creerUtilisateur(client, `emetteur-${suffixe}@test.local`),
      await creerUtilisateur(client, `destinataire-${suffixe}@test.local`),
    ])

    expect(await inviter(emetteur, destinataire.email)).toBe(1)
  })

  it('la personne écartée ne peut plus inviter celle qui l’a bloquée', async () => {
    // Le défaut réparé. Un `with check` refusé lève — c'est ce qui remonte
    // jusqu'à l'utilisateur ; un refus par `using` se serait contenté de zéro
    // ligne.
    const { claire, ecarte } = await monterBlocage()

    await expect(inviter(ecarte, claire.email)).rejects.toThrow(/row-level security/i)
  })

  it('… et la réciproque est vraie : celle qui a bloqué n’invite pas non plus', async () => {
    // Le blocage vaut pour la paire, pas pour un sens. Le chemin de retour
    // sanctionné reste de lever le blocage sur la ligne existante — geste tracé
    // et réservé à `blocked_by` — pas de relancer par une invitation neuve.
    const { claire, ecarte } = await monterBlocage()

    await expect(inviter(claire, ecarte.email)).rejects.toThrow(/row-level security/i)
  })

  it('la casse de l’adresse ne contourne rien', async () => {
    // `invitee_email` est du texte libre : sans normalisation, une majuscule
    // suffisait à rouvrir le canal.
    const { claire, ecarte } = await monterBlocage()

    await expect(inviter(ecarte, claire.email.toUpperCase())).rejects.toThrow(/row-level security/i)
  })

  it('le blocage ne ferme que ce canal-là', async () => {
    // Une personne bloquée par quelqu'un n'est pas exclue du produit : elle
    // continue d'inviter qui elle veut d'autre. Sans ce test, une politique
    // trop large — « qui a été bloqué n'invite plus personne » — passerait
    // pour un succès.
    const { ecarte } = await monterBlocage()
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-${marque()}@test.local`))

    expect(await inviter(ecarte, tiers.email)).toBe(1)
  })

  it('une adresse sans compte reste invitable', async () => {
    // Le cas nominal du produit : on invite quelqu'un qui n'est pas encore
    // inscrit. La résolution e-mail → compte ne trouve rien, et ne doit surtout
    // pas refuser par défaut.
    const emetteur = await commeService((client) => creerUtilisateur(client, `emetteur-${marque()}@test.local`))

    expect(await inviter(emetteur, `inconnu-${marque()}@test.local`)).toBe(1)
  })

  it('le contournement par changement d’adresse est fermé', async () => {
    // `grant … update on public.tandem_invitations` (migration `…_000002`,
    // ligne 177) et `invitations_update_participant` laissaient l'inviteur
    // réécrire `invitee_email` : on visait une adresse neutre, puis on la
    // remplaçait par celle qui nous a écarté. La ligne devenait alors visible
    // du bloqueur par la branche e-mail de `invitations_select_participant` —
    // une sollicitation, même sans e-mail envoyé.
    const { claire, ecarte } = await monterBlocage()

    // L'invitation neutre est posée dans la même transaction que la tentative :
    // le refus doit venir de la politique, pas de l'absence de la ligne.
    await expect(
      commeUtilisateur(ecarte, async (client) => {
        await client.query(
          'insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2)',
          [ecarte.id, `neutre-${marque()}@test.local`],
        )
        await client.query('update public.tandem_invitations set invitee_email = $1 where inviter_id = $2', [
          claire.email,
          ecarte.id,
        ])
      }),
    ).rejects.toThrow(/row-level security/i)
  })

  it('TÉMOIN — l’inviteur non bloqué garde la main sur son invitation', async () => {
    // Le complément du test précédent : la politique UPDATE n'est pas devenue
    // un « non » général. Révoquer reste possible pour qui n'est pas bloqué —
    // et ce témoin est ce qui rend lisible le coût énoncé en migration : pour
    // une paire bloquée, la révocation, elle, n'est plus possible.
    const suffixe = marque()
    const [emetteur, destinataire] = await commeService(async (client) => [
      await creerUtilisateur(client, `emetteur-${suffixe}@test.local`),
      await creerUtilisateur(client, `destinataire-${suffixe}@test.local`),
    ])

    const revoquees = await commeUtilisateur(emetteur, async (client) => {
      await client.query('insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2)', [
        emetteur.id,
        destinataire.email,
      ])
      const { rowCount } = await client.query(
        "update public.tandem_invitations set status = 'revoked' where inviter_id = $1",
        [emetteur.id],
      )
      return rowCount
    })

    expect(revoquees).toBe(1)
  })

  it('GARDE — la fonction ne renseigne pas sur les blocages des autres', async () => {
    // `tandem_contact_bloque` est `security definer` : elle traverse la RLS et
    // lit `auth.users`, table sur laquelle `authenticated` n'a aucun droit. Elle
    // pourrait donc servir de sonde — « telle adresse a-t-elle bloqué telle
    // autre ? ». Elle ne le peut pas : elle n'accepte pas d'identité en
    // paramètre, elle prend la sienne dans `auth.uid()`, et ne répond donc que
    // sur des paires dont l'appelant fait partie.
    const { claire } = await monterBlocage()
    const sondeur = await commeService((client) => creerUtilisateur(client, `sondeur-${marque()}@test.local`))

    const reponse = await commeUtilisateur(sondeur, async (client) => {
      const { rows } = await client.query<{ r: boolean }>('select public.tandem_contact_bloque($1) as r', [
        claire.email,
      ])
      return rows[0].r
    })

    // Claire a bien un blocage — mais pas avec le sondeur, qui n'apprend rien.
    expect(reponse).toBe(false)
  })
})
