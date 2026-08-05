import type { AppState } from '@agapeplay/domain'

const STORAGE_KEY = 'agapeplay-tandem-demo-state'

export const initialState: AppState = {
  locale: 'fr',
  activeTab: 'today',
  completedSessionIds: [],
  journalEntries: [],
  tandem: {
    name: 'Élodie Martin',
    role: 'Tandem de confiance',
    lastMessage: 'On se partage notre phrase de prière ce soir ?',
    lastMessageAt: 'Il y a 2 h',
    status: 'active',
  },
  notificationPrefs: {
    sessions: true,
    messages: true,
    church: false,
    absence: true,
  },
}

export const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...initialState, ...JSON.parse(stored) } : initialState
  } catch {
    return initialState
  }
}

export const saveState = (state: AppState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
