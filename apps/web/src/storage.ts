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

/**
 * Le jeton de communauté, gardé le temps d'une connexion — issue #17.
 *
 * Sans cela, le critère « invitation par lien » ne tient que pour quelqu'un qui
 * a déjà un compte, c'est-à-dire l'exact opposé du cas courant. Le chemin réel
 * est celui-ci : on reçoit le lien dans un groupe de messagerie, on l'ouvre sans
 * session, on se connecte — et `signInWithOAuth` comme le lien magique quittent
 * la page et reviennent sur `window.location.origin`, **nu**. La query string a
 * disparu, l'état React est reparti de zéro, et le jeton n'existe plus nulle
 * part : la personne atterrit sans communauté et sans rien à recliquer.
 *
 * Une clé à part plutôt qu'un champ d'`AppState` : ce jeton n'est pas un
 * réglage, il ne se sauvegarde pas à chaque rendu, et il doit disparaître dès
 * qu'il a servi — ou dès qu'il a été refusé, ce qui est aussi terminal.
 *
 * `clearState()` ne l'emporte pas, et c'est délibéré : la suppression de compte
 * efface ce qui appartient à la personne, et un jeton d'invitation appartient à
 * l'église qui l'a émis. Il périme tout seul, en base, au plus tard à 90 jours.
 */
const CLEF_JETON_COMMUNAUTE = 'agapeplay-tandem-communaute-jeton'

export const retenirJetonCommunaute = (jeton: string) => {
  try {
    localStorage.setItem(CLEF_JETON_COMMUNAUTE, jeton)
  } catch { /* stockage indisponible : le jeton ne survivra pas à la connexion, et rien ne peut y changer quoi que ce soit */ }
}

export const jetonCommunauteRetenu = (): string | null => {
  try {
    const jeton = localStorage.getItem(CLEF_JETON_COMMUNAUTE)
    return jeton !== null && jeton.trim() !== '' ? jeton : null
  } catch {
    return null
  }
}

export const oublierJetonCommunaute = () => {
  try {
    localStorage.removeItem(CLEF_JETON_COMMUNAUTE)
  } catch { /* rien à effacer */ }
}
