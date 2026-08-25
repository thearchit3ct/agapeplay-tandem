/**
 * Supprimer son compte : la confirmation, devenue une feuille du système.
 *
 * Les cinq phrases sont celles du panneau, dans le même ordre, et ce sont les
 * mêmes que le navigateur affiche : ce qui disparaît, ce qui reste, le sort d'un
 * blocage, la fermeture des sessions, puis la proposition d'emporter ses données
 * d'abord — la seule chose encore réversible à ce moment-là. Ce ne sont pas des
 * libellés, ce sont des engagements ; aucun n'a été réécrit pour tenir dans une
 * feuille.
 *
 * L'appel à `supprimer_mon_compte()`, la purge du téléphone, la vibration lourde
 * et le retour à l'accueil restent dans `compte.tsx`.
 *
 * **La feuille se referme avant l'appel**, et c'est délibéré : l'écran de compte
 * termine par un `router.replace('/')`, et remplacer la pile pendant qu'une
 * feuille y est encore présentée est le seul enchaînement de routage que ce
 * chantier pouvait casser. La contrepartie est nommée : si la suppression
 * échoue, la phrase d'échec apparaît sur l'écran de compte, retrouvé tel qu'on
 * l'avait laissé — et le geste peut être repris.
 */
import { router } from 'expo-router'
import { Pressable, Text } from 'react-native'
import { Appui } from '@/appui'
import { copy } from '@agapeplay/content/copy/mobile-compte'
import { ondeClaire, toucheMinimale } from '@/theme'
import { CoquilleDeFeuille, traitsDeFeuille as traits } from '@/coquille'
import { declencherFeuille } from '@/feuilles'
import { useLangue } from '@/langue'

export default function FeuilleDeSuppression() {
  const { langue } = useLangue()
  const t = copy[langue]

  const confirmer = () => {
    router.back()
    void declencherFeuille('suppression-compte', undefined)
  }

  return <CoquilleDeFeuille nom="suppression-compte" titre={t.deleteAccount.toUpperCase()}>
    <Text style={traits.titre}>{t.deleteConfirmTitle}</Text>
    <Text style={traits.texte}>{t.deleteConfirmErases}</Text>
    <Text style={traits.texte}>{t.deleteConfirmKeeps}</Text>
    <Text style={traits.texte}>{t.deleteConfirmBlocked}</Text>
    <Text style={traits.texte}>{t.deleteConfirmSession}</Text>
    <Text style={traits.note}>{t.deleteConfirmExportFirst}</Text>
    <Appui accessibilityRole="button" android_ripple={ondeClaire} style={({ pressed }) => [traits.action, pressed && traits.presse]} onPress={confirmer}>
      <Text style={traits.actionTexte}>{t.deleteConfirm}  →</Text>
    </Appui>
    <Pressable accessibilityRole="button" style={toucheMinimale} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[traits.annuler, pressed && traits.presse]}>{t.deleteCancel}</Text>}
    </Pressable>
  </CoquilleDeFeuille>
}
