/**
 * Noyau métier partagé entre le web et le mobile.
 *
 * Rassemblé le 05/08/2026 depuis `apps/web/src/domain.ts` et
 * `apps/web/src/types.ts` : les mêmes notions étaient redéclarées de chaque
 * côté du monorepo — `Locale` existait en double, dans le web et dans le
 * mobile. Un seul endroit, désormais, pour dire ce qu'est une séance.
 *
 * Ce paquet ne contient que des types : rien ici ne dépend d'un navigateur,
 * d'un stockage ni de React.
 */

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
  activeTab: 'today' | 'journey' | 'tandem' | 'journal' | 'mentor' | 'church'
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

/**
 * Types partagés entre l'écran principal et les vues.
 *
 * Extraits d'App.tsx le 05/08/2026 : ils étaient déclarés au milieu du fichier
 * et empêchaient de sortir les vues, qui en dépendent toutes.
 */
export type Tab = AppState['activeTab']
export type SessionStep = 'read' | 'practice' | 'complete'
export type RemoteMessage = { id: string; senderId: string; body: string; createdAt: string }
export type MentorSnapshot = { verificationStatus: 'pending' | 'verified' | 'rejected' | 'revoked'; trainingStatus: 'required' | 'in_progress' | 'completed' | 'expired' } | null
export type ChurchSnapshot = { churchId: string; role: 'member' | 'mentor' | 'leader' | 'admin'; groupCount: number } | null
