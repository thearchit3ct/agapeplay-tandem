/**
 * Textes des écrans « parcours » et « séance » du mobile — issue #13.
 *
 * Ils étaient écrits en dur, en français, avec trois titres de maquette. Le
 * contenu vient maintenant de `content_journeys` / `content_sessions`, publié
 * et déjà traduit : ce catalogue ne porte donc que l'ossature — ce qui entoure
 * le texte publié et ne peut pas venir de la base.
 *
 * Deux phrases méritent leur ligne : `notDownloaded` et `offlineNote`. Elles
 * disent la seule chose que l'écran sait vraiment sur son contenu hors ligne —
 * qu'il n'a rien reçu, ou qu'il montre ce qu'il avait déjà.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    kicker: 'PARCOURS',
    sessionLabel: 'SÉANCE',
    minutes: 'MIN',
    loading: 'Chargement…',
    notDownloaded: 'Ce parcours n’a pas encore été téléchargé sur ce téléphone. Reconnecte-toi une fois, et il restera lisible ensuite.',
    offlineNote: 'Lu depuis ce téléphone : c’est la version que tu avais déjà ouverte.',
    unknownSession: 'Cette séance n’est pas dans le parcours téléchargé.',
    finish: 'Terminer la séance',
    finished: 'Séance enregistrée ✓',
    finishQueued: 'Séance gardée ici : elle partira dès que le réseau revient.',
    privacyNote: 'Ton journal reste privé.',
    signInPrompt: 'Connecte-toi pour garder tes séances terminées.',
  },
  en: {
    ...sharedLabels.en,
    kicker: 'JOURNEY',
    sessionLabel: 'SESSION',
    minutes: 'MIN',
    loading: 'Loading…',
    notDownloaded: 'This journey has not been downloaded on this phone yet. Connect once, and it will stay readable afterwards.',
    offlineNote: 'Read from this phone: this is the version you had already opened.',
    unknownSession: 'This session is not in the downloaded journey.',
    finish: 'Finish the session',
    finished: 'Session saved ✓',
    finishQueued: 'Session kept here: it will be sent as soon as the network is back.',
    privacyNote: 'Your journal stays private.',
    signInPrompt: 'Sign in to keep the sessions you finish.',
  },
} as const
