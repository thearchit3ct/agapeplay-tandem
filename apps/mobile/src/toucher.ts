/**
 * Le retour haptique : une grammaire de quatre nuances, et la discipline de ne
 * pas en mettre partout.
 *
 * Une application qui vibre à chaque appui devient une application qu'on met en
 * silencieux. La règle tenue ici : **on ne vibre que sur un geste qui engage, et
 * jamais sur une navigation.** Ouvrir un écran, changer d'onglet, changer de
 * langue, ouvrir une feuille, annuler : rien. Un onglet qui vibre, c'est un
 * téléphone qui bourdonne toute la soirée.
 *
 * ## La grammaire — quel geste mérite quoi
 *
 * Elle se lit en deux questions. *Est-ce que quelque chose s'est passé, ou est-ce
 * que quelque chose a échoué ?* — cela choisit entre les impacts et les
 * notifications. *Est-ce ordinaire ou est-ce grave ?* — cela choisit l'intensité.
 *
 * | Nuance             | Famille système        | Ce qu'elle dit                | Où elle est appelée aujourd'hui |
 * |--------------------|------------------------|-------------------------------|---------------------------------|
 * | `toucherLeger`     | impact léger           | quelque chose est **parti**   | message envoyé, entrée de journal écrite, partage posé ou retiré, rappel basculé |
 * | `toucherAbouti`    | notification succès    | quelque chose s'est **achevé**| séance terminée, bilan de semaine posé |
 * | `toucherRefus`     | notification avertissement | quelque chose a été **refusé** | blocage ou déblocage sans effet, envoi qui n'aboutit pas, écriture repoussée |
 * | `toucherGrave`     | impact lourd           | un geste de **protection**    | bloquer, débloquer, signaler, supprimer une entrée |
 *
 * **Pourquoi `toucherRefus` est arrivé le 28/08/2026.** Les trois premières
 * nuances existaient ; l'échec, lui, était muet. Or c'est le moment où le retour
 * physique sert le plus : quelqu'un qui vient d'appuyer sur « Bloquer » et dont
 * l'écriture a été refusée en silence par la politique reçoit une phrase — mais
 * il a déjà rangé son téléphone. Une vibration d'avertissement le rattrape. Elle
 * ne remplace jamais la phrase : elle la précède.
 *
 * **Pourquoi le déblocage vibre maintenant, et pas avant.** Le blocage vibrait,
 * le déblocage non — la même relation, deux poids. Rouvrir une conversation
 * qu'on avait fermée est le même ordre de geste que la fermer ; c'est même
 * souvent le plus difficile des deux.
 *
 * **Ce que la grammaire interdit.** Vibrer sur l'appui plutôt que sur la
 * réponse. Toutes les nuances ci-dessous sont appelées **après** que le serveur
 * a rendu sa ligne — jamais au moment où le doigt touche. Ce que la main doit
 * sentir, c'est que la chose est faite, pas qu'on l'a demandée. Un futur écran
 * qui vibrerait à l'appui mentirait à la main dès la première coupure réseau.
 *
 * Rien n'est attendu : une vibration qui échoue ne doit jamais retarder ni
 * empêcher l'action qu'elle accompagne. D'où le `void` et le rattrapage muet —
 * l'appareil peut n'avoir aucun moteur haptique, et ce n'est pas une erreur.
 */
import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

// Sous `react-native-web` il n'y a pas de moteur haptique, et `mobile:export`
// passe par là : la garde évite d'appeler un module qui n'a rien à faire.
const surAppareil = Platform.OS === 'ios' || Platform.OS === 'android'

const vibrer = (jouer: () => Promise<void>) => {
  if (!surAppareil) return
  void jouer().catch(() => {})
}

/** Quelque chose est parti : un message, une entrée, un partage. */
export const toucherLeger = () => vibrer(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))

/** Quelque chose s'est achevé : une séance terminée, un bilan posé. */
export const toucherAbouti = () => vibrer(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))

/**
 * Quelque chose a été refusé : une écriture que la politique a repoussée, un
 * envoi qui n'est pas parti. Avertissement, et non erreur : `Error` est la
 * secousse d'une panne, alors qu'ici le système a fonctionné — il a dit non.
 */
export const toucherRefus = () => vibrer(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))

/** Un geste de protection : bloquer, débloquer, signaler, supprimer. */
export const toucherGrave = () => vibrer(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
