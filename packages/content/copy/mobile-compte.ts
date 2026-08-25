/**
 * Textes de l'écran « Mon compte » du mobile — issue #13.
 *
 * Les phrases de la suppression sont **reprises mot pour mot de `web.ts`**, et
 * ce n'est pas de la paresse : elles énumèrent ce qui part, ce qui reste et ce
 * qu'il advient d'un blocage. Ce sont des engagements, relus comme tels ; les
 * réécrire « pour le mobile » ferait deux promesses là où la base n'exécute
 * qu'une seule fonction, `supprimer_mon_compte()`.
 *
 * Ce qui diffère du web, et c'est tout : le fichier d'export ne se télécharge
 * pas, il passe par la feuille de partage du téléphone — `exportReady` le dit
 * autrement, et c'est la seule clé de cette page qui ne pouvait pas être
 * copiée.
 */

import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    kicker: 'MON COMPTE',
    title: 'Ce que tu peux emporter, ou fermer',
    signInPrompt: 'Connecte-toi pour retrouver ces gestes.',
    account: 'Compte connecté',
    exportData: 'Emporter mes données',
    exportDescription: 'Un fichier avec ton profil, ta progression, ton journal, tes bilans, les partages que tu as posés, les messages que tu as envoyés et tes invitations.',
    exportWorking: 'Rassemblement de tes données…',
    exportReady: 'Ton fichier est prêt : choisis où le ranger.',
    exportFailed: 'On n’a pas pu rassembler toutes tes données. Aucun fichier n’a été créé : réessaie dans un moment.',
    exportNoSharing: 'Ce téléphone ne propose pas de partage de fichier : rien n’a pu t’être remis.',
    signOutEverywhere: 'Me déconnecter partout',
    signedOutEverywhere: 'Tu es déconnecté·e de tous tes appareils.',
    signOutFailed: 'La déconnexion n’a pas abouti. Réessaie dans un moment.',
    deleteAccount: 'Supprimer mon compte',
    deleteAccountDescription: 'C’est définitif. Le panneau suivant dit exactement ce qui disparaît et ce qui reste.',
    deleteConfirmTitle: 'Supprimer ton compte, pour de bon',
    deleteConfirmErases: 'Ce qui disparaît : ton nom, ton adresse e-mail, ton journal, ta progression, tes préférences et tes invitations.',
    deleteConfirmKeeps: 'Ce qui reste : les messages que tu as envoyés restent dans la conversation de ton binôme. Ton nom, lui, disparaît : son écran indiquera que ce compte a été supprimé. Un signalement déjà déposé reste aussi, parce qu’il protège quelqu’un.',
    deleteConfirmBlocked: 'Si tu as bloqué quelqu’un, le blocage tient toujours après ton départ.',
    deleteConfirmSession: 'Tu seras déconnecté·e de tous tes appareils et ce compte ne pourra plus se connecter. Tu pourras revenir un jour avec la même adresse : ce sera un compte neuf, vide.',
    deleteConfirmExportFirst: 'Tu veux garder une trace ? Emporte tes données avant.',
    deleteConfirm: 'Supprimer définitivement',
    deleteCancel: 'Non, revenir en arrière',
    deleteWorking: 'Suppression en cours…',
    deleteDone: 'Ton compte est supprimé.',
    deleteFailed: 'La suppression n’a pas abouti : rien n’a été supprimé. Réessaie, ou écris-nous.',
  },
  en: {
    ...sharedLabels.en,
    kicker: 'MY ACCOUNT',
    title: 'What you can take, or close',
    signInPrompt: 'Sign in to find these actions.',
    account: 'Signed-in account',
    exportData: 'Take my data with me',
    exportDescription: 'One file with your profile, your progress, your journal, your check-ins, the shares you granted, the messages you sent and your invitations.',
    exportWorking: 'Gathering your data…',
    exportReady: 'Your file is ready: choose where to keep it.',
    exportFailed: 'We could not gather all of your data. No file was created — try again in a moment.',
    exportNoSharing: 'This phone offers no way to share a file: nothing could be handed to you.',
    signOutEverywhere: 'Sign out everywhere',
    signedOutEverywhere: 'You are signed out on all your devices.',
    signOutFailed: 'Signing out did not go through. Try again in a moment.',
    deleteAccount: 'Delete my account',
    deleteAccountDescription: 'This is permanent. The next panel says exactly what goes and what stays.',
    deleteConfirmTitle: 'Delete your account, for good',
    deleteConfirmErases: 'What goes: your name, your email address, your journal, your progress, your preferences and your invitations.',
    deleteConfirmKeeps: 'What stays: the messages you sent stay in your partner’s conversation. Your name does not: their screen will say this account was deleted. A report already filed stays too, because it protects someone.',
    deleteConfirmBlocked: 'If you blocked someone, that block still holds after you leave.',
    deleteConfirmSession: 'You will be signed out on every device, and this account will not be able to sign in again. You can come back one day with the same address: it will be a new, empty account.',
    deleteConfirmExportFirst: 'Want to keep a copy? Take your data with you first.',
    deleteConfirm: 'Delete permanently',
    deleteCancel: 'No, take me back',
    deleteWorking: 'Deleting…',
    deleteDone: 'Your account is deleted.',
    deleteFailed: 'The deletion did not go through: nothing was deleted. Try again, or write to us.',
  },
} as const
