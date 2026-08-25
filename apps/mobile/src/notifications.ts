/**
 * Les rappels posés sur l'appareil — issue #13, deuxième front.
 *
 * Ce que ce fichier fait, et ce qu'il ne fait pas :
 *
 *   - il pose des notifications **locales**, planifiées par l'application sur
 *     le téléphone. Il n'y a **pas de push serveur** dans ce produit, et ce
 *     n'est pas un provisoire : aucun composant serveur n'existe qui pourrait
 *     décider d'écrire à quelqu'un. `docs/29` le redit à l'attention de qui
 *     lancera la première build ;
 *   - il ne décide de rien. Ce qui doit être planifié se déduit des
 *     préférences du compte, et cette règle vit dans `packages/domain` avec
 *     ses tests (`rappelsAPlanifier`).
 *
 * ---------------------------------------------------------------------------
 * Deux pièges mesurés, et pourquoi le code a cette forme
 * ---------------------------------------------------------------------------
 *
 * **Expo Go.** L'IMPORT SEUL d'`expo-notifications` y jette : le module
 * embarque un effet de bord (`DevicePushTokenAutoRegistration.fx`) qui
 * enregistre un écouteur de jeton push, fonctionnalité retirée d'Expo Go depuis
 * le SDK 53. Mesuré sur appareil le 24/08/2026 : l'import statique faisait
 * échouer l'évaluation de `app/index.tsx` tout entier — l'écran d'accueil
 * partait en « missing default export » pour une bibliothèque dont il ne se
 * sert qu'à la demande. Le `try/catch` seul ne suffit pas : l'erreur jaillit
 * pendant l'évaluation du module par Metro, qui la signale au gestionnaire
 * global AVANT de la relancer vers l'appelant. Dans Expo Go, on ne tente donc
 * même pas le chargement, et `synchroniserRappels` répond « rien de posé ».
 * Les rappels sont réels dans un build de développement ou interne, et c'est
 * la raison d'être d'`eas.json`.
 *
 * **La préférence vit sur le compte, jamais ici.** Jusqu'au 26/08/2026 le
 * rappel de séance était gardé par une clé locale — un second endroit qui
 * disait la même chose que `notification_preferences.sessions`, si bien qu'un
 * rappel coupé depuis le navigateur revenait sur le téléphone. C'est
 * exactement le bug que `mesure.ts` et `bilan.ts` ont déjà corrigé, chacun
 * avec son commentaire. Le stockage local ne garde plus que les identifiants
 * rendus par le système : de la comptabilité d'appareil, pas un réglage.
 */
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { rappelsAPlanifier } from '@agapeplay/domain'
import type { PreferencesDeRappel, RappelPlanifie } from '@agapeplay/domain'
import { CLEFS } from './clefs'
import { stockage } from './storage'

/** Les identifiants rendus par le système, par clef de rappel. */
const CLEF_IDENTIFIANTS = CLEFS.rappelsPoses

/** Le canal Android : un seul, parce que les deux rappels sont la même voix. */
const CANAL = 'rappels'

/** Ce que chaque rappel dit, dans la langue de l'écran qui l'a posé. */
export type TextesDeRappel = Record<RappelPlanifie['clef'], { titre: string; corps: string }>

const chargerNotifications = () => {
  // Voir l'en-tête : dans Expo Go, on ne tente même pas le chargement.
  if (Constants.executionEnvironment === 'storeClient') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications')
  } catch {
    return null
  }
}

const lireIdentifiants = async (): Promise<Partial<Record<RappelPlanifie['clef'], string>>> => {
  const brut = await stockage.getItem(CLEF_IDENTIFIANTS)
  if (!brut) return {}
  try {
    return JSON.parse(brut) as Partial<Record<RappelPlanifie['clef'], string>>
  } catch {
    // Stockage abîmé : on repart de zéro. Le prix est nommé — les rappels
    // déjà posés deviennent inannulables et vivront jusqu'à la
    // désinstallation. C'est le cas rare ; l'inverse (tout annuler à l'aveugle
    // sur l'appareil) toucherait des notifications qui ne sont pas les nôtres.
    return {}
  }
}

