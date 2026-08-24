import { createTandemClient } from '@agapeplay/api'
import 'react-native-url-polyfill/auto'
import { stockage } from './storage'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

// Le stockage sûr est centralisé dans ./storage — voir son commentaire.
export const supabase = url && key
  ? createTandemClient({ url, key, detectSessionInUrl: false, storage: stockage })
  : null
