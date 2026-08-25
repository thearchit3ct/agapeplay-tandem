/**
 * Les animations de présence : ce qui arrive et ce qui s'en va le fait avec du
 * poids, pas d'un claquement.
 *
 * Un message reçu qui apparaît d'un coup, une entrée de journal qui disparaît
 * entre deux images — l'œil ne sait pas ce qui vient de se passer, et il faut
 * relire l'écran pour le comprendre. Deux cents millisecondes de fondu et dix
 * points de translation suffisent à dire « ceci est nouveau » ou « ceci est
 * parti » sans qu'on ait à le chercher.
 *
 * **Pourquoi Reanimated, alors que le reste du dossier tient avec `Animated`.**
 * Une *entrée* se fait très bien à la main : le composant est monté, on anime
 * son opacité. Une *sortie*, non — au moment où l'on voudrait l'animer, React a
 * déjà retiré le composant de l'arbre. Retenir soi-même une entrée supprimée le
 * temps de la faire disparaître, c'est tenir un second état de liste à côté du
 * vrai, et c'est exactement le genre de doublon qui finit par afficher une
 * entrée que la base n'a plus. `exiting` fait ce travail dans la bibliothèque.
 * La dépendance est donc payée pour ce que `Animated` ne sait pas faire, et pour
 * rien d'autre : la pulsation des squelettes n'y a pas été portée.
 *
 * **Aucun worklet écrit ici.** Les quatre constantes ci-dessous sont des
 * *descriptions* d'animation fournies par la bibliothèque — `FadeIn`, `FadeOut`
 * et leurs réglages. Le code qui tourne sur le fil d'interface est celui de
 * Reanimated, déjà compilé ; nous ne posons pas de `'worklet'` à nous. C'est
 * volontaire : le greffon Babel des worklets ne se prouve pas sans appareil
 * (voir la note d'installation dans la PR), et moins on lui en demande, moins il
 * y a de choses à découvrir sur un build de production.
 *
 * **Le mouvement réduit est déjà pris en charge.** Les constructeurs de
 * Reanimated portent `ReduceMotion.System` par défaut : la bibliothèque lit le
 * même drapeau système que `useMouvementReduit` et n'anime pas quand il est
 * levé. Rien à ajouter ici — mais rien à retirer non plus le jour où quelqu'un
 * voudrait forcer `ReduceMotion.Never`, qui serait une promesse rompue.
 *
 * **Sobriété.** Pas de `springify()`. Un ressort rebondit, et un espace calme
 * pour des adolescents de seize ans (doc 16) n'a rien à gagner à rebondir. Fondu
 * plus légère translation, 150 à 220 ms : au-delà, on attend l'animation ; en
 * deçà, on ne la voit pas.
 */
import { useEffect, useRef } from 'react'
import { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated'

/**
 * Ce qui arrive **par le bas** : un message qui vient d'être reçu ou envoyé, une
 * page de journal qui vient d'être écrite. La direction n'est pas décorative —
 * elle dit d'où vient la chose : le bas d'une conversation, le haut d'un journal
 * qui s'empile à l'envers. Dix points, là où le réglage d'usine en propose
 * vingt-cinq : à vingt-cinq, la bulle *saute*.
 */
export const ENTREE_DEPUIS_LE_BAS = FadeInDown
  .duration(220)
  .withInitialValues({ transform: [{ translateY: 10 }] })

/** Ce qui arrive sans venir de nulle part : une confirmation qui remplace une question. */
export const ENTREE_SIMPLE = FadeIn.duration(180)

/**
 * Ce qui s'en va. Plus court que l'entrée, et c'est délibéré : on regarde ce qui
 * arrive, on ne regarde pas ce qui part — une sortie qui dure autant qu'une
 * entrée retient l'attention sur une chose qui n'existe plus.
 */
export const SORTIE_SIMPLE = FadeOut.duration(150)

/**
 * Qui, dans une liste, vient d'arriver — et qui était déjà là.
 *
 * Le piège que ce hook existe pour éviter : poser `entering` sur chaque élément
 * d'un `map` fait entrer **toute la liste** à l'ouverture de l'écran. Cinquante
 * bulles qui montent en cascade, c'est de la décoration, c'est-à-dire
 * exactement ce que cette phase s'interdit. Seul ce qui arrive *après* que
 * l'écran a montré son contenu mérite d'être annoncé.
 *
 * Comment il s'y prend : la première fournée est mémorisée en bloc et déclarée
 * « déjà vue ». Tout ce qui apparaît ensuite ne l'est pas, et l'est à son tour
 * au rendu suivant — une seule entrée animée par élément, jamais deux.
 *
 * `pret` dit quand la première fournée est complète : sans lui, un écran qui
 * charge en deux temps mémoriserait une liste vide comme étant « la première
 * fournée », et ferait entrer en cascade les messages arrivés une seconde plus
 * tard. C'est la fin du chargement, pas le montage, qui fait foi.
 *
 * Un rafraîchissement qui rend les mêmes lignes n'anime rien : les identifiants
 * sont ceux de la base (`message.id`, `entree.id`), et ils ne changent pas.
 */
export function useNouveauxVenus(identifiants: string[], pret: boolean): (identifiant: string) => boolean {
  // `null` tant que la première fournée n'a pas été arrêtée : c'est ce qui
  // distingue « on ne sait pas encore » de « la liste était vide ».
  const vus = useRef<Set<string> | null>(null)

  // Lu au rendu, écrit après le rendu : l'écran décide avec ce qu'il savait
  // avant, et ce qu'il vient d'afficher devient du déjà-vu pour la fois d'après.
  const estNouveau = (identifiant: string) => vus.current !== null && !vus.current.has(identifiant)

  useEffect(() => {
    if (!pret) return
    if (vus.current === null) { vus.current = new Set(identifiants); return }
    for (const identifiant of identifiants) vus.current.add(identifiant)
  })

  return estNouveau
}
