/**
 * ADR-002, règle 3 : un utilisateur bloqué ne peut plus écrire ni lire chez
 * celui qui l'a bloqué.
 *
 * Le schéma n'implémente que la moitié de cette promesse, et ces tests le
 * constatent au lieu de le maquiller. Ce qui existe (migration 002) :
 *
 * - `messages_insert_member` exige `t.status in ('active', 'paused')`. Le
 *   blocage coupe donc bien l'écriture.
 * - `messages_select_member` ne regarde pas le statut du tandem. La lecture de
 *   tout l'historique reste ouverte aux deux participants après le blocage.
 * - `tandems_update_member` autorise chaque participant à modifier la ligne du
 *   tandem, sans restriction de colonne ni de transition de statut, avec un
 *   `grant update` sur toute la table. La personne bloquée peut donc remettre
 *   le tandem en `active` et réécrire.
 *
 * Ces trois tests sont nommés pour ce qu'ils affirment. Ceux qui décrivent un
 * écart rougiront le jour où le schéma sera corrigé : c'est voulu, et c'est le
 * signal qu'ils doivent alors être réécrits en garde.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

let claire: Utilisateur
let indesirable: Utilisateur
let tandemId: string

beforeEach(async () => {
  await commeService(async (client) => {
    const marque = `bloc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    claire = await creerUtilisateur(client, `claire-${marque}@test.local`)
    indesirable = await creerUtilisateur(client, `indesirable-${marque}@test.local`)

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'blocked') returning id",
      [claire.id, indesirable.id],
    )
    tandemId = tandem.rows[0].id

    await client.query(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'un message d’avant le blocage')",
      [tandemId, claire.id],
    )
  })
})

const ecrire = (auteur: Utilisateur, corps: string) =>
  commeUtilisateur(auteur, (client) =>
    client.query('insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, $3)', [tandemId, auteur.id, corps]),
  )

describe('un tandem bloqué', () => {
  it('TÉMOIN — dans un tandem actif, écrire fonctionne', async () => {
    // Sans ce témoin, « l'écriture échoue » ne prouverait rien : elle pourrait
    // échouer pour n'importe quelle autre raison.
    await commeService((client) => client.query("update public.tandems set status = 'active' where id = $1", [tandemId]))

    await expect(ecrire(indesirable, 'bonjour')).resolves.toBeDefined()
  })

  it('coupe l’écriture de la personne bloquée', async () => {
    await expect(ecrire(indesirable, 'laisse-moi te parler')).rejects.toThrow(/row-level security/i)
  })

  it('coupe aussi l’écriture de celle qui a bloqué', async () => {
    // Le statut est porté par le tandem, pas par un sens de blocage : les deux
    // côtés sont muets. C'est cohérent, et c'est à savoir.
    await expect(ecrire(claire, 'finalement…')).rejects.toThrow(/row-level security/i)
  })

  it('ÉCART ADR-002 — laisse encore lire tout l’historique', async () => {
    // `messages_select_member` ne regarde pas `t.status`. La promesse « ne peut
    // plus lire » n'est pas tenue : la personne bloquée relit la conversation
    // entière quand elle veut.
    const lus = await commeUtilisateur(indesirable, async (client) => {
      const { rows } = await client.query('select body from public.tandem_messages where tandem_id = $1', [tandemId])
      return rows
    })

    expect(lus).toHaveLength(1)
    expect(lus[0].body).toBe('un message d’avant le blocage')
  })

  it('ÉCART ADR-002 — la personne bloquée peut se débloquer elle-même, puis réécrire', async () => {
    // `tandems_update_member` n'interdit ni la colonne `status` ni la
    // transition `blocked` → `active`. Le blocage n'est donc pas une barrière :
    // c'est un réglage que la personne écartée peut annuler seule.
    const debloquee = await commeUtilisateur(indesirable, async (client) => {
      const modification = await client.query("update public.tandems set status = 'active' where id = $1", [tandemId])
      await client.query('insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, $3)', [
        tandemId, indesirable.id, 'me revoilà',
      ])
      const { rows } = await client.query('select body from public.tandem_messages where tandem_id = $1 order by created_at', [tandemId])
      return { lignesModifiees: modification.rowCount, corps: rows.map((ligne) => ligne.body) }
    })

    expect(debloquee.lignesModifiees).toBe(1)
    expect(debloquee.corps).toContain('me revoilà')
  })

  it('un tiers ne peut ni lire ni débloquer le tandem', async () => {
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-${Date.now()}@test.local`))

    const vu = await commeUtilisateur(tiers, async (client) => {
      const messages = await client.query('select id from public.tandem_messages where tandem_id = $1', [tandemId])
      const modification = await client.query("update public.tandems set status = 'active' where id = $1", [tandemId])
      return { messages: messages.rowCount, modifiees: modification.rowCount }
    })

    expect(vu).toEqual({ messages: 0, modifiees: 0 })
  })
})
