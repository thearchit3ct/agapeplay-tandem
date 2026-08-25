/**
 * Le lien de retour des écrans qu'on ouvre par-dessus les onglets.
 *
 * Séance, compte, invitation et connexion portent tous un « ← Aujourd'hui ».
 * Tant que tout l'arbre était plat, ce lien pouvait être un `Link href="/"` :
 * naviguer vers l'accueil revenait à peu près à revenir en arrière.
 *
 * Depuis que ces écrans sont **poussés au-dessus** du groupe d'onglets, ce n'est
 * plus vrai. `href="/"` empilerait une nouvelle page sur celle qu'on quitte : la
 * pile grandirait à chaque aller-retour, et le bouton retour matériel d'Android
 * devrait être pressé autant de fois qu'on a fait d'allers. Dépiler est aussi ce
 * qui rend le bon écran — une séance ouverte depuis Parcours revient à Parcours,
 * et non à Aujourd'hui.
 *
 * Le repli existe pour un cas réel : l'application ouverte **à froid** sur un
 * lien (`agapeplay:///invite?token=…`) n'a rien sous l'écran courant. Il n'y a
 * alors rien à dépiler, et c'est l'accueil qui prend sa place.
 */
import { router } from 'expo-router'

export function revenir() {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}
