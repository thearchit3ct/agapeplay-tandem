/**
 * Ce que le clavier prend à l'écran, et ce qu'il faut lui rendre.
 *
 * Pourquoi ce module existe plutôt qu'un `KeyboardAvoidingView` :
 *
 * - **Depuis le SDK 54, Android est en bord-à-bord obligatoire.** Le greffon
 *   `withEdgeToEdge` d'Expo le dit lui-même — « Android 16 makes edge-to-edge
 *   mandatory », et il refuse désormais qu'on le débraye. Or en bord-à-bord la
 *   fenêtre ne se redimensionne plus à l'ouverture du clavier :
 *   `android:windowSoftInputMode=adjustResize`, donc
 *   `android.softwareKeyboardLayoutMode: "resize"`, ne déplace plus rien tout
 *   seul. C'est la cause du défaut constaté sur l'APK le 25/08/2026 — « lorsque
 *   le clavier s'ouvre, il masque la case ».
 * - **`KeyboardAvoidingView` ne se comporte pas pareil des deux côtés.**
 *   `behavior="height"` s'appuie précisément sur le redimensionnement qui
 *   n'existe plus, et `undefined` sur Android — le montage le plus répandu —
 *   ne fait rien du tout ici. Un espacement calculé et posé explicitement se
 *   raisonne, se lit, et se comporte identiquement sur les deux plateformes.
 * - **Sous `react-native-web`, aucun de ces événements n'est émis.** La valeur
 *   reste donc à zéro et la mise en page ne bouge pas : `mobile:export`, seule
 *   garde Metro sans appareil, traverse ce code sans le dénaturer.
 *
 * `android.softwareKeyboardLayoutMode` reste déclaré à `"resize"` dans
 * `app.json` : c'est déjà le défaut, la valeur est inerte en bord-à-bord, et
 * `"pan"` — la seule autre — ferait glisser toute la fenêtre vers le haut, ce
 * qui décollerait un composeur censé rester au ras du clavier. On garde donc la
 * valeur qui ne nuit pas, et l'écart se rattrape ici.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Keyboard, Platform } from 'react-native'
import type { NativeSyntheticEvent, ScrollView, TargetedEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * La hauteur du clavier, en points, ou zéro s'il est fermé.
 *
 * iOS écoute les événements `Will…`, qui partent avec l'animation et donnent
 * une mise en page synchrone du mouvement ; Android n'émet que les `Did…`.
 * Écouter les quatre sur les deux plateformes ferait deux mises à jour par
 * ouverture sur iOS.
 */
export function useHauteurDuClavier(): number {
  const [hauteur, setHauteur] = useState(0)

  useEffect(() => {
    const ouverture = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const fermeture = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const montre = Keyboard.addListener(ouverture, (evenement) => {
      setHauteur(evenement.endCoordinates?.height ?? 0)
    })
    const cache = Keyboard.addListener(fermeture, () => setHauteur(0))
    return () => { montre.remove(); cache.remove() }
  }, [])

  return hauteur
}

/**
 * L'espacement à poser sous un contenu déjà tenu par une `SafeAreaView`.
 *
 * Android mesure la hauteur du clavier depuis le bas de l'**écran**, et non
 * depuis le bas de la zone sûre : la barre de navigation système est donc
 * comptée dans les deux, une fois par le clavier et une fois par la marge de
 * sécurité. Sans cette soustraction, le contenu remonterait d'une cinquantaine
 * de points de trop et laisserait un blanc sous le champ.
 */
export function useEspacementDuClavier(): number {
  const hauteur = useHauteurDuClavier()
  const marges = useSafeAreaInsets()
  return hauteur > 0 ? Math.max(0, hauteur - marges.bottom) : 0
}

/**
 * De la place sous le champ, et le champ sous les yeux.
 *
 * Deux gestes complémentaires, et il faut les deux :
 *
 * - `espacement` se pose en bas du contenu défilant, pour que la zone à
 *   parcourir existe. Sans lui, un champ déjà au ras du bas n'a nulle part où
 *   remonter : le défilement bute, et le clavier le recouvre quand même.
 * - `remonter`, branché sur le `onFocus` du champ, appelle
 *   `scrollResponderScrollNativeHandleToKeyboard` — la méthode publique de
 *   `ScrollView` écrite pour ce problème précis. Elle mesure le champ, lit le
 *   haut du clavier, et défile juste ce qu'il faut. Quand les mesures du
 *   clavier ne sont pas encore connues, elle diffère d'elle-même son
 *   défilement au lieu de sauter n'importe où.
 *
 * `RESERVE` est ce qu'on garde en plus sous le champ : dans cette application,
 * le bouton d'envoi est toujours **sous** la case, et un champ visible dont on
 * ne peut pas atteindre le bouton ne règle qu'une moitié du défaut rapporté.
 *
 * Le calcul de la méthode suppose que la `ScrollView` occupe tout l'écran. Ici
 * elle est tenue par une `SafeAreaView`, donc décalée de la marge haute : le
 * défilement dépasse d'autant, ce qui place le champ un peu plus haut que le
 * strict nécessaire. C'est l'erreur qu'on préfère.
 */
const RESERVE = 96

export function useChampAuDessusDuClavier() {
  const espacement = useEspacementDuClavier()
  const refDefilement = useRef<ScrollView>(null)

  const remonter = useCallback((evenement: NativeSyntheticEvent<TargetedEvent>) => {
    const champ = evenement.target
    if (champ == null) return
    // `true` en dernier argument : sans lui, la méthode s'autorise un
    // défilement négatif — elle tire le contenu vers le bas pour coller le
    // champ au clavier, ce qui décolle l'en-tête du haut de l'écran sur les
    // écrans courts.
    refDefilement.current?.scrollResponderScrollNativeHandleToKeyboard(champ, RESERVE, true)
  }, [])

  return { espacement, refDefilement, remonter }
}
