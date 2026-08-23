/**
 * Le nom du partenaire : visible pour soi, muet pour tous les autres.
 *
 * `tandem_partenaire()` (migration `20260824100000_partenaire_visible`) est le
 * SEUL chemin de lecture du profil d'autrui : `profiles_select_own` reste
 * own-only, et la fonction — `security definer`, sans paramètre — ne sait
 * répondre que sur les tandems où l'appelant figure. Ces tests mesurent les
 * deux faces : ce qu'elle rend à un participant, et ce qu'elle refuse à tout
 * le monde d'autre.
 *
 * Deux comportements sont des décisions, pas des accidents, et un test les
 * épingle pour qu'un correctif bien intentionné ne les défasse pas en
 * silence :
 *
 *   - un tandem bloqué rend encore le nom (miroir de `tandems_select_member` —
 *     l'écran de blocage nomme la relation qu'il gèle) ;
 *   - un partenaire sans ligne `profiles` rend le tandem avec un nom NULL,
 *     jamais zéro ligne (`left join` : « pas encore de nom » n'est pas « pas
 *     de tandem »).
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif, et l'on
 * mesure des faits — une ligne, un nom, un identifiant — jamais la seule
 * absence d'erreur.
 */
import { describe, expect, it } from 'vitest'
import { commeAnonyme, commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

type Decor = { a: Utilisateur; b: Utilisateur; tiers: Utilisateur; tandemId: string }

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Deux comptes appariés avec profils nommés, plus un tiers. Posés hors
 * transaction (`commeService`) pour survivre aux transactions — annulées — des
 * lectures qui suivent.
 */
const monterTandem = async (options: { statut?: string; profilB?: boolean } = {}): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const a = await creerUtilisateur(client, `a-${suffixe}@test.local`)
    const b = await creerUtilisateur(client, `b-${suffixe}@test.local`)
    const tiers = await creerUtilisateur(client, `tiers-${suffixe}@test.local`)

    await client.query("insert into public.profiles (id, display_name) values ($1, $2)", [a.id, `Anne ${suffixe}`])
    if (options.profilB !== false) {
      await client.query("insert into public.profiles (id, display_name) values ($1, $2)", [b.id, `Benjamin ${suffixe}`])
    }
    await client.query("insert into public.profiles (id, display_name) values ($1, $2)", [tiers.id, `Tiers ${suffixe}`])

    const statut = options.statut ?? 'active'
    const { rows } = await client.query<{ id: string }>(
      `insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by)
       values ($1::uuid, $2::uuid, $3::text, case when $3::text = 'blocked' then $1::uuid end) returning id::text`,
      [a.id, b.id, statut],
    )
    return { a, b, tiers, tandemId: rows[0].id }
  })
}

/** Appelle la fonction sous l'identité donnée et rend ses lignes. */
const partenaires = (qui: Utilisateur) =>
  commeUtilisateur(qui, async (client) => {
    const { rows } = await client.query<{ tandem_id: string; display_name: string | null }>(
      'select tandem_id::text, display_name from public.tandem_partenaire()',
    )
    return rows
  })

describe('tandem_partenaire — ce qu\'un participant voit', () => {
  it('rend à chaque participant le nom de l\'autre, sur le bon tandem', async () => {
    const { a, b, tandemId } = await monterTandem()

    const vuParA = await partenaires(a)
    expect(vuParA).toHaveLength(1)
    expect(vuParA[0].tandem_id).toBe(tandemId)
    expect(vuParA[0].display_name).toMatch(/^Benjamin /)

    // La symétrie n'est pas décorative : la fonction résout « l'autre » par un
    // `case` sur participant_a/participant_b, et c'est exactement le genre
    // d'expression qu'une inversion silencieuse casse d'un seul côté.
    const vuParB = await partenaires(b)
    expect(vuParB).toHaveLength(1)
    expect(vuParB[0].display_name).toMatch(/^Anne /)
  })

  it('rend encore le nom quand le tandem est bloqué — décision, pas oubli', async () => {
    const { a, b } = await monterTandem({ statut: 'blocked' })
    const vuParA = await partenaires(a)
    expect(vuParA).toHaveLength(1)
    expect(vuParA[0].display_name).toMatch(/^Benjamin /)
    // Y compris pour la personne bloquée : miroir de tandems_select_member.
    const vuParB = await partenaires(b)
    expect(vuParB[0].display_name).toMatch(/^Anne /)
  })

  it('rend le tandem avec un nom NULL quand le partenaire n\'a pas encore de profil', async () => {
    const { a, tandemId } = await monterTandem({ profilB: false })
    const vuParA = await partenaires(a)
    // Zéro ligne serait le mensonge « pas de tandem » ; la vérité est « tandem
    // réel, nom pas encore posé ».
    expect(vuParA).toHaveLength(1)
    expect(vuParA[0].tandem_id).toBe(tandemId)
    expect(vuParA[0].display_name).toBeNull()
  })
})

describe('tandem_partenaire — ce qu\'elle refuse', () => {
  it('ne rend rien à un tiers, pendant que le participant voit sa ligne (témoin)', async () => {
    const { a, tiers } = await monterTandem()

    expect(await partenaires(tiers)).toHaveLength(0)

    // Témoin positif dans le même décor : si lui aussi rendait zéro ligne,
    // c'est le harnais ou la fixture qui aurait lâché, pas la fonction.
    expect(await partenaires(a)).toHaveLength(1)
  })

  it('ne rend rien à un compte sans tandem', async () => {
    const { tiers } = await monterTandem()
    expect(await partenaires(tiers)).toHaveLength(0)
  })

  it('est inexécutable sans identité', async () => {
    await expect(
      commeAnonyme((client) => client.query('select * from public.tandem_partenaire()')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('n\'ouvre pas profiles pour autant : le profil du partenaire reste illisible en direct', async () => {
    const { a, b } = await monterTandem()

    const direct = await commeUtilisateur(a, async (client) => {
      const { rows } = await client.query('select display_name from public.profiles where id = $1', [b.id])
      return rows
    })
    expect(direct).toHaveLength(0)

    // Témoin : la même requête sur sa propre ligne rend bien un nom —
    // profiles_select_own discrimine, elle ne bloque pas tout.
    const propre = await commeUtilisateur(a, async (client) => {
      const { rows } = await client.query<{ display_name: string }>(
        'select display_name from public.profiles where id = $1',
        [a.id],
      )
      return rows
    })
    expect(propre).toHaveLength(1)
    expect(propre[0].display_name).toMatch(/^Anne /)
  })
})
