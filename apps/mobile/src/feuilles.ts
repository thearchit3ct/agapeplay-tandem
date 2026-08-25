/**
 * Le fil entre un écran et sa feuille native.
 *
 * Le problème, posé simplement : une feuille de bas d'écran est une **route**,
 * donc un autre composant, avec son propre état. Or les quatre gestes qu'elle
 * confirme — bloquer, débloquer, signaler, supprimer son compte — sont écrits
 * dans l'écran qui la présente, avec leurs gardes, leurs lectures de réponse,
 * leur haptique et leurs phrases. Les recopier dans la feuille serait dupliquer
 * de la logique produit ; les y déménager mettrait des écritures sensibles dans
 * un composant qui n'a ni la session, ni le tandem, ni le journal sous la main.
 *
 * Ce module ne fait donc qu'une chose : porter **la décision**, pas l'action.
 * L'écran arme son geste, la feuille l'énonce et le déclenche, l'écran l'exécute
 * — il est toujours monté, la feuille étant présentée par-dessus lui.
 *
 * Deux précautions qui sont la raison d'être du code ci-dessous :
 *
 * - **le geste armé est toujours le plus récent.** Enregistré une fois pour
 *   toutes, il figerait la session, le tandem et l'entrée du rendu où il a été
 *   posé ; il est donc réenregistré à chaque rendu de l'écran ;
 * - **une feuille sans geste ne s'affiche pas.** Ouverte après un rechargement à
 *   chaud, ou par une URL forgée, elle se referme plutôt que de montrer un
 *   bouton qui ne ferait rien.
 */
import { useEffect } from 'react'
import type { CategorieSignalement } from '@agapeplay/domain'

/**
 * Ce que chaque feuille rapporte à son écran.
 *
 * Trois confirmations ne rapportent rien — la décision *est* le message. Le
 * signalement, lui, porte un formulaire : c'est la feuille qui recueille la
 * catégorie et le mot libre, et l'écran qui les écrit.
 */
export type ChargesDeFeuille = {
  blocage: void
  deblocage: void
  signalement: { categorie: CategorieSignalement; motLibre: string }
  'suppression-compte': void
}

export type NomDeFeuille = keyof ChargesDeFeuille

/**
 * Ce qu'un geste rend, et ce que la feuille en fait.
 *
 * `false` — et lui seul — veut dire « ça n'a pas abouti, reste ouverte » : c'est
 * le cas du signalement, dont le panneau restait affiché quand l'insert
 * échouait, pour qu'on n'ait pas à ressaisir sa catégorie et sa phrase. Un geste
 * qui ne rend rien a abouti : les trois autres n'ont rien à rapporter.
 */
type Resultat = void | boolean

// Une seule entrée par feuille : deux écrans ne peuvent pas armer la même, il
// n'y en a qu'un de présenté à la fois.
const gestes = new Map<NomDeFeuille, (charge: never) => Resultat | Promise<Resultat>>()

/**
 * Côté écran : arme le geste que la feuille confirmera.
 *
 * L'enregistrement se fait après chaque rendu et non une seule fois : c'est ce
 * qui garantit que la fonction appelée depuis la feuille voit l'état courant.
 * Il est désarmé au démontage — un écran quitté ne doit plus rien pouvoir
 * déclencher.
 */
export function useGesteDeFeuille<K extends NomDeFeuille>(
  nom: K,
  geste: (charge: ChargesDeFeuille[K]) => Resultat | Promise<Resultat>,
): void {
  useEffect(() => {
    gestes.set(nom, geste as (charge: never) => Resultat | Promise<Resultat>)
    return () => { gestes.delete(nom) }
  })
}

/** Côté feuille : y a-t-il un geste armé ? Sinon, la feuille se referme. */
export function feuilleArmee(nom: NomDeFeuille): boolean {
  return gestes.has(nom)
}

/**
 * Côté feuille : déclenche le geste de l'écran et attend sa fin.
 *
 * Attendu, et non lancé puis oublié : c'est ce qui permet à la feuille de
 * désarmer son bouton pendant l'écriture — le signalement le fait — et à
 * l'écran de poser sa phrase avant que la feuille ne disparaisse.
 */
export async function declencherFeuille<K extends NomDeFeuille>(nom: K, charge: ChargesDeFeuille[K]): Promise<boolean> {
  const geste = gestes.get(nom)
  // Rien d'armé : la feuille se referme plutôt que d'attendre. Elle traite ce
  // cas comme un aboutissement, faute de quoi elle resterait ouverte pour
  // toujours sur un écran qui n'existe plus.
  if (!geste) return true
  const rendu = await (geste as (charge: ChargesDeFeuille[K]) => Resultat | Promise<Resultat>)(charge)
  return rendu !== false
}
