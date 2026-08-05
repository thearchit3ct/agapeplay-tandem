/**
 * ADR-002, règle 4 : le signalement est visible de la modération, pas de la
 * personne signalée.
 *
 * Le schéma tient la seconde moitié et pas la première. `reports_select_reporter`
 * (migration 005) n'ouvre la lecture qu'à `auth.uid() = reporter_id` : la
 * personne signalée ne voit rien — c'est acquis, et testé. En revanche **aucune
 * politique de modération n'existe** dans les sept migrations : pas de rôle
 * modérateur, pas de table d'équipe, aucune lecture élargie. La modération ne
 * peut lire que par `service_role`, qui contourne la RLS — et aucun code du
 * dépôt ne l'utilise.
 *
 * On ne l'invente pas ici : on constate, et on le signale comme écart.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeAnonyme, commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

let claire: Utilisateur
let signale: Utilisateur
let tiers: Utilisateur
let tandemId: string
let messageId: string

beforeAll(async () => {
  await commeService(async (client) => {
    const marque = `sig-${Date.now()}`
    claire = await creerUtilisateur(client, `claire-${marque}@test.local`)
    signale = await creerUtilisateur(client, `signale-${marque}@test.local`)
    tiers = await creerUtilisateur(client, `tiers-${marque}@test.local`)

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [claire.id, signale.id],
    )
    tandemId = tandem.rows[0].id

    const message = await client.query<{ id: string }>(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'un message déplacé') returning id",
      [tandemId, signale.id],
    )
    messageId = message.rows[0].id

    await client.query(
      "insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason) values ($1, $2, $3, 'Propos déplacés.')",
      [tandemId, claire.id, messageId],
    )
  })
})

const lireLesSignalements = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query('select id, reason from public.tandem_reports where tandem_id = $1', [tandemId])
    return rows
  })

describe('signaler quelqu’un', () => {
  it('TÉMOIN — la personne qui signale retrouve son signalement', async () => {
    const signalements = await lireLesSignalements(claire)

    expect(signalements).toHaveLength(1)
    expect(signalements[0].reason).toBe('Propos déplacés.')
  })

  it('la personne signalée ne voit pas le signalement', async () => {
    // C'est le point qui protège : savoir qu'on a été signalé, et par qui,
    // ouvre la porte aux représailles dans une relation déjà déséquilibrée.
    expect(await lireLesSignalements(signale)).toEqual([])
  })

  it('personne ne peut effacer un signalement — le droit n’est accordé à personne', async () => {
    // La protection est ici plus forte qu'une politique : `tandem_reports`
    // n'accorde que `select, insert` à `authenticated`. La suppression est
    // refusée au niveau du droit sur la table, avant même la RLS — donc aussi
    // pour la personne qui a signalé, qui ne peut pas se rétracter.
    for (const utilisateur of [signale, claire]) {
      await expect(
        commeUtilisateur(utilisateur, (client) =>
          client.query('delete from public.tandem_reports where tandem_id = $1', [tandemId]),
        ),
      ).rejects.toThrow(/permission denied/i)
    }

    expect(await lireLesSignalements(claire)).toHaveLength(1)
  })

  it('un tiers ne peut pas signaler un tandem dont il n’est pas membre', async () => {
    await expect(
      commeUtilisateur(tiers, (client) =>
        client.query("insert into public.tandem_reports (tandem_id, reporter_id, reason) values ($1, $2, 'signalement de complaisance')", [tandemId, tiers.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('on ne peut pas signaler au nom de quelqu’un d’autre', async () => {
    await expect(
      commeUtilisateur(signale, (client) =>
        client.query("insert into public.tandem_reports (tandem_id, reporter_id, reason) values ($1, $2, 'signalement fabriqué')", [tandemId, claire.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('un visiteur non connecté n’a aucun droit sur les signalements', async () => {
    await expect(
      commeAnonyme((client) => client.query('select id from public.tandem_reports')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('ÉCART ADR-002 — aucune politique n’ouvre les signalements à la modération', async () => {
    // Le seul chemin de lecture des signalements passe par `reporter_id`. On
    // le vérifie sur le schéma lui-même plutôt que par déduction : si une
    // politique de modération est ajoutée un jour, ce test rougira et devra
    // être réécrit en garde — c'est le signal attendu.
    const politiques = await commeService(async (client) => {
      const { rows } = await client.query<{ policyname: string; qual: string | null; roles: string }>(
        "select policyname, qual, roles::text from pg_policies where schemaname = 'public' and tablename = 'tandem_reports' and cmd = 'SELECT'",
      )
      return rows
    })

    expect(politiques.map((politique) => politique.policyname)).toEqual(['reports_select_reporter'])
    expect(politiques[0].qual).toContain('reporter_id')
  })
})
