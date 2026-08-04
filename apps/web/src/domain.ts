export type Locale = 'fr' | 'en'

export type Session = {
  id: string
  day: number
  title: string
  theme: string
  duration: number
  verse: string
  prompt: string
  action: string
}

export type Journey = {
  id: string
  title: string
  eyebrow: string
  description: string
  duration: string
  sessions: Session[]
}

export type JournalEntry = {
  id: string
  createdAt: string
  text: string
  mood: string
}

export type Tandem = {
  name: string
  role: string
  lastMessage: string
  lastMessageAt: string
  status: 'active' | 'pending' | 'blocked'
}

export type AppState = {
  locale: Locale
  activeTab: 'today' | 'journey' | 'tandem' | 'journal'
  completedSessionIds: string[]
  journalEntries: JournalEntry[]
  tandem: Tandem
  notificationPrefs: {
    sessions: boolean
    messages: boolean
    church: boolean
    absence: boolean
  }
}
