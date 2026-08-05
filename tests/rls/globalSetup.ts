/**
 * Monte la base locale avant la suite RLS, l'arrête après.
 *
 * Jamais la base distante de l'utilisateur : ce harnais ne connaît qu'un
 * conteneur Docker jetable, monté depuis les migrations du dépôt.
 *
 * `RLS_REUSE_STACK=1` réutilise une base déjà debout au lieu de la remonter.
 * C'est ce qui rend praticable la vérification par mutation — casser une
 * politique sur la base vivante, relancer la suite en quelques secondes, voir
 * quel test rougit — là où un cycle complet demande près de deux minutes.
 */
import { arreter, demarrer } from './provision.mjs'

const reutiliser = process.env.RLS_REUSE_STACK === '1'

export const setup = () => {
  if (!reutiliser) demarrer()
}

export const teardown = () => {
  if (!reutiliser) arreter()
}
