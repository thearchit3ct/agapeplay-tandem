/**
 * Textes de l'écran tandem mobile.
 *
 * L'écran était en français en dur jusqu'au 06/08/2026 : c'était tenable tant
 * qu'il n'affichait qu'une maquette. Le déblocage change la donne — on n'annonce
 * pas dans une langue qu'on ne comprend pas qu'une conversation reprend, ni
 * qu'un blocage ne peut être levé que par le support.
 *
 * Ce n'est pas un sous-ensemble de web.ts, pour la même raison que
 * mobile-home.ts n'en est pas un : les phrases mobiles sont plus courtes, et
 * l'écran dit des choses que le web ne dit pas. Les clés de blocage, elles,
 * disent volontairement la même chose des deux côtés — c'est la même règle,
 * elle mérite la même promesse.
 *
 * Le fil et le composeur sont arrivés le 24/08/2026. `emptyThread` annonçait
 * jusque-là que « la conversation s'écrit sur le web » : c'était vrai, ça ne
 * l'est plus. Deux textes nouveaux valent d'être lus deux fois :
 *
 * - `threadClosed` existe parce que la politique de lecture filtre en silence.
 *   Une personne bloquée reçoit zéro message et aucune erreur ; sans cette
 *   phrase, elle verrait « rien encore » à la place de la vérité.
 * - `sendError` ne dit pas la même chose que `composerClosed`. Le web répond
 *   `messageUnavailable` à un envoi raté parce qu'il l'a mis dans sa file
 *   hors-ligne ; le mobile n'a pas de file pour les messages, alors il dit que
 *   le message n'est pas parti et laisse la saisie en place.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    kicker: 'CONVERSATION PRIVÉE',
    title: 'Ton tandem',
    online: 'En ligne',
    blockedStatus: 'Bloqué',
    emptyThread: 'Rien encore. Le premier mot peut être le tien.',
    threadClosed: 'Cette conversation est bloquée : son historique ne t’est plus lisible.',
    composerPlaceholder: 'Un mot pour ton tandem…',
    composerClosed: 'On ne peut plus écrire ici.',
    send: 'Envoyer',
    sending: 'Envoi…',
    sendError: 'Ton message n’est pas parti. Réessaie dans un moment.',
    me: 'Toi',
    privacyNote: 'Les échanges restent privés entre vous.',
    loading: 'On récupère ton tandem…',
    signInPrompt: 'Connecte-toi pour retrouver ton tandem.',
    noTandem: 'Tu n’as pas encore de tandem.',
    syncError: 'On n’a pas réussi à joindre le serveur. Réessaie dans un moment.',
    unblock: 'Lever le blocage',
    unblockOwnerNote: 'Tu as bloqué cette relation. Toi seul peux la lever.',
    unblockOtherNote: 'Cette relation a été bloquée par ton tandem. Seule la personne qui a posé le blocage peut la lever.',
    unblockFrozenNote: 'Ce blocage a été posé avant notre mise à jour de sécurité : l’application ne sait plus qui l’a posé, et ne peut donc le lever pour personne. Écris à contact@agapeplay.com pour qu’une personne s’en charge.',
    unblockTitle: 'Lever ce blocage ?',
    unblockDescription: 'La conversation redevient possible dans les deux sens : vous pourrez de nouveau vous écrire, et l’historique redevient lisible pour vous deux.',
    unblockReversible: 'Rien n’est définitif : tu pourras bloquer de nouveau quand tu le veux.',
    unblockConfirm: 'Oui, lever le blocage',
    unblockCancel: 'Non, garder le blocage',
    unblockedNotice: 'Le blocage est levé. La conversation reprend.',
  },
  en: {
    ...sharedLabels.en,
    kicker: 'PRIVATE CONVERSATION',
    title: 'Your tandem',
    online: 'Online',
    blockedStatus: 'Blocked',
    emptyThread: 'Nothing yet. The first word can be yours.',
    threadClosed: 'This conversation is blocked: its history is no longer readable for you.',
    composerPlaceholder: 'A word for your tandem…',
    composerClosed: 'No one can write here any more.',
    send: 'Send',
    sending: 'Sending…',
    sendError: 'Your message did not go through. Try again in a moment.',
    me: 'You',
    privacyNote: 'What you share stays between the two of you.',
    loading: 'Fetching your tandem…',
    signInPrompt: 'Sign in to find your tandem again.',
    noTandem: 'You do not have a tandem yet.',
    syncError: 'We could not reach the server. Try again in a moment.',
    unblock: 'Lift the block',
    unblockOwnerNote: 'You blocked this relationship. Only you can lift it.',
    unblockOtherNote: 'Your tandem blocked this relationship. Only the person who set the block can lift it.',
    unblockFrozenNote: 'This block was set before our security update: the app no longer knows who set it, so it cannot lift it for anyone. Write to contact@agapeplay.com and someone will take care of it.',
    unblockTitle: 'Lift this block?',
    unblockDescription: 'The conversation becomes possible again both ways: you will be able to write to each other, and the history becomes readable again for both of you.',
    unblockReversible: 'Nothing is final: you can block again whenever you want.',
    unblockConfirm: 'Yes, lift the block',
    unblockCancel: 'No, keep the block',
    unblockedNotice: 'The block is lifted. The conversation resumes.',
  },
} as const
