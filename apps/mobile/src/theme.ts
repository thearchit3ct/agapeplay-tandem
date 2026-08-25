import { Platform } from 'react-native'

export const colors = {
  ink: '#111111',
  paper: '#f3f1eb',
  soft: '#d8d6ce',
  muted: '#73736d',
  copper: '#b46d47',
  line: '#c8c6bd',
  white: '#fffef9',
}

export const typography = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
}

/**
 * Ce qui se passe sous le doigt.
 *
 * Aucun `Pressable` de l'application n'avait de retour d'appui avant le
 * 25/08/2026 : on touchait, et rien ne bougeait jusqu'à ce que l'écran change.
 * C'est la moitié du « ça se comporte comme une web app » rapporté par le
 * fondateur — une page web ne répond pas au doigt, une application native si.
 *
 * Deux registres, et le choix entre les deux se fait par la taille de la cible :
 *
 * - `presse` — un assombrissement immédiat, pour les libellés et les liens.
 *   Rendu identique sur les deux plateformes, ce qui convient à une cible trop
 *   petite pour qu'une onde soit lisible.
 * - `onde…` — l'onde de matériau d'Android sous les grandes surfaces (cartes,
 *   rangées, boutons). C'est le signal natif que la plateforme attend, et il
 *   est ignoré sans dommage sur iOS et sur le web.
 *
 * Les deux se posent ensemble sans se gêner : l'onde dessine l'étendue de la
 * cible, l'opacité confirme l'appui là où l'onde n'existe pas.
 */
export const presse = ({ pressed }: { pressed: boolean }) => (pressed ? { opacity: 0.55 } : null)

/** Sur un fond clair — carte bordée, rangée, papier. */
export const ondeEncre = { color: 'rgba(17, 17, 17, 0.12)' }

/** Sur un fond sombre ou cuivre — carte du jour, boutons pleins. */
export const ondeClaire = { color: 'rgba(255, 254, 249, 0.20)' }

/**
 * La cible minimale du doigt : 44 points, la même des deux côtés.
 *
 * Les liens de cet écran sont des `<Text>` de 10 ou 11 points posés nus dans un
 * `Pressable` — soit une cible d'une quinzaine de points de haut. `hitSlop`
 * agrandirait la zone sensible sans rien changer à la mise en page, mais il ne
 * se cumule pas entre voisins ; sur une rangée d'actions serrées, deux zones
 * élargies se recouvrent et c'est la dernière montée qui gagne. Une hauteur
 * réelle est donc préférée partout où la mise en page la supporte.
 */
export const toucheMinimale = { minHeight: 44, justifyContent: 'center' as const }
