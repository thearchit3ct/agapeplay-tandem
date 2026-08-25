/**
 * La langue de l'application : une seule, pour toute l'application.
 *
 * Jusqu'au 27/08/2026, `locale` était un `useState<Locale>('fr')` répété dans
 * sept composants. Trois conséquences, dont la dernière a fini par bloquer un
 * chantier entier :
 *
 * - **changer de langue ne suivait pas d'un écran à l'autre.** On passait le
 *   journal en anglais, on revenait à l'accueil, il était en français ;
 * - **rien n'était retenu** : le choix mourait au premier redémarrage ;
 * - **la barre d'onglets ne pouvait pas exister.** Ses libellés vivent dans le
 *   layout, au-dessus des écrans : sans source unique, ils n'auraient suivi
 *   aucune bascule. C'est le prérequis nommé dans `docs/21`.
 *
 * Ce que ce module est, et ce qu'il n'est pas : un état React partagé par
 * contexte, adossé au `stockage` du dépôt (donc au repli mémoire quand le
 * module natif d'AsyncStorage manque — voir `storage.ts`). Ce n'est pas une
 * bibliothèque d'internationalisation : les textes restent des catalogues
 * `packages/content/copy` lus par accès direct, avec leur test de parité.
 *
 * La lecture du disque est asynchrone : le premier rendu se fait donc en
 * français, puis la langue retenue s'applique. C'est l'ordre le moins mauvais —
 * l'autre serait de retenir l'arbre entier derrière un écran vide le temps
 * d'une lecture de préférence.
 */
import { createElement, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Locale } from '@agapeplay/domain'
import { CLEFS } from './clefs'
import { stockage } from './storage'

/** Les deux langues du produit, et la garde qui refuse tout le reste. */
const LANGUES: readonly Locale[] = ['fr', 'en']
const estUneLangue = (valeur: string | null): valeur is Locale => valeur !== null && (LANGUES as readonly string[]).includes(valeur)

type Contexte = {
  langue: Locale
  /** Passe à l'autre langue. Le produit n'en a que deux : une bascule suffit. */
  basculer: () => void
}

// La valeur par défaut n'est pas censée servir : le fournisseur est monté à la
// racine des routes. Elle existe pour qu'un composant testé hors de l'arbre ne
// s'effondre pas, et sa bascule ne fait rien plutôt que de mentir.
const ContexteDeLangue = createContext<Contexte>({ langue: 'fr', basculer: () => {} })

export function FournisseurDeLangue({ children }: { children: ReactNode }) {
  const [langue, setLangue] = useState<Locale>('fr')

  // Lue une fois, au démarrage. Garde de démontage comme partout : la réponse
  // du disque peut arriver après un démontage en développement (rechargement à
  // chaud), et écrire dans un arbre démonté ne sert personne.
  useEffect(() => {
    let actif = true
    void stockage.getItem(CLEFS.langue).then((lue) => {
      if (actif && estUneLangue(lue)) setLangue(lue)
    })
    return () => { actif = false }
  }, [])

  const basculer = useCallback(() => {
    setLangue((precedente) => {
      const suivante: Locale = precedente === 'fr' ? 'en' : 'fr'
      // L'écriture n'est pas attendue : la langue de l'écran ne doit pas
      // dépendre d'un disque qui répond mal. Au pire, le choix ne survit pas au
      // redémarrage — ce qui était le comportement d'avant ce module.
      void stockage.setItem(CLEFS.langue, suivante)
      return suivante
    })
  }, [])

  const valeur = useMemo(() => ({ langue, basculer }), [langue, basculer])
  // `createElement` et non du JSX : ce fichier est un `.ts`, comme les autres
  // modules de `src/` — les `.tsx` du mobile sont les écrans.
  return createElement(ContexteDeLangue.Provider, { value: valeur }, children)
}

/** La langue courante et sa bascule. Le seul chemin de lecture de l'écran. */
export function useLangue(): Contexte {
  return useContext(ContexteDeLangue)
}
