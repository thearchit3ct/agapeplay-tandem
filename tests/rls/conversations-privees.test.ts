/**
 * ADR-002, règle 2 : le mentor ne lit pas les conversations auxquelles il ne
 * participe pas.
 *
 * Ce que dit la politique (migration 002) : `messages_select_member` n'ouvre la
 * lecture qu'aux deux participants du tandem porteur du message. Rien, nulle
 * part dans les sept migrations, n'accorde de lecture à un mentor. La règle
 * tient donc — et ce test existe pour qu'elle continue de tenir le jour où
 * quelqu'un voudra rendre le suivi « plus pratique » pour les mentors.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeAnonyme, commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

let claire: Utilisateur
let elodie: Utilisateur
let mentor: Utilisateur
let inconnu: Utilisateur
let tandemId: string

beforeAll(async () => {
  await commeService(async (client) => {
    const marque = `conv-${Date.now()}`
    claire = await creerUtilisateur(client, `claire-${marque}@test.local`)
    elodie = await creerUtilisateur(client, `elodie-${marque}@test.local`)
    mentor = await creerUtilisateur(client, `mentor-${marque}@test.local`)
    inconnu = await creerUtilisateur(client, `inconnu-${marque}@test.local`)

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [claire.id, elodie.id],
    )
    tandemId = tandem.rows[0].id

    await client.query(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'Je traverse quelque chose de dur en ce moment.')",
      [tandemId, claire.id],
    )

    // Mentor de Claire, vérifié, affectation active : celui qui aurait le plus
    // de raisons de croire qu'il a le droit de lire.
    const eglise = await client.query<{ id: string }>(
      "insert into public.churches (name, status) values ('Église test', 'active') returning id",
    )
    await client.query(
      "insert into public.mentor_assignments (church_id, mentor_id, participant_id, status) values ($1, $2, $3, 'active')",
      [eglise.rows[0].id, mentor.id, claire.id],
    )
    await client.query(
      "insert into public.mentor_profiles (user_id, verification_status, training_status) values ($1, 'verified', 'completed')",
      [mentor.id],
    )
  })
})

const lireLaConversation = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query('select id, body from public.tandem_messages where tandem_id = $1', [tandemId])
    return rows
  })

describe('les conversations restent entre les deux participants', () => {
  it('TÉMOIN — les deux participants lisent bien leur conversation', async () => {
    expect(await lireLaConversation(claire)).toHaveLength(1)
    expect(await lireLaConversation(elodie)).toHaveLength(1)
  })

  it('le mentor du participant ne lit pas la conversation', async () => {
    expect(await lireLaConversation(mentor)).toEqual([])
  })

  it('le mentor ne voit pas non plus que ce tandem existe', async () => {
    const tandems = await commeUtilisateur(mentor, async (client) => {
      const { rows } = await client.query('select id from public.tandems where id = $1', [tandemId])
      return rows
    })

    expect(tandems).toEqual([])
  })

  it('un tiers quelconque ne lit pas la conversation', async () => {
    expect(await lireLaConversation(inconnu)).toEqual([])
  })

  it('un visiteur non connecté n’a aucun droit sur les messages', async () => {
    await expect(
      commeAnonyme((client) => client.query('select id from public.tandem_messages')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('personne ne peut écrire dans une conversation dont il n’est pas membre', async () => {
    await expect(
      commeUtilisateur(mentor, (client) =>
        client.query("insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'je passe voir')", [tandemId, mentor.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('on ne peut pas écrire sous l’identité de quelqu’un d’autre', async () => {
    // `messages_insert_member` exige `auth.uid() = sender_id` : Élodie est bien
    // membre du tandem, mais ne peut pas signer un message du nom de Claire.
    await expect(
      commeUtilisateur(elodie, (client) =>
        client.query("insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'message attribué à Claire')", [tandemId, claire.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})
