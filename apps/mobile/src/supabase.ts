import AsyncStorage from '@react-native-async-storage/async-storage'
import { createTandemClient } from '@agapeplay/api'
import 'react-native-url-polyfill/auto'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabase = url && key
  ? createTandemClient({ url, key, detectSessionInUrl: false, storage: AsyncStorage })
  : null
