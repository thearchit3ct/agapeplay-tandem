/**
 * Textes de l'écran d'invitation mobile — issue #13.
 *
 * L'écran était écrit en dur en français, et ne connaissait qu'une seule sorte
 * de lien. Il en accueille deux depuis le 26/08/2026 : celui d'un binôme et
 * celui d'une communauté (issue #17), qui ne confèrent pas la même chose et ne
 * se disent donc pas avec les mêmes mots.
 *
 * Les phrases de refus d'adhésion sont reprises de `web.ts` : elles répondent
 * aux codes que lève `rejoindre_une_communaute`, et deux formulations pour un
 * même code diraient deux choses d'une seule réalité.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    kicker: 'INVITATION PRIVÉE',
    tandemTitle: 'Ton tandem commence ici.',
    communityTitle: 'Une communauté t’ouvre sa porte.',
    checking: 'Vérification de ton invitation…',
    incomplete: 'Cette invitation est incomplète.',
    signInPrompt: 'Connecte-toi pour accepter : ton invitation est gardée jusque-là.',
    tandemAccepted: 'Invitation acceptée. Ton tandem est actif.',
    tandemRefused: 'Cette invitation est invalide ou expirée.',
    communityJoined: 'Te voilà rattaché·e à la communauté. La vie de groupe — cohortes, mentors — se retrouve sur le site.',
    continue: 'Continuer',
    joinRefusedNotFound: 'Ce lien n’est plus valide.',
    joinRefusedExhausted: 'Ce lien a fait entrer tout le monde qu’il pouvait. Demandes-en un autre.',
    joinRefusedInactive: 'Cette communauté n’est pas encore activée.',
    joinRefusedClosed: 'Cette cohorte a été clôturée.',
    joinRefusedEnded: 'Cette cohorte est terminée.',
    joinRefusedRevoked: 'Ton adhésion a été retirée. Adresse-toi au responsable de la communauté.',
    joinRefusedAlready: 'Tu appartiens déjà à une communauté.',
    joinRefusedUnknown: 'Quelque chose n’a pas fonctionné. Réessaie dans un instant.',
  },
  en: {
    ...sharedLabels.en,
    kicker: 'PRIVATE INVITATION',
    tandemTitle: 'Your tandem starts here.',
    communityTitle: 'A community is opening its door.',
    checking: 'Checking your invitation…',
    incomplete: 'This invitation is incomplete.',
    signInPrompt: 'Sign in to accept: your invitation is kept until then.',
    tandemAccepted: 'Invitation accepted. Your tandem is active.',
    tandemRefused: 'This invitation is invalid or expired.',
    communityJoined: 'You are now part of the community. Group life — cohorts, mentors — lives on the website.',
    continue: 'Continue',
    joinRefusedNotFound: 'This link is no longer valid.',
    joinRefusedExhausted: 'This link has brought in everyone it could. Ask for another one.',
    joinRefusedInactive: 'This community is not activated yet.',
    joinRefusedClosed: 'This cohort has been closed.',
    joinRefusedEnded: 'This cohort has ended.',
    joinRefusedRevoked: 'Your membership was removed. Please talk to the community lead.',
    joinRefusedAlready: 'You already belong to a community.',
    joinRefusedUnknown: 'Something did not work. Try again in a moment.',
  },
} as const
