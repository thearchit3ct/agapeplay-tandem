/**
 * Types partagés entre l'écran principal et les vues.
 *
 * Extraits d'App.tsx le 05/08/2026 : ils étaient déclarés au milieu du fichier
 * et empêchaient de sortir les vues, qui en dépendent toutes.
 */
import type { AppState } from './domain'

export type Tab = AppState['activeTab']
export type SessionStep = 'read' | 'practice' | 'complete'
export type RemoteMessage = { id: string; senderId: string; body: string; createdAt: string }
export type MentorSnapshot = { verificationStatus: 'pending' | 'verified' | 'rejected' | 'revoked'; trainingStatus: 'required' | 'in_progress' | 'completed' | 'expired' } | null
export type ChurchSnapshot = { churchId: string; role: 'member' | 'mentor' | 'leader' | 'admin'; groupCount: number } | null
