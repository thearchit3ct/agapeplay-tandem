/**
 * Les quatre libellés de la barre d'onglets native.
 *
 * Pourquoi un catalogue à part plutôt qu'une clé de plus dans `shared.ts` :
 * `shared.ts` est ce que le web et le mobile disent **mot pour mot**, et le test
 * de parité vérifie que chaque catalogue reprend ces textes tels quels. Or
 * `journal` vaut « Journal privé » dans `mobile-home.ts` et « Journal » sur le
 * web : y ranger le libellé d'onglet casserait les deux.
 *
 * Pourquoi pas non plus une réutilisation directe de `mobile-home.ts` : un
 * onglet n'a de place que pour un ou deux mots. « Journal privé » et « Mon
 * compte » sont des titres d'écran, pas des libellés d'onglet — la barre les
 * tronquerait, et une plateforme qui tronque un mot le fait sans prévenir.
 *
 * `today`, `journey` et `tandem` viennent quand même de `shared.ts` : ce sont
 * les mêmes mots, et les répéter ici serait ouvrir une divergence silencieuse.
 */
import { sharedLabels } from './shared'

export const copy = {
  fr: {
    ...sharedLabels.fr,
    journal: 'Journal',
  },
  en: {
    ...sharedLabels.en,
    journal: 'Journal',
  },
} as const
