/**
 * Où en est-on d'un parcours, et quelle séance proposer maintenant.
 *
 * Cette règle vivait depuis le début en une ligne au milieu d'`App.tsx` — une
 * expression, donc rien qu'un test pouvait tenir. Elle décide pourtant du
 * premier écran que voit un adolescent chaque jour, et elle porte une décision
 * qu'on ne relit nulle part : ce qui arrive quand tout est fait.
 *
 * Extraite le 24/08/2026 sans changer une virgule de son comportement. Les
 * tests qui l'accompagnent épinglent l'existant, ils ne le corrigent pas.
 *
 * Deux choix hérités, dits ici pour qu'on les voie avant de les défaire :
 *
 * - **L'ordre du tableau fait foi.** Aucun tri par `day` : c'est le contenu
 *   publié qui range les séances, et un tri ici masquerait un parcours mal
 *   ordonné au lieu de le montrer.
 * - **Tout fait ⇒ on retombe sur la première.** Le parcours se relit, il ne
 *   se termine pas sur un écran vide. C'est discutable — un écran « parcours
 *   terminé » serait sans doute plus juste — mais c'est le comportement
 *   d'aujourd'hui, et le changer est une décision de produit, pas un
 *   nettoyage.
 */
import type { Session } from './index'

export function prochaineSeance(
  seances: readonly Session[],
  seancesFaites: readonly string[],
): Session | undefined {
  // `undefined` sur un parcours vide, exactement comme l'expression d'origine :
  // il n'y a pas de séance à proposer, et en inventer une serait mentir sur ce
  // que le contenu contient.
  return seances.find((seance) => !seancesFaites.includes(seance.id)) ?? seances[0]
}
