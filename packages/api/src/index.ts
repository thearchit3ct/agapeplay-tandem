/**
 * Le client Supabase, monté de la même façon des deux côtés.
 *
 * Ce qui est réellement commun tient en trois options — rafraîchir le jeton,
 * garder la session, et le fait d'appeler `createClient` tout court. Le reste
 * diffère vraiment d'une plateforme à l'autre et reste à la charge de
 * l'appelant :
 *
 * - la lecture des variables d'environnement (`import.meta.env` côté Vite,
 *   `process.env` côté Expo) : le paquet ne reçoit que des valeurs ;
 * - `detectSessionInUrl`, vrai sur le web où l'on revient d'un lien magique,
 *   faux sur mobile ; sans valeur par défaut ici, pour qu'on ne puisse pas
 *   l'oublier ;
 * - le stockage de session, laissé au défaut du navigateur sur le web et
 *   confié à AsyncStorage sur mobile ;
 * - le polyfill d'URL de React Native, qui n'a rien à faire dans le graphe web.
 *
 * Le « pas de projet configuré, donc pas de client » reste lui aussi chez
 * l'appelant, et ce n'est pas un oubli : côté web, Vite remplace les variables
 * d'environnement par des littéraux à la compilation, si bien que le test se
 * réduit à une constante et que Rollup retire tout le SDK du paquet quand
 * l'application est construite sans backend (docs/15). Déplacer ce test ici
 * casserait cet élagage et ajouterait 202 ko au paquet.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type SessionStorage = {
  getItem: (key: string) => Promise<string | null> | string | null
  setItem: (key: string, value: string) => Promise<void> | void
  removeItem: (key: string) => Promise<void> | void
}

export type TandemClientOptions = {
  url: string
  key: string
  detectSessionInUrl: boolean
  storage?: SessionStorage
}

export const createTandemClient = ({ url, key, detectSessionInUrl, storage }: TandemClientOptions): SupabaseClient =>
  createClient(url, key, {
    auth: {
      ...(storage ? { storage } : {}),
      autoRefreshToken: true,
      detectSessionInUrl,
      persistSession: true,
    },
  })
