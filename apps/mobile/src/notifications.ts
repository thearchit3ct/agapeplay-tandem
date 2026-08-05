import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

const preferenceKey = 'agapeplay:tandem:daily-reminder'
const reminderIdKey = 'agapeplay:tandem:daily-reminder-id'

export async function readReminderPreference() {
  return (await AsyncStorage.getItem(preferenceKey)) === 'true'
}

export async function setDailyReminder(enabled: boolean) {
  if (!enabled) {
    const reminderId = await AsyncStorage.getItem(reminderIdKey)
    if (reminderId) await Notifications.cancelScheduledNotificationAsync(reminderId)
    await AsyncStorage.removeItem(preferenceKey)
    await AsyncStorage.removeItem(reminderIdKey)
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
  await AsyncStorage.setItem(preferenceKey, 'true')
  await AsyncStorage.setItem(reminderIdKey, reminderId)
  return true
}
