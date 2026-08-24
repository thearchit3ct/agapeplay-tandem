import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { useAuthDeepLink } from '@/authDeepLink'
import { StatusBar } from 'expo-status-bar'

// Les notifications à distance sont RETIRÉES d'Expo Go depuis le SDK 53 :
// initialiser expo-notifications y jette une erreur au chargement du module,
// et comme ce fichier est la racine des routes, l'erreur faisait croire à
// expo-router que le layout n'exportait rien — tout l'arbre d'écrans partait
// en « missing default export ». Mesuré sur appareil le 24/08/2026 (première
// séance réelle du mobile). D'où le require sous garde : dans Expo Go, le
// module n'est même pas évalué ; dans un build de développement ou de
// production, le comportement est inchangé.
const dansExpoGo = Constants.executionEnvironment === 'storeClient'
if (!dansExpoGo) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as typeof import('expo-notifications')
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  })
}

export default function RootLayout() {
  useAuthDeepLink()
  return <>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  </>
}
