import Constants from 'expo-constants'
import { Stack } from 'expo-router'
import { useAuthDeepLink } from '@/authDeepLink'
import { useLiensDInvitation } from '@/invitations'
import { FournisseurDeLangue } from '@/langue'
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
  // Les liens d'invitation sont écoutés ici, à côté du retour du lien magique :
  // c'est le seul endroit déjà monté quand l'application s'ouvre à froid sur
  // une URL. Les deux hooks ne se marchent pas dessus — l'un lit le fragment,
  // l'autre la requête (voir `jetonDuLien` et son test).
  useLiensDInvitation()
  // `style="dark"` désigne des icônes sombres, pas un thème sombre : l'écran
  // est crème, il lui faut une barre de statut à l'encre. C'est cohérent avec
  // `userInterfaceStyle: "light"` dans `app.json`, qui disait `"dark"` jusqu'au
  // 25/08/2026 alors que l'application n'a jamais eu de mode sombre.
  //
  // Le fournisseur de langue enveloppe la pile entière depuis le 27/08/2026 :
  // les libellés d'onglets vivent dans un layout, au-dessus des écrans, et ils
  // doivent suivre la même bascule que les écrans eux-mêmes.
  return <FournisseurDeLangue>
    <StatusBar style="dark" />
    {/* `animation: 'fade'` était le second visage du « ça se comporte comme une
        web app » : un fondu entre deux routes est exactement ce que fait un
        site, là où un téléphone glisse l'écran suivant depuis le bord. `default`
        rend l'animation de la plateforme — glissement latéral sur Android,
        poussée iOS — et rétablit du même coup le geste de retour au bord de
        l'écran, que le fondu rendait muet. Le bouton retour matériel d'Android
        suit la même pile et n'a rien à régler ici.

        La pile racine porte désormais deux sortes d'écrans : le groupe
        `(onglets)`, qui est le lieu où l'on habite, et les destinations qu'on
        ouvre puis referme — séance, compte, invitation, connexion. Le groupe
        n'apparaît pas dans les URL : `agapeplay:///` mène toujours à
        `(onglets)/index`, et `/invite?token=…` reste `/invite`. */}
    <Stack screenOptions={{ headerShown: false, animation: 'default' }}>
      {/* Les quatre feuilles de confirmation. `presentation: 'formSheet'` est
          la feuille de bas d'écran du système — Liquid Glass sur iOS 26, et sur
          Android le `BottomSheetBehavior` de Material, tous deux portés par
          react-native-screens. Ce ne sont pas des panneaux JavaScript déguisés :
          la poignée, le glissement pour refermer, l'assombrissement du fond et
          le retour matériel viennent de la plateforme.

          `fitToContents` pour les trois confirmations : elles font quelques
          lignes, et une feuille à demi vide dirait qu'il manque quelque chose.
          Le signalement, lui, porte un formulaire — six catégories, un champ
          libre — et prend une hauteur fixe pour ne pas sauter d'un cran à
          chaque choix. */}
      <Stack.Screen name="feuilles/blocage" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="feuilles/deblocage" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
      <Stack.Screen name="feuilles/signalement" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true }} />
      <Stack.Screen name="feuilles/suppression-compte" options={{ presentation: 'formSheet', sheetAllowedDetents: 'fitToContents', sheetGrabberVisible: true }} />
    </Stack>
  </FournisseurDeLangue>
}
