import { createTandemClient } from '@agapeplay/api'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Le test reste ici, et non dans @agapeplay/api : Vite fige ces variables à la
// compilation, donc Rollup sait retirer tout le SDK quand il n'y a pas de
// backend configuré. Le déplacer coûterait 202 ko au paquet.
export const supabase = supabaseConfigured
  ? createTandemClient({
      url: supabaseUrl!,
      key: supabaseKey!,
      detectSessionInUrl: true,
    })
  : null
