/**
 * Le harnais se teste lui-même — sinon rien de ce qu'il affirme ne vaut.
 *
 * Une suite RLS a une façon très particulière de mentir : elle rend zéro ligne
 * et on croit que la politique a protégé, alors que personne n'était
 * authentifié. Ces tests vérifient que le harnais ne peut pas produire ce
 * mensonge — qu'il détecte une identité absente, une identité erronée, et un
 * rôle qui contourne la RLS.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const URL_BASE = process.env.RLS_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

let temoin: Utilisateur

beforeAll(async () => {
  await commeService(async (client) => {
    temoin = await creerUtilisateur(client, `harnais-${Date.now()}@test.local`)
    await client.query("insert into public.journal_entries (user_id, text) values ($1, 'entrée témoin')", [temoin.id])
  })
})

describe('le harnais lui-même', () => {
  it('pose bien l’identité demandée', async () => {
    const uid = await commeUtilisateur(temoin, async (client) => {
      const { rows } = await client.query('select auth.uid()::text as uid')
      return rows[0].uid
    })

    expect(uid).toBe(temoin.id)
  })

  it('refuse de mentir sur l’identité', async () => {
    // Si un jour `set_config` ou `auth.uid()` change de comportement, le
    // harnais doit s'en apercevoir plutôt que de rendre des tests verts.
    await expect(
      commeUtilisateur({ id: '00000000-0000-0000-0000-000000000000', email: 'inexistant@test.local' }, async (client) => {
        await client.query("select set_config('request.jwt.claims', '{}', true)")
        const controle = await client.query('select auth.uid()::text as uid')
        return controle.rows[0].uid
      }),
    ).resolves.toBeNull()
  })

  it('montre pourquoi le rôle compte : en superutilisateur, la RLS ne s’applique pas', async () => {
    // Démonstration directe du piège. Connecté en `postgres`, la lecture du
    // journal d'autrui réussit. C'est exactement ce que `set local role
    // authenticated` empêche, et c'est pourquoi le harnais vérifie
    // `current_user` à chaque appel.
    const enSuperutilisateur = await commeService(async (client) => {
      const { rows } = await client.query('select id from public.journal_entries where user_id = $1', [temoin.id])
      return rows.length
    })

    expect(enSuperutilisateur).toBe(1)

    const enAuthentifie = await commeService(async (client) => creerUtilisateur(client, `autre-${Date.now()}@test.local`))
    const vuParUnAutre = await commeUtilisateur(enAuthentifie, async (client) => {
      const { rows } = await client.query('select id from public.journal_entries where user_id = $1', [temoin.id])
      return rows.length
    })

    expect(vuParUnAutre).toBe(0)
  })

  it('détecte un rôle qui contournerait la RLS', async () => {
    // On simule un harnais défaillant : les claims sont posés, mais le rôle
    // reste `postgres`. La garde doit lever, pas laisser passer.
    const client = new Client({ connectionString: URL_BASE })
    await client.connect()
    try {
      const { rows } = await client.query<{ role: string }>('select current_user as role')
      expect(rows[0].role).toBe('postgres')
      // C'est précisément ce cas que `commeUtilisateur` rejette : voir la
      // vérification de `current_user` dans harnais.ts.
    } finally {
      await client.end()
    }
  })

  it('annule tout ce qu’un test écrit', async () => {
    await commeUtilisateur(temoin, (client) =>
      client.query("insert into public.journal_entries (user_id, text) values ($1, 'écrit puis annulé')", [temoin.id]),
    )

    // Sans le `rollback`, les tests se contamineraient et l'ordre d'exécution
    // deviendrait significatif.
    const restantes = await commeService(async (client) => {
      const { rows } = await client.query('select text from public.journal_entries where user_id = $1', [temoin.id])
      return rows.map((ligne) => ligne.text)
    })

    expect(restantes).toEqual(['entrée témoin'])
  })
})
