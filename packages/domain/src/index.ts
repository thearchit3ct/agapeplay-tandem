/**
 * Noyau métier partagé entre le web et le mobile.
 *
 * Rassemblé le 05/08/2026 depuis `apps/web/src/domain.ts` et
 * `apps/web/src/types.ts` : les mêmes notions étaient redéclarées de chaque
 * côté du monorepo — `Locale` existait en double, dans le web et dans le
 * mobile. Un seul endroit, désormais, pour dire ce qu'est une séance.
 *
 * Ce paquet ne contenait que des types jusqu'au 06/08/2026, où `blocking.ts`
 * y a ajouté la première règle exécutable : rien ici ne dépend d'un navigateur,
 * d'un stockage ni de React, et c'est ce qui la rend testable sans base.
 */

export { unblockAffordance } from './blocking'
export type { TandemStatus, TandemBlockView, UnblockAffordance } from './blocking'

export { etatInvitation, revocationInvitation, trierInvitations } from './invitations'
export type { StatutInvitation, EtatInvitation, Invitation, RevocationInvitation } from './invitations'

export { assemblerDossiers, transitionsPossibles } from './moderation'
export type {
  StatutSignalement, Signalement, ContexteSignale, MessageSignale, OrigineMessage, DossierModeration,
} from './moderation'

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
  // `moderation` n'est atteignable que si `tandem_est_moderateur()` rend vrai —
  // l'onglet n'existe pas autrement, et l'écran retombe sur `today` si un état
  // local le désigne encore après un retrait du rôle.
  activeTab: 'today' | 'journey' | 'tandem' | 'journal' | 'mentor' | 'church' | 'moderation'
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

/**
 * Le nom à afficher pour un compte, déduit de son identité de connexion.
 *
 * Jusqu'au 24/08/2026, le web écrasait `profiles.display_name` avec « Claire »
 * à chaque chargement — un nom de maquette, pour tout le monde. Or ce champ est
 * exactement ce que `tandem_partenaire()` montre à l'autre membre du tandem :
 * un nom faux ici, c'est un partenaire anonyme en face.
 *
 * L'ordre reflète la fiabilité de la source : le nom fourni par Google ou
 * Microsoft d'abord, la partie locale de l'email à défaut — imparfaite mais
 * vraie — et une chaîne vide sinon, que l'écran traite comme « pas encore de
 * nom » plutôt que d'inventer.
 */
export const nomDepuisIdentite = (
  metadata: Record<string, unknown> | undefined,
  email: string | null | undefined,
): string => {
  for (const cle of ['full_name', 'name']) {
    const valeur = (metadata ?? {})[cle]
    if (typeof valeur === 'string' && valeur.trim()) return valeur.trim()
  }
  const avantArobase = (email ?? '').split('@')[0]
  return avantArobase.trim()
}

/**
 * L'initiale d'avatar. `[...nom]` et pas `nom[0]` : une initiale accentuée ou
 * hors plan multilingue de base est un caractère, pas un demi-surrogate.
 */
export const initialeDe = (nom: string | null | undefined): string => {
  const propre = (nom ?? '').trim()
  return propre === '' ? '?' : [...propre][0].toUpperCase()
}
