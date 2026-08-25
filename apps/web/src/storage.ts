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
    // `default true` côté base aussi (migration 20260825213000) : un rappel
    // qu'il faut aller allumer est un rappel que personne ne découvre, et
    // celui-ci se coupe d'une case.
    weekly_checkin: true,
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

/**
 * Efface l'état local. Appelé au moment de la suppression de compte : le
 * journal et la progression sont aussi ici, dans le navigateur, et une purge
 * qui s'arrêterait à la base laisserait les entrées du journal au prochain qui
 * ouvre cet ordinateur — souvent un ordinateur partagé, à seize ans.
 */
export const clearState = () => {
  localStorage.removeItem(STORAGE_KEY)
}
