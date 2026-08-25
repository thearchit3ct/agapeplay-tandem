/**
 * `Appui` : le `Pressable` de l'application, qui répond au doigt par une
 * micro-échelle en plus de l'assombrissement.
 *
 * Ce que l'opacité ne dit pas. Depuis le 25/08/2026, toutes les cibles
 * s'assombrissent sous le doigt (`presse`, `onde…` dans `theme.ts`), et c'était
 * déjà la moitié du chemin. Mais un assombrissement se lit comme un changement
 * de *couleur* : sur un fond crème, il ressemble à une ombre qui passe. Une
 * surface qui recule de deux ou trois pour cent, elle, se lit comme un
 * *déplacement* — c'est le geste physique que la plateforme fait partout
 * ailleurs, et c'est lui qui manquait au reproche « ça se comporte comme une
 * web app ».
 *
 * **0,975 et 100 ms.** Assez pour que la main le sente, trop peu pour qu'on
 * puisse le décrire. Au-delà — 0,95, 200 ms — la carte *rebondit*, et une carte
 * qui rebondit dans un espace de recueillement est une carte qui joue.
 *
 * **Pourquoi ce composant est le pressable, et pas un emballage autour.**
 * `<Link asChild>` clone ses props (`onPress`, `href`, l'accessibilité) sur son
 * unique enfant. Une `Animated.View` qui envelopperait un `Pressable`
 * recevrait donc ce `onPress` — et le doigt tomberait dans le vide. `Appui`
 * *est* le pressable : tout ce qu'il ne comprend pas, il le passe.
 *
 * **Le prix de cette forme, et pourquoi il est payé volontiers.**
 * `Animated.createAnimatedComponent` aplatit le style, si bien qu'il n'accepte
 * plus la forme fonction — `style={({ pressed }) => …}` — dont neuf écrans se
 * servent. `Appui` résout donc lui-même la fonction, avec l'état d'appui qu'il
 * tient déjà pour l'échelle. Les appelants n'ont rien à changer : la forme
 * fonction du style **et** celle des enfants continuent de marcher, aux mêmes
 * signatures.
 *
 * **Le mouvement réduit coupe l'échelle, pas le retour.** Quand le système
 * demande moins de mouvement, la surface ne bouge plus — mais l'opacité reste,
 * et c'est elle qui dit alors que l'appui a été pris. Un retour d'appui qui
 * disparaît avec les animations serait une régression d'accessibilité déguisée
 * en respect de l'accessibilité.
 *
 * Le reste — `android_ripple`, `disabled`, `accessibilityRole`,
 * `accessibilityState`, `hitSlop`, `onLongPress` — n'est pas touché : ce sont
 * les props de `Pressable`, et elles arrivent à `Pressable`.
 */
import { useRef, useState } from 'react'
import { Animated, Platform, Pressable } from 'react-native'
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'
import { useMouvementReduit } from './mouvement'

// `react-native-web` n'a pas de pilote natif, et `mobile:export` passe par lui —
// même garde que dans `squelette.tsx`, pour la même raison.
const pilotageNatif = Platform.OS !== 'web'

const PressableAnime = Animated.createAnimatedComponent(Pressable)

/** L'échelle au repos, et celle sous le doigt. */
const AU_REPOS = 1
const SOUS_LE_DOIGT = 0.975
const DUREE = 100

type ProprietesDAppui = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((etat: { pressed: boolean }) => StyleProp<ViewStyle>)
  children?: React.ReactNode | ((etat: { pressed: boolean }) => React.ReactNode)
  /**
   * L'échelle sous le doigt, pour les rares cibles où la valeur d'usine ne va
   * pas. Une pastille de 44 points bouge visiblement moins qu'une carte de 380 :
   * on peut y descendre un peu. À laisser vide dans le doute.
   */
  echelle?: number
}

export function Appui({ style, children, onPressIn, onPressOut, echelle = SOUS_LE_DOIGT, ...reste }: ProprietesDAppui) {
  const mouvementReduit = useMouvementReduit()
  const [presse, setPresse] = useState(false)
  // Une `ref` : la valeur animée doit survivre aux rendus, et en créer une
  // nouvelle à chaque rendu ferait repartir l'échelle de 1 en plein appui.
  const valeur = useRef(new Animated.Value(AU_REPOS)).current

  const vers = (cible: number) => {
    if (mouvementReduit) { valeur.setValue(AU_REPOS); return }
    Animated.timing(valeur, { toValue: cible, duration: DUREE, useNativeDriver: pilotageNatif }).start()
  }

  const etat = { pressed: presse }
  const styleResolu = typeof style === 'function' ? style(etat) : style
  const enfantsResolus = typeof children === 'function' ? children(etat) : children

  return <PressableAnime
    {...reste}
    // L'échelle est posée **après** le style de l'appelant : une carte qui
    // porterait déjà un `transform` verrait le sien remplacé, ce qu'aucune ne
    // fait aujourd'hui — et le jour où l'une le ferait, il vaut mieux que
    // l'échelle gagne que d'empiler deux transformations contradictoires.
    style={[styleResolu, { transform: [{ scale: valeur }] }] as StyleProp<ViewStyle>}
    // L'état est posé avant l'animation : c'est lui qui rend l'assombrissement,
    // et l'assombrissement ne doit pas attendre 100 ms.
    onPressIn={(evenement) => { setPresse(true); vers(echelle); onPressIn?.(evenement) }}
    onPressOut={(evenement) => { setPresse(false); vers(AU_REPOS); onPressOut?.(evenement) }}
  >
    {enfantsResolus}
  </PressableAnime>
}
