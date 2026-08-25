/**
 * Les squelettes de chargement : montrer la forme de ce qui arrive.
 *
 * Ce que remplaçaient les phrases d'attente — « Chargement de ta séance… », le
 * « … » de la conversation — c'était le vide. Un texte d'attente demande de
 * lire pour apprendre qu'il n'y a rien à lire ; une forme fantôme dit d'un coup
 * d'œil ce qui va apparaître et où, si bien que l'écran ne se réorganise pas
 * sous les yeux au moment où la base répond.
 *
 * **Ce qu'un squelette ne remplace jamais.** Ce dépôt distingue partout « on ne
 * sait pas encore » de « il n'y a rien » : `sessionNotDownloaded`,
 * `notDownloaded`, `emptyThread`, `threadClosed` sont des phrases qui portent un
 * sens et qui restent. Un squelette ne se substitue qu'à l'attente elle-même —
 * jamais à une réponse, fût-elle vide.
 *
 * **Le mouvement, et son absence.** La pulsation est une opacité animée, sans
 * dégradé qui glisse : l'`Animated` de React Native suffit à faire respirer un
 * rectangle. Elle se coupe quand le système demande moins de mouvement
 * (`useMouvementReduit`) — la forme reste, figée à mi-opacité : ce qu'elle a à
 * dire est dans son contour, pas dans son battement.
 *
 * *Note du 28/08/2026.* Ce commentaire disait jusqu'ici qu'« ajouter une
 * dépendance pour faire respirer un rectangle serait payer cher un effet de
 * surface ». La phrase reste vraie **pour ce fichier** : `react-native-reanimated`
 * est entré dans l'arbre depuis, mais pour les animations de présence
 * (`presence.tsx`), qu'`Animated` ne sait pas faire — une sortie a besoin qu'on
 * retienne un composant démonté. Le squelette, lui, n'a rien à y gagner et n'y a
 * pas été porté : une pulsation d'opacité n'est pas une raison de changer d'outil.
 *
 * Une seule valeur animée pour toute l'application, partagée : les rectangles
 * d'un même écran battent alors **ensemble**, ce qui se lit comme une intention
 * plutôt que comme du bruit. La boucle ne tourne que tant qu'un squelette est
 * affiché.
 */
import { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { useMouvementReduit } from './mouvement'
import { colors } from './theme'

const OPACITE_BASSE = 0.35
const OPACITE_HAUTE = 0.9

// La valeur et la boucle vivent au niveau du module : c'est ce qui garde les
// rectangles en phase. `compteur` dit combien de squelettes sont montés — la
// boucle s'arrête au dernier démonté, pour ne pas laisser une animation tourner
// derrière un écran chargé.
const pulsation = new Animated.Value(OPACITE_BASSE)
let boucle: Animated.CompositeAnimation | null = null
let compteur = 0

// `react-native-web` n'a pas de pilote natif, et `mobile:export` passe par lui.
const pilotageNatif = Platform.OS !== 'web'

const demarrer = () => {
  if (boucle) return
  boucle = Animated.loop(Animated.sequence([
    Animated.timing(pulsation, { toValue: OPACITE_HAUTE, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: pilotageNatif }),
    Animated.timing(pulsation, { toValue: OPACITE_BASSE, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: pilotageNatif }),
  ]))
  boucle.start()
}

const arreter = () => {
  boucle?.stop()
  boucle = null
  pulsation.setValue(OPACITE_BASSE)
}

type ProprietesDeSquelette = {
  /** La hauteur du rectangle, en points. C'est elle qui dit ce qui arrive. */
  hauteur: number
  /** Sa largeur : un nombre de points, ou une proportion (`'70%'`). */
  largeur?: number | `${number}%`
  /** Posé sur fond sombre — la carte du jour — plutôt que sur le papier. */
  sombre?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Un rectangle fantôme, à la place et à la taille de ce qui va s'afficher.
 */
export function Squelette({ hauteur, largeur = '100%', sombre = false, style }: ProprietesDeSquelette) {
  const mouvementReduit = useMouvementReduit()
  // La souscription à la boucle partagée. Une `ref` pour ne compter qu'une fois
  // par montage, quel que soit le nombre de rendus.
  const inscrit = useRef(false)

  useEffect(() => {
    if (mouvementReduit) return
    if (!inscrit.current) { inscrit.current = true; compteur += 1 }
    demarrer()
    return () => {
      if (!inscrit.current) return
      inscrit.current = false
      compteur -= 1
      if (compteur <= 0) { compteur = 0; arreter() }
    }
  }, [mouvementReduit])

  return <Animated.View
    // Un squelette n'est pas une information : les lecteurs d'écran doivent
    // passer au travers, sinon ils annoncent quatre rectangles vides. L'écran
    // qui attend le dit autrement, avec ses propres textes.
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[
      styles.bloc,
      sombre && styles.blocSombre,
      { height: hauteur, width: largeur },
      // Figé à mi-course quand le système demande moins de mouvement : la forme
      // reste lisible, le battement disparaît.
      mouvementReduit ? { opacity: (OPACITE_BASSE + OPACITE_HAUTE) / 2 } : { opacity: pulsation },
      style,
    ]}
  />
}

/**
 * Une ligne de texte fantôme, plus courte que la précédente : c'est ainsi que
 * tombe un paragraphe, et c'est ce qui distingue un squelette de texte d'un
 * squelette de carte.
 */
export function SqueletteDeParagraphe({ lignes = 3, sombre = false }: { lignes?: number; sombre?: boolean }) {
  const largeurs: `${number}%`[] = ['100%', '96%', '72%', '88%', '64%']
  return <View style={styles.paragraphe}>
    {Array.from({ length: lignes }, (_, index) => (
      <Squelette key={index} hauteur={12} largeur={largeurs[index % largeurs.length]} sombre={sombre} />
    ))}
  </View>
}

const styles = StyleSheet.create({
  // Le trait de la marque, pas un gris d'emprunt : `line` est déjà la couleur
  // des filets et des bordures de cartes, si bien qu'un squelette a exactement
  // la valeur de ce qu'il annonce.
  bloc: { backgroundColor: colors.line },
  // Sur les fonds d'encre — la carte du jour, les bulles envoyées : le même
  // geste, dans la valeur que la carte du jour utilise déjà pour son filet.
  // Plus sombre, le fantôme se perdrait dans le fond.
  blocSombre: { backgroundColor: '#454540' },
  paragraphe: { gap: 9 },
})
