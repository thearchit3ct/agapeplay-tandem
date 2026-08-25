/**
 * Textes du journal mobile — issue #13.
 *
 * Les phrases du partage sont **reprises telles quelles de `web.ts`** : ce sont
 * les mêmes gestes sur les mêmes tables, et une seconde formulation ferait deux
 * promesses là où le produit n'en tient qu'une. Elles ne passent pas par
 * `shared.ts` pour autant — ce fichier-là ne garde que les libellés que les
 * deux applications s'échangent depuis toujours, et y verser vingt clés de
 * partage transformerait une petite garantie en gros index.
 *
 * Ce qui diffère du web, et c'est tout : le mobile n'a pas de file hors-ligne
 * pour le journal, il le dit (`offlineNote`), et son écran n'a pas la place de
 * la note longue sur le retrait de partage — elle s'affiche sous l'entrée
 * concernée plutôt qu'en tête de page.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    kicker: 'JOURNAL PRIVÉ',
    title: 'Ce que tu gardes',
    intro: 'Ton journal est un espace à toi. Rien ne sera partagé sans ton choix.',
    placeholder: 'Écris ce que tu veux garder de ce jour…',
    save: 'Garder dans mon journal',
    saving: 'Enregistrement…',
    saved: 'Ajouté à ton journal',
    saveFailed: 'Ça n’a pas été enregistré. Ton texte est resté là où tu l’as écrit.',
    present: 'Présent',
    empty: 'Rien pour l’instant. La première ligne est souvent la plus courte.',
    loadFailed: 'Ton journal n’a pas pu être lu. Rien n’est perdu : réessaie dans un moment.',
    signInPrompt: 'Connecte-toi pour écrire et retrouver ton journal.',
    offlineNote: 'Écrire, partager et supprimer demandent la connexion.',
    deleteEntry: 'Supprimer cette entrée',
    deleteEntryDone: 'Entrée supprimée.',
    deleteEntryRefused: 'Rien n’a été supprimé : cette entrée n’a pas bougé.',
    deleteEntryConfirm: 'Supprimer pour de bon',
    deleteEntryCancel: 'Non, la garder',
    deleteEntryWarning: 'C’est définitif, et le partage posé dessus part avec elle.',
    shareEntry: 'Partager avec mon binôme',
    unshareEntry: 'Retirer le partage',
    sharedEntry: 'Partagé avec ton binôme',
    shareEntryDone: 'Ton binôme peut lire cette entrée.',
    unshareEntryDone: 'Partage retiré. Ton binôme ne lit plus cette entrée.',
    unshareEntryReminder: 'Retirer un partage ferme la suite : ce que ton binôme a déjà lu, il l’a lu.',
    shareEntryFailed: 'Le partage n’a pas abouti. Rien n’a changé.',
    unshareEntryRefused: 'Rien n’a été retiré : ce partage n’est plus le tien.',
    shareNoTandem: 'Personne à qui partager pour l’instant. Invite ton binôme depuis l’écran Tandem.',
    shareBlockedNote: 'La relation est bloquée : tes partages sont refermés, des deux côtés. Ils rouvriront si le blocage est levé.',
    shareEndedNote: 'La relation est terminée : tes partages ne s’ouvrent plus.',
    sharedWithMe: 'Ce que ton binôme t’a partagé',
    sharedWithMeEmpty: 'Rien pour l’instant. Ton binôme choisit, entrée par entrée, ce qu’il te donne à lire.',
    sharedWithMeClosed: 'Les partages de journal restent fermés tant que la relation l’est. Rien n’est perdu : ce n’est simplement plus lisible ici.',
    sharedOn: 'Partagé le',
  },
  en: {
    ...sharedLabels.en,
    kicker: 'PRIVATE JOURNAL',
    title: 'What you keep',
    intro: 'Your journal is yours. Nothing is shared without your choice.',
    placeholder: 'Write what you want to keep from today…',
    save: 'Keep in my journal',
    saving: 'Saving…',
    saved: 'Added to your journal',
    saveFailed: 'That was not saved. Your text stayed where you wrote it.',
    present: 'Present',
    empty: 'Nothing yet. The first line is often the shortest.',
    loadFailed: 'Your journal could not be read. Nothing is lost: try again in a moment.',
    signInPrompt: 'Sign in to write and find your journal again.',
    offlineNote: 'Writing, sharing and deleting need a connection.',
    deleteEntry: 'Delete this entry',
    deleteEntryDone: 'Entry deleted.',
    deleteEntryRefused: 'Nothing was deleted: this entry has not moved.',
    deleteEntryConfirm: 'Delete for good',
    deleteEntryCancel: 'No, keep it',
    deleteEntryWarning: 'This is permanent, and the share you granted goes with it.',
    shareEntry: 'Share with my partner',
    unshareEntry: 'Stop sharing',
    sharedEntry: 'Shared with your partner',
    shareEntryDone: 'Your partner can read this entry.',
    unshareEntryDone: 'Sharing withdrawn. Your partner no longer reads this entry.',
    unshareEntryReminder: 'Withdrawing closes what comes next: what your partner already read, they read.',
    shareEntryFailed: 'Sharing did not go through. Nothing changed.',
    unshareEntryRefused: 'Nothing was withdrawn: this share is no longer yours.',
    shareNoTandem: 'Nobody to share with yet. Invite your partner from the Tandem screen.',
    shareBlockedNote: 'This relationship is blocked: your shares are closed, on both sides. They reopen if the block is lifted.',
    shareEndedNote: 'This relationship has ended: your shares no longer open.',
    sharedWithMe: 'What your partner shared with you',
    sharedWithMeEmpty: 'Nothing yet. Your partner chooses, entry by entry, what they give you to read.',
    sharedWithMeClosed: 'Journal shares stay closed while the relationship is. Nothing is lost: it simply is not readable here.',
    sharedOn: 'Shared on',
  },
} as const
