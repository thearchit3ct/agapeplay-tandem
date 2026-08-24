import type { AppState } from '@agapeplay/domain'

const STORAGE_KEY = 'agapeplay-tandem-demo-state'

export const initialState: AppState = {
  locale: 'fr',
  activeTab: 'today',
  completedSessionIds: [],
  journalEntries: [],
  // Vide à dessein : l'écran tire le vrai nom de tandem_partenaire() et, sans
  // tandem, propose d'inviter. La démo n'invente plus de personne.
  tandem: {
    name: '',
    role: '',
    lastMessage: '',
    lastMessageAt: '',
    status: 'pending',
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
