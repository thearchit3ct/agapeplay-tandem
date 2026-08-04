import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from './supabase'

const queueKey = 'agapeplay:tandem:sync-queue'
type ProgressOperation = { id: string; userId: string; sessionId: string; journeyId: string }

export async function queueProgress(operation: ProgressOperation) {
  const current = await readQueue()
  const next = [...current.filter((item) => item.id !== operation.id), operation]
  await AsyncStorage.setItem(queueKey, JSON.stringify(next))
}

export async function readQueue(): Promise<ProgressOperation[]> {
  const raw = await AsyncStorage.getItem(queueKey)
  if (!raw) return []
  try { return JSON.parse(raw) as ProgressOperation[] } catch { return [] }
}

export async function flushProgressQueue() {
  if (!supabase) return 0
  const queue = await readQueue()
  const remaining: ProgressOperation[] = []
  for (const operation of queue) {
    const { error } = await supabase.from('session_progress').upsert({ user_id: operation.userId, journey_id: operation.journeyId, session_id: operation.sessionId })
    if (error) remaining.push(operation)
  }
  await AsyncStorage.setItem(queueKey, JSON.stringify(remaining))
  return remaining.length
}
