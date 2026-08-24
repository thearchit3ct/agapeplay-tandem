export type SyncOperation = {
  id: string
  kind: 'session_progress' | 'journal_entry' | 'tandem_message' | 'notification_preferences'
  payload: Record<string, unknown>
}

const QUEUE_KEY = 'agapeplay-tandem-sync-queue'

export const readSyncQueue = (): SyncOperation[] => {
  try {
    const value = localStorage.getItem(QUEUE_KEY)
    return value ? JSON.parse(value) as SyncOperation[] : []
  } catch {
    return []
  }
}

export const enqueueSync = (operation: SyncOperation) => {
  const queue = readSyncQueue().filter((item) => item.id !== operation.id)
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, operation]))
}

export const removeSync = (id: string) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(readSyncQueue().filter((item) => item.id !== id)))
}

/**
 * Vide la file. Les opérations en attente portent du texte de journal et de
 * message : elles font partie de ce qu'une suppression de compte doit emporter,
 * et les rejouer après coup viserait un compte qui n'existe plus.
 */
export const clearSyncQueue = () => {
  localStorage.removeItem(QUEUE_KEY)
}
