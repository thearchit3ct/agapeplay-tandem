/**
 * Se connecter à la base locale sous l'identité d'un utilisateur, comme le fait
 * PostgREST : rôle `authenticated`, claims JWT dans `request.jwt.claims`.
 *
 * Le piège de ce genre de test est connu et il est mortel : si les claims ne
 * sont pas posés, `auth.uid()` vaut NULL, toutes les comparaisons
 * `uid = user_id` sont fausses, et **chaque test négatif passe pour la mauvaise
 * raison** — zéro ligne parce que personne n'était authentifié, pas parce que
 * la politique a discriminé. Une suite entièrement verte, entièrement creuse.
 *
 * Deux garde-fous en conséquence :
 *
 * 1. `commeUtilisateur` vérifie lui-même, à chaque appel, que `current_user`
 *    vaut bien `authenticated` et que `auth.uid()` rend l'identité demandée. Un
 *    harnais cassé lève une erreur au lieu de rendre un vert.
 * 2. Chaque test négatif est accompagné d'un témoin positif dans le même
 *    fichier : si le témoin tombe à zéro, c'est le harnais qui a lâché, pas la
 *    politique.
 */
import { Client } from 'pg'

const URL_BASE = process.env.RLS_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export type Utilisateur = { id: string; email: string }

const connecter = async () => {
  const client = new Client({ connectionString: URL_BASE })
  try {
    await client.connect()
  } catch (cause) {
    // Un échec de connexion ne doit jamais se traduire par une suite
    // silencieusement sautée : une suite de sécurité absente rassure autant
    // qu'une suite verte, et à tort.
    throw new Error(
      `base RLS injoignable sur ${URL_BASE}. Lancez « npm run test:rls » qui la provisionne.`,
      { cause },
    )
  }
  return client
}

/**
 * Exécute une requête sous l'identité d'un utilisateur authentifié.
 *
 * Tout se joue dans une transaction annulée à la fin : les tests ne se
 * contaminent pas, et un test d'écriture ne laisse rien derrière lui.
 */
export const commeUtilisateur = async <T>(
  utilisateur: Utilisateur,
  action: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = await connecter()
  try {
    await client.query('begin')
    const claims = JSON.stringify({ sub: utilisateur.id, email: utilisateur.email, role: 'authenticated' })
    await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
    await client.query('set local role authenticated')

    const controle = await client.query<{ role: string; uid: string | null }>(
      'select current_user as role, auth.uid()::text as uid',
    )
    if (controle.rows[0].role !== 'authenticated') {
      throw new Error(`harnais cassé : rôle « ${controle.rows[0].role} », RLS contournée`)
    }
    if (controle.rows[0].uid !== utilisateur.id) {
      throw new Error(`harnais cassé : auth.uid() = ${controle.rows[0].uid}, attendu ${utilisateur.id}`)
    }

    return await action(client)
  } finally {
    await client.query('rollback').catch(() => {})
    await client.end()
  }
}

/** Même chose pour un visiteur non connecté : rôle `anon`, aucun claim. */
export const commeAnonyme = async <T>(action: (client: Client) => Promise<T>): Promise<T> => {
  const client = await connecter()
  try {
    await client.query('begin')
    await client.query('set local role anon')
    return await action(client)
  } finally {
    await client.query('rollback').catch(() => {})
    await client.end()
  }
}

/** Prépare le décor. Rôle `postgres` : hors RLS, comme une migration. */
export const commeService = async <T>(action: (client: Client) => Promise<T>): Promise<T> => {
  const client = await connecter()
  try {
    return await action(client)
  } finally {
    await client.end()
  }
}

export const creerUtilisateur = async (client: Client, email: string): Promise<Utilisateur> => {
  const { rows } = await client.query<{ id: string }>(
    'insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id::text',
    [email],
  )
  return { id: rows[0].id, email }
}
