/**
 * Rouvrir la conversation : la confirmation, devenue une feuille du système.
 *
 * Mêmes phrases, même ordre et même geste que le panneau qu'elle remplace ; ce
 * qui décide de qui a le droit de lever un blocage reste `unblockAffordance`,
 * dans le domaine, et l'écriture reste dans `(onglets)/tandem.tsx`.
 *
 * Cette feuille n'est atteignable que depuis le bouton que l'écran n'affiche
 * qu'à qui peut débloquer : elle ne redemande donc pas au domaine ce qu'il a
 * déjà tranché — deux endroits qui décident la même chose finissent par ne plus
 * décider pareil.
 */
import { router } from 'expo-router'
import { Pressable, Text } from 'react-native'
import { Appui } from '@/appui'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { ondeClaire, toucheMinimale } from '@/theme'
import { CoquilleDeFeuille, traitsDeFeuille as traits } from '@/coquille'
import { declencherFeuille } from '@/feuilles'
import { useLangue } from '@/langue'

export default function FeuilleDeDeblocage() {
  const { langue } = useLangue()
  const t = copy[langue]

  const confirmer = () => {
    router.back()
    void declencherFeuille('deblocage', undefined)
  }

  return <CoquilleDeFeuille nom="deblocage" titre={t.unblockTitle.toUpperCase()}>
    <Text style={traits.texte}>{t.unblockDescription}</Text>
    <Text style={traits.texte}>{t.unblockReversible}</Text>
    <Appui accessibilityRole="button" android_ripple={ondeClaire} style={({ pressed }) => [traits.action, pressed && traits.presse]} onPress={confirmer}>
      <Text style={traits.actionTexte}>{t.unblockConfirm}  →</Text>
    </Appui>
    <Pressable accessibilityRole="button" style={toucheMinimale} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[traits.annuler, pressed && traits.presse]}>{t.unblockCancel}</Text>}
    </Pressable>
  </CoquilleDeFeuille>
}
