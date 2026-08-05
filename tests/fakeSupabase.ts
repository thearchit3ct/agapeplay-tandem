/**
 * Un client Supabase de papier, pour tester ce que le code fait des réponses.
 *
 * Il n'imite pas PostgREST : il rend, table par table, la réponse qu'on lui a
 * dictée, et enregistre les filtres demandés. Ce qui relève du serveur — le tri
 * SQL, les politiques RLS — n'est pas simulé ici, et ne doit pas l'être : un
 * test qui vérifierait que ce faux client trie par `day` ne testerait que le
 * faux client. La suite RLS, elle, tournera sur une vraie base locale.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type QueryResult = { data: unknown; error: unknown }

export type RecordedCall = {
  table: string
  columns: string
  filters: Array<[string, unknown]>
  order: Array<[string, unknown]>
  terminator: 'maybeSingle' | 'await'
}

export const createFakeSupabase = (responses: Record<string, QueryResult>) => {
  const calls: RecordedCall[] = []

  const from = (table: string) => ({
    select: (columns: string) => {
      const call: RecordedCall = { table, columns, filters: [], order: [], terminator: 'await' }
      calls.push(call)
      const response = responses[table] ?? { data: null, error: { message: `aucune réponse dictée pour ${table}` } }

      // La chaîne est « thenable » : `await builder` la termine comme le fait
      // PostgREST, et `.maybeSingle()` la termine aussi. Les deux rendent la
      // même réponse dictée.
      const builder = {
        eq: (column: string, value: unknown) => { call.filters.push([column, value]); return builder },
        order: (column: string, options: unknown) => { call.order.push([column, options]); return builder },
        maybeSingle: () => { call.terminator = 'maybeSingle'; return Promise.resolve(response) },
        then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve(response).then(resolve, reject),
      }
      return builder
    },
  })

  return { client: { from } as unknown as SupabaseClient, calls }
}
