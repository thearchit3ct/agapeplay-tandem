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
 *
 * `loading` a disparu le 27/08/2026 : l'écran montre désormais la forme du fil
 * pendant sa lecture (voir `src/squelette.tsx`) plutôt que d'annoncer qu'il
 * cherche. `emptyThread`, `threadClosed` et `noTandem` restent : ce sont des
 * réponses, pas des attentes, et la nuance est tout l'objet de ces trois-là.
 *
 * Bloquer et signaler sont arrivés le 24/08/2026. Trois choses sur ces clés :
 *
 * - Les libellés des deux gestes et leurs deux réponses (`report`, `block`,
 *   `reportSent`, `blockedNotice`) reprennent **mot pour mot** ceux du web :
 *   c'est la même promesse faite à la même personne, elle ne se reformule pas
 *   d'un appareil à l'autre.
 * - Les textes de confirmation du blocage (`blockTitle` … `blockCancel`)
 *   n'existent que côté mobile, parce que le geste y demande une confirmation
 *   que le web ne demande pas. Ils sont calqués sur ceux du déblocage : ce
 *   qu'on va changer, puis ce qui reste réversible.
 * - `blockRefused` et `unblockRefused` disent un cas qu'aucune erreur ne
 *   signale : un UPDATE refusé par un `using` ne lève rien, il touche zéro
 *   ligne. Sans ces deux phrases, l'écran annoncerait un blocage que le serveur
 *   n'a pas posé. `syncError` ne convient pas — le serveur a bien répondu.
 *
 * Le motif du signalement, lui, a changé de nature le 25/08/2026 (issue #19).
 * Il partait jusque-là en français littéral dans `reason` — « Signalement depuis
 * la conversation » — et ce commentaire disait à raison qu'il n'avait rien à
 * faire dans un catalogue de textes : c'était une donnée, pas une interface.
 *
 * Ce qui part en base est maintenant un **code** (`malaise`, `secret`,
 * `danger`…) que la migration `20260825173000` énumère, et un mot libre
 * facultatif écrit par la personne. Les libellés de ces codes sont donc, eux,
 * de l'interface pure, et ils sont ici, traduits, à parité — tandis que la
 * donnée reste invariante quelle que soit la langue de l'écran. C'est
 * exactement ce que l'ancienne rédaction cherchait à protéger.
 *
 * Ces libellés reprennent mot pour mot ceux du web, pour la même raison que
 * `report` et `block` : c'est la même question posée à la même personne.
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
    unblockRefused: 'Le blocage n’a pas été levé. Reviens sur cet écran pour voir où en est la relation.',
    report: 'Signaler un problème',
    reportSent: 'Signalement transmis à la modération.',
    reporting: 'Envoi du signalement…',
    // Le signalement qualifié — issue #19. Repris mot pour mot du web : la
    // question est la même, et un adolescent qui passe du téléphone au
    // navigateur ne doit pas avoir l'impression de changer de produit.
    reportTitle: 'Que se passe-t-il ?',
    reportDescription: 'Choisis ce qui ressemble le plus à ta situation. Un modérateur d’AgapePlay le lira. Ni ton église, ni la personne concernée ne sauront que tu as signalé.',
    reportNoteLabel: 'Tu peux ajouter un mot si tu veux',
    reportNotePlaceholder: 'Avec tes mots, si tu en as envie…',
    reportConfirm: 'Envoyer le signalement',
    reportCancel: 'Annuler',
    reportUrgentNote: 'Ce que tu viens de choisir place ce signalement en tête de la file.',
    reportHelplineNote: 'Si quelqu’un est en danger maintenant, appelle le 119 (enfance en danger) ou le 17. Cette application ne remplace pas un secours et personne n’y répond la nuit.',
    categoryMalaise: 'Des propos qui me mettent mal à l’aise',
    categoryInsistance: 'On insiste alors que j’ai dit non',
    categorySecret: 'On me demande de garder ça pour moi, ou d’en parler ailleurs',
    categorySexuel: 'Des propos ou des images à caractère sexuel',
    categoryDanger: 'Quelqu’un est en danger',
    categoryAutre: 'Autre chose',

    block: 'Bloquer cette relation',
    blockedNotice: 'Cette relation est maintenant bloquée.',
    blockRefused: 'Le blocage n’a pas été posé. Reviens sur cet écran pour voir où en est la relation.',
    blockTitle: 'Bloquer cette relation ?',
    blockDescription: 'Vous ne pourrez plus vous écrire. L’historique restera lisible pour toi, plus pour l’autre.',
    blockReversible: 'Toi seul pourras lever ce blocage, quand tu le voudras.',
    blockConfirm: 'Oui, bloquer',
    blockCancel: 'Non, ne rien changer',
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
    unblockRefused: 'The block was not lifted. Come back to this screen to see where the relationship stands.',
    report: 'Report a problem',
    reportSent: 'Report sent to moderation.',
    reporting: 'Sending the report…',
    // Word for word from web.ts — see the French block.
    reportTitle: 'What is happening?',
    reportDescription: 'Pick whatever comes closest to your situation. An AgapePlay moderator will read it. Neither your church nor the person involved will know that you reported.',
    reportNoteLabel: 'You can add a word if you want to',
    reportNotePlaceholder: 'In your own words, if you feel like it…',
    reportConfirm: 'Send the report',
    reportCancel: 'Cancel',
    reportUrgentNote: 'What you just picked puts this report at the front of the queue.',
    reportHelplineNote: 'If someone is in danger right now, call 119 (child protection, France) or 17. This app is not an emergency service, and nobody is watching it at night.',
    categoryMalaise: 'Things that are said make me uncomfortable',
    categoryInsistance: 'Someone keeps pushing after I said no',
    categorySecret: 'Someone asks me to keep this to myself, or to talk elsewhere',
    categorySexuel: 'Sexual words or images',
    categoryDanger: 'Someone is in danger',
    categoryAutre: 'Something else',

    block: 'Block this relationship',
    blockedNotice: 'This relationship is now blocked.',
    blockRefused: 'The block was not set. Come back to this screen to see where the relationship stands.',
    blockTitle: 'Block this relationship?',
    blockDescription: 'Neither of you will be able to write any more. The history stays readable for you, not for the other person.',
    blockReversible: 'Only you will be able to lift this block, whenever you want.',
    blockConfirm: 'Yes, block',
    blockCancel: 'No, change nothing',
  },
} as const