const declencheur = (
  rappel: RappelPlanifie,
  Notifications: typeof import('expo-notifications'),
) => {
  if (rappel.cadence === 'quotidienne') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: CANAL,
      hour: rappel.heure,
      minute: rappel.minute,
    }
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    channelId: CANAL,
    // Le domaine parle en jours ISO (lundi = 1, samedi = 6) ; le déclencheur
    // hebdomadaire compte à la façon d'Apple, dimanche = 1. Samedi vaut donc 7
    // ici et 6 là-bas. La conversion tient en une ligne, mais elle ne se
    // devine pas : un rappel posé sur `jourIso` brut tomberait le vendredi.
    weekday: (rappel.jourIso % 7) + 1,
    hour: rappel.heure,
    minute: rappel.minute,
  }
}

/**
 * Aligne ce qui est planifié sur l'appareil avec les préférences du compte.
 *
 * **Tout est annulé, puis reposé.** Pas de calcul de différence : l'appareil
 * est le seul à savoir ce qui traîne réellement dans sa file — une préférence
 * coupée depuis le navigateur, une notification survivante d'une version
 * précédente — et un delta calculé depuis l'application supposerait le
 * contraire.
 *
 * `demanderPermission` sépare les deux appelants, et la distinction n'est pas
 * cosmétique : au chargement de l'écran on se contente de la permission déjà
 * accordée, parce qu'une demande système surgie sans geste est le meilleur
 * moyen d'obtenir un refus définitif. Sur un appui sur l'interrupteur, en
 * revanche, la question est attendue.
 *
 * Rend `true` si la file de l'appareil reflète bien les préférences — y
 * compris quand elles ne demandent aucun rappel. `false` veut dire « ce
 * téléphone ne peut pas », et l'écran le dit plutôt que d'afficher un rappel
 * qui n'existe pas.
 */
export const synchroniserRappels = async (
  preferences: PreferencesDeRappel,
  textes: TextesDeRappel,
  options: { demanderPermission: boolean } = { demanderPermission: false },
): Promise<boolean> => {
  const Notifications = chargerNotifications()
  if (!Notifications) return false

  try {
    // L'annulation vient avant toute question de permission : couper un rappel
    // doit aboutir même sur un téléphone qui a refusé les notifications depuis
    // les réglages du système — sinon un rappel refusé aujourd'hui resterait
    // planifié pour le jour où la permission reviendrait.
    const poses = await lireIdentifiants()
    for (const identifiant of Object.values(poses)) {
      if (identifiant) await Notifications.cancelScheduledNotificationAsync(identifiant)
    }
    await stockage.removeItem(CLEF_IDENTIFIANTS)

    const rappels = rappelsAPlanifier(preferences)
    if (rappels.length === 0) return true

    // Un simulateur ne planifie rien d'utile, et `Device.isDevice` est le seul
    // moyen de le savoir avant d'échouer.
    if (!Device.isDevice) return false

    const etat = options.demanderPermission
      ? await Notifications.requestPermissionsAsync()
      : await Notifications.getPermissionsAsync()
    if (!etat.granted) return false

    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Rappels AgapePlay Tandem',
      importance: Notifications.AndroidImportance.DEFAULT,
    })

    const identifiants: Partial<Record<RappelPlanifie['clef'], string>> = {}
    for (const rappel of rappels) {
      identifiants[rappel.clef] = await Notifications.scheduleNotificationAsync({
        content: {
          title: textes[rappel.clef].titre,
          body: textes[rappel.clef].corps,
          sound: 'default',
        },
        trigger: declencheur(rappel, Notifications),
      })
    }
    // Écrit après coup, et seulement ce que le système a réellement rendu :
    // un identifiant inventé ici serait un rappel qu'on ne saurait plus
    // annuler.
    await stockage.setItem(CLEF_IDENTIFIANTS, JSON.stringify(identifiants))
    return true
  } catch {
    return false
  }
}

/**
 * Efface toute trace de planification sur cet appareil.
 *
 * Appelé par la suppression de compte : les préférences partent côté base, et
 * les notifications déjà posées, elles, vivent dans le système. Sans ce geste,
 * le téléphone continuerait de proposer une séance à un compte qui n'existe
 * plus.
 */
export const oublierLesRappels = async (): Promise<void> => {
  const Notifications = chargerNotifications()
  const poses = await lireIdentifiants()
  await stockage.removeItem(CLEF_IDENTIFIANTS)
  if (!Notifications) return
  try {
    for (const identifiant of Object.values(poses)) {
      if (identifiant) await Notifications.cancelScheduledNotificationAsync(identifiant)
    }
  } catch { /* rien à dire : l'appel ne sert qu'à nettoyer */ }
}
