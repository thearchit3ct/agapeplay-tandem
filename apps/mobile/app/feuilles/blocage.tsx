/**
 * Fermer la conversation : la confirmation, devenue une feuille du système.
 *
 * C'était un encadré poussé dans la page de la conversation. Ce sont **les
 * mêmes trois phrases, dans le même ordre** — ce qui change, ce qui reste
 * réversible, puis la question — et le même geste au bout. Seul le contenant a
 * changé : la plateforme apporte la poignée, le glissement pour refermer,
 * l'assombrissement du fil derrière, et le bouton retour d'Android.
 *
 * L'écriture, elle, n'a pas bougé d'un iota : elle est restée dans
 * `(onglets)/tandem.tsx`, avec sa garde, sa lecture de la ligne rendue, son
 * refus silencieux traité, et sa vibration lourde. Cette feuille ne fait que
 * demander (voir `src/feuilles.ts`).
 *
 * La feuille se referme **avant** l'écriture, comme le panneau le faisait :
 * bloquer quelqu'un n'est pas une opération qu'on regarde tourner.
 */
import { router } from 'expo-router'
import { Pressable, Text } from 'react-native'
import { copy } from '@agapeplay/content/copy/mobile-tandem'
import { ondeClaire, toucheMinimale } from '@/theme'
import { CoquilleDeFeuille, traitsDeFeuille as traits } from '@/coquille'
import { declencherFeuille } from '@/feuilles'
import { useLangue } from '@/langue'

export default function FeuilleDeBlocage() {
  const { langue } = useLangue()
  const t = copy[langue]

  const confirmer = () => {
    router.back()
    void declencherFeuille('blocage', undefined)
  }

  return <CoquilleDeFeuille nom="blocage" titre={t.blockTitle.toUpperCase()}>
    <Text style={traits.texte}>{t.blockDescription}</Text>
    <Text style={traits.texte}>{t.blockReversible}</Text>
    <Pressable accessibilityRole="button" android_ripple={ondeClaire} style={({ pressed }) => [traits.action, pressed && traits.presse]} onPress={confirmer}>
      <Text style={traits.actionTexte}>{t.blockConfirm}  →</Text>
    </Pressable>
    {/* Le glissement vers le bas referme aussi la feuille : ce lien est là pour
        qui ne connaît pas le geste, et parce que le panneau l'avait. */}
    <Pressable accessibilityRole="button" style={toucheMinimale} onPress={() => router.back()}>
      {({ pressed }) => <Text style={[traits.annuler, pressed && traits.presse]}>{t.blockCancel}</Text>}
    </Pressable>
  </CoquilleDeFeuille>
}
