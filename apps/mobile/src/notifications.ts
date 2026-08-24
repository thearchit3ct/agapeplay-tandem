import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { stockage } from './storage'

const preferenceKey = 'agapeplay:tandem:daily-reminder'
const reminderIdKey = 'agapeplay:tandem:daily-reminder-id'

/**
 * expo-notifications, chargée seulement au moment d'agir — et jamais dans
 * Expo Go, où l'IMPORT SEUL jette : le module embarque un effet de bord
 * (`DevicePushTokenAutoRegistration.fx`) qui enregistre un écouteur de jeton
 * push, fonctionnalité retirée d'Expo Go depuis le SDK 53. Mesuré sur
 * appareil le 24/08/2026 : l'import statique faisait échouer l'évaluation de
 * `app/index.tsx` tout entier — l'écran d'accueil partait en « missing
 * default export » pour une bibliothèque dont il ne se sert qu'à la demande.
 *
 * Le rappel quotidien est donc simplement indisponible dans Expo Go, et
 * `setDailyReminder` répond `false` — ce que l'écran sait déjà dire. Dans un
 * build de développement ou de production, rien ne change.
 */
const chargerNotifications = () => {
  // Le try/catch seul ne suffit PAS : l'erreur jaillit pendant l'évaluation du
  // module par Metro, qui la signale au gestionnaire global AVANT de la
  // relancer vers l'appelant — l'écran affichait donc un plein-écran d'erreur
  // même avec l'appel encapsulé (mesuré au premier appui sur l'interrupteur
  // de rappel, 24/08/2026). Dans Expo Go, on ne tente même pas le chargement.
  if (Constants.executionEnvironment === 'storeClient') return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications')
  } catch {
    return null
  }
}

/**
 * AsyncStorage peut manquer côté natif (mesuré : « Native module is null »
 * dans Expo Go 57). Une préférence de rappel qui ne peut pas se lire est une
 * préférence éteinte, pas une erreur d'écran.
 */
export async function readReminderPreference() {
  return (await stockage.getItem(preferenceKey)) === 'true'
}

export async function setDailyReminder(enabled: boolean) {
  const Notifications = chargerNotifications()
  if (!Notifications) return false
  try {
    if (!enabled) {
      const reminderId = await stockage.getItem(reminderIdKey)
      if (reminderId) await Notifications.cancelScheduledNotificationAsync(reminderId)
      await stockage.removeItem(preferenceKey)
      await stockage.removeItem(reminderIdKey)
      return false
    }

    if (!Device.isDevice) return false
    const permission = await Notifications.requestPermissionsAsync()
    if (!permission.granted) return false
    await Notifications.setNotificationChannelAsync('daily-session', { name: 'Séances quotidiennes', importance: Notifications.AndroidImportance.DEFAULT })
    const reminderId = await Notifications.scheduleNotificationAsync({
      content: { title: 'AgapePlay Tandem', body: 'Ton petit pas du jour est prêt.', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 8, minute: 0 },
    })
    await stockage.setItem(preferenceKey, 'true')
    await stockage.setItem(reminderIdKey, reminderId)
    return true
  } catch {
    return false
  }
}
