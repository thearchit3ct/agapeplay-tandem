/**
 * Textes de l'écran d'accueil mobile.
 *
 * Déplacé le 05/08/2026 depuis `apps/mobile/src/content.ts`. Ce n'est pas un
 * sous-ensemble de web.ts : sur les 11 clés que les deux fichiers partagent,
 * cinq seulement disent la même chose (elles vivent dans shared.ts) et les
 * autres répondent à des besoins différents — le web personnalise son
 * `greeting`, le mobile non ; son `offline` est plus court parce que l'écran
 * l'est.
 *
 * `saved` s'appelle ici `privacyNote` : sous ce nom commun, le web confirmait
 * un enregistrement (« Ajouté à ton journal ») quand le mobile rassurait
 * (« Votre espace reste privé »). Deux sens, deux noms. Le texte affiché n'a
 * pas changé.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    eyebrow: 'AGAPEPLAY / TANDEM',
    greeting: 'Un petit pas, aujourd’hui.',
    subtitle: 'Un temps simple pour revenir à l’essentiel.',
    dailySession: 'Rituel du jour',
    theme: 'Présence',
    sessionTitle: 'Repartir avec Jésus',
    verse: '« Venez à moi, vous tous qui êtes fatigués… »',
    prompt: 'Qu’est-ce que tu peux déposer maintenant ?',
    start: 'Commencer',
    journal: 'Journal privé',
    today: 'Aujourd’hui',
    privacyNote: 'Ton espace reste privé.',
    offline: 'Hors ligne · tes actions seront synchronisées.',
    reminder: 'Rappel quotidien',
    reminderOn: 'Rappel activé à 08:00',
    reminderOff: 'Activer le rappel quotidien',
  },
  en: {
    ...sharedLabels.en,
    eyebrow: 'AGAPEPLAY / TANDEM',
    greeting: 'One small step, today.',
    subtitle: 'A simple moment to return to what matters.',
    dailySession: 'Daily ritual',
    theme: 'Presence',
    sessionTitle: 'Starting again with Jesus',
    verse: '“Come to me, all you who are weary…”',
    prompt: 'What can you lay down right now?',
    start: 'Begin',
    journal: 'Private journal',
    today: 'Today',
    privacyNote: 'Your space stays private.',
    offline: 'Offline · your actions will sync later.',
    reminder: 'Daily reminder',
    reminderOn: 'Reminder set for 08:00',
    reminderOff: 'Turn on daily reminder',
  },
} as const
