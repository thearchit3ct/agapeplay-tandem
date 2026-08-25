/**
 * Le retour haptique : trois vibrations, et la discipline de ne pas en mettre
 * partout.
 *
 * Une application qui vibre à chaque appui devient une application qu'on met
 * en silencieux. La règle tenue ici : **on ne vibre que sur un geste qui
 * engage** — un message parti, une séance terminée, un bilan répondu, une
 * entrée ouverte à son binôme, un blocage ou un signalement. Naviguer, ouvrir
 * un panneau, changer de langue, annuler : rien. Le tableau des appels vit
 * dans la PR et dans docs/21.
 *
 * Trois nuances, et pas une de plus :
 *
 * - `toucherLeger` — quelque chose est parti (message, entrée, partage) ;
 * - `toucherAbouti` — quelque chose s'est achevé (séance terminée, bilan posé) ;
 * - `toucherGrave` — un geste de protection (bloquer, signaler). Plus lourd
 *   parce que ce n'est pas un geste ordinaire, et que la main doit le savoir.
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

/** Un geste de protection : bloquer, signaler. */
export const toucherGrave = () => vibrer(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
