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
    privacyNote: 'Ton espace reste privé.',
    offline: 'Hors ligne · tes actions seront synchronisées.',
    reminder: 'Rappel quotidien',
    reminderOn: 'Rappel activé à 08:00',
    reminderOff: 'Activer le rappel quotidien',
    // Le mobile n'a pas d'écran de réglages : le texte doit donc tenir sous une
    // carte d'accueil. Deux phrases, la même promesse que le web en plus court
    // (voir `measurementDescription` dans web.ts).
    measurement: 'Mesure du produit',
    measurementOn: 'Tu participes à la mesure',
    measurementOff: 'Tu ne participes pas',
    measurementDescription: 'On compte des gestes — une séance terminée, une invitation acceptée — pour savoir si l’application aide vraiment. Jamais ce que tu écris, et ces chiffres ne remontent à personne.',
    // Le bilan de fin de semaine — issue #18. Le mobile n'a pas d'écran de
    // réglages : la carte porte donc à la fois la question et l'état du
    // rappel, comme le fait déjà la mesure juste au-dessus.
    checkinTitle: 'Ta semaine',
    checkinQuestion: 'Elle s’est passée comment ?',
    checkinCalm: 'Paisible',
    checkinFull: 'Chargée',
    checkinHard: 'Rude',
    checkinElsewhere: 'J’étais ailleurs',
    checkinUnsure: 'Je ne sais pas trop',
    checkinSaved: 'C’est noté.',
    checkinFailed: 'Ça n’a pas été enregistré. Réessaie quand tu veux.',
    checkinSignedOut: 'Connecte-toi pour garder ton bilan d’une semaine à l’autre.',
    checkinPrivate: 'Personne d’autre ne le voit.',
    checkinReminder: 'Bilan de fin de semaine',
    checkinReminderOn: 'On te le proposera le samedi',
    checkinReminderOff: 'On ne te le proposera pas',
    resumeTitle: 'Te revoilà.',
    resumeBody: 'Rien n’a bougé pendant ce temps : ta séance t’attend là où tu l’as laissée.',
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
    privacyNote: 'Your space stays private.',
    offline: 'Offline · your actions will sync later.',
    reminder: 'Daily reminder',
    reminderOn: 'Reminder set for 08:00',
    reminderOff: 'Turn on daily reminder',
    measurement: 'Product measurement',
    measurementOn: 'You take part in measurement',
    measurementOff: 'You are not taking part',
    measurementDescription: 'We count actions — a session finished, an invitation accepted — to know whether the app really helps. Never what you write, and these numbers lead back to no one.',
    checkinTitle: 'Your week',
    checkinQuestion: 'How did it go?',
    checkinCalm: 'Calm',
    checkinFull: 'Busy',
    checkinHard: 'Hard',
    checkinElsewhere: 'I was elsewhere',
    checkinUnsure: 'Not really sure',
    checkinSaved: 'Noted.',
    checkinFailed: 'That was not saved. Try again whenever you like.',
    checkinSignedOut: 'Sign in to keep your check-in from one week to the next.',
    checkinPrivate: 'No one else sees it.',
    checkinReminder: 'End-of-week check-in',
    checkinReminderOn: 'We will offer it on Saturday',
    checkinReminderOff: 'We will not offer it',
    resumeTitle: 'You are back.',
    resumeBody: 'Nothing moved in the meantime: your session is where you left it.',
  },
} as const
