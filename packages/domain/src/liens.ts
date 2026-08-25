/**
 * Lire un lien reçu, quelle que soit sa forme — issue #13, quatrième front.
 *
 * Un même jeton arrive par des URL qui ne se ressemblent pas :
 *
 *   - `https://tandem.agapeplay.store/?invite=…` — le lien qu'émet le web pour
 *     un tandem, celui qu'on colle dans un message ;
 *   - `https://tandem.agapeplay.store/?communaute=…` — celui d'un responsable
 *     de communauté (issue #17) ;
 *   - `agapeplay:///invite?token=…` — la route mobile, telle qu'un build
 *     installé la reçoit ;
 *   - `exp://192.168.1.10:8081/--/invite?token=…` — la même, dans Expo Go.
 *
 * Les quatre disent la même chose, et aucune n'est un cas particulier : c'est
 * pourquoi la lecture vit ici, avec ses tests, plutôt que dans un écran. Le
 * cas qui casse les implémentations naïves est le troisième — `new URL()` sur
 * un schéma personnalisé ne remplit pas `searchParams` de la même façon selon
 * les moteurs, et la portion utile est cherchée à la main : tout ce qui suit le
 * premier `?`, avant un éventuel fragment.
 *
 * Ce que cette fonction ne fait pas : décider si le jeton est valide. Elle rend
 * ce qu'elle a lu ; la base tranche, et elle seule.
 */
import { PARAM_COMMUNAUTE } from './communaute'

/** Ce qu'un lien confère. Deux choses distinctes, jamais confondues. */
export type FormeDeLien = 'tandem' | 'communaute'

export type JetonRecu = { forme: FormeDeLien; jeton: string }

/**
 * Les noms de paramètre qui portent un jeton de tandem.
 *
 * Deux, et c'est de l'histoire assumée : `invite` est celui qu'écrit le web
 * depuis toujours, `token` celui que la route mobile `/invite` reçoit. Les
 * renommer d'un côté casserait les liens déjà envoyés — un lien d'invitation
 * vit dans une conversation, pas dans une base qu'on migre.
 */
const PARAMS_TANDEM = ['invite', 'token'] as const

const parametres = (url: string): URLSearchParams => {
  const sansFragment = url.split('#')[0]
  const debut = sansFragment.indexOf('?')
  return new URLSearchParams(debut === -1 ? '' : sansFragment.slice(debut + 1))
}

/**
 * Le jeton porté par une URL, ou `null`.
 *
 * **Le tandem l'emporte quand les deux sont présents.** Le cas n'existe pas
 * aujourd'hui — aucun écran n'émet une URL portant les deux — et la précédence
 * est là pour qu'il n'y ait pas de comportement indéfini le jour où il
 * existerait : une invitation de tandem nomme une personne, une invitation de
 * communauté nomme un groupe, et c'est la première qui est adressée à
 * quelqu'un en particulier.
 */
export const jetonDuLien = (url: string): JetonRecu | null => {
  const params = parametres(url)
  for (const nom of PARAMS_TANDEM) {
    const valeur = params.get(nom)
    if (valeur !== null && valeur.trim() !== '') return { forme: 'tandem', jeton: valeur.trim() }
  }
  const communaute = params.get(PARAM_COMMUNAUTE)
  if (communaute !== null && communaute.trim() !== '') return { forme: 'communaute', jeton: communaute.trim() }
  return null
}
