/**
 * Le parcours publié, lisible hors ligne — issue #13, cinquième front.
 *
 * Le critère de l'issue est « séance déjà téléchargée lisible hors ligne », et
 * il n'était pas tenu : les écrans `journey` et `session` affichaient un texte
 * écrit en dur — trois titres inventés et un verset — qui n'était ni le
 * contenu publié, ni celui que le web montre. Hors ligne, ils étaient donc
 * « lisibles » au sens où ils ne dépendaient de rien ; ils ne disaient
 * simplement pas la vérité.
 *
 * Le chargement passe désormais par `loadPublishedJourney`, comme sur le web,
 * avec **le cache de ce téléphone** : une séance déjà ouverte se relit en
 * avion, dans la langue où elle a été lue. Le cache est celui du wrapper
 * `stockage`, qui porte le repli mémoire quand le module natif d'AsyncStorage
 * est nul (bug mesuré, voir son commentaire).
 *
 * Invalidation : aucune, et c'est un choix. Le contenu publié est réécrit à
 * chaque chargement réussi, et le cache ne sert que lorsque la base ne répond
 * pas. Une péremption ajouterait la seule chose qu'on ne veut pas — un moment
 * où l'application décide que ce qu'elle a déjà n'est plus assez bon pour être
 * montré à quelqu'un qui n'a pas de réseau.
 */
import { loadPublishedJourney } from '@agapeplay/content'
import type { CacheDeParcours } from '@agapeplay/content'
import type { Journey, Locale } from '@agapeplay/domain'
import { CLEFS } from './clefs'
import { stockage } from './storage'
import { supabase } from './supabase'

export const cacheDuTelephone: CacheDeParcours = {
  lire: () => stockage.getItem(CLEFS.parcours),
  ecrire: (valeur) => stockage.setItem(CLEFS.parcours, valeur),
}

/**
 * Le parcours publié dans cette langue, ou `null` si rien n'a jamais été lu.
 *
 * `null` n'est pas une erreur : c'est « on ne sait pas encore », et les écrans
 * le disent plutôt que d'afficher un parcours vide.
 */
export const chargerParcours = async (locale: Locale): Promise<Journey | null> => {
  if (!supabase) return null
  return loadPublishedJourney(supabase, locale, cacheDuTelephone)
}
