/**
 * Le réglage système « réduire les animations », lu à un seul endroit.
 *
 * Il vivait dans `squelette.tsx`, où il était né avec la pulsation des
 * squelettes. La phase « soie » lui a donné deux autres lecteurs — la
 * micro-échelle d'appui (`appui.tsx`) et les animations de présence
 * (`presence.tsx`) — et une troisième copie du même `useEffect` aurait été la
 * copie de trop : trois abonnements à `AccessibilityInfo` qui peuvent diverger
 * le jour où l'un des trois oublie de se désabonner.
 *
 * **Pourquoi le lire à chaque montage plutôt qu'une fois pour toutes.** Le
 * réglage se change depuis les réglages du téléphone pendant que l'application
 * tourne. Une lecture unique au démarrage laisserait l'application continuer de
 * bouger pour quelqu'un qui vient de demander qu'elle s'arrête — exactement la
 * personne à qui la promesse est due.
 *
 * **Ce que ce hook ne couvre pas, et n'a pas à couvrir.** Les animations de
 * présence de Reanimated (`entering` / `exiting`) portent leur propre réglage,
 * `ReduceMotion.System` par défaut : la bibliothèque lit le même drapeau système
 * et coupe l'animation elle-même. Ce hook sert donc là où c'est *notre* code qui
 * décide de bouger — la pulsation des squelettes, l'échelle sous le doigt.
 */
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false)

  useEffect(() => {
    let actif = true
    void AccessibilityInfo.isReduceMotionEnabled().then((valeur) => { if (actif) setReduit(valeur) })
    const abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', (valeur) => { if (actif) setReduit(valeur) })
    // La garde de démontage vaut pour les deux : la promesse peut répondre après
    // le départ de l'écran, et un écouteur laissé en place fuit.
    return () => { actif = false; abonnement.remove() }
  }, [])

  return reduit
}
