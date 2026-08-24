/**
 * Les deux gestes de protection, et quand l'écran a le droit de les proposer.
 *
 * Bloquer et signaler ne se ferment pas de la même façon, et c'est tout
 * l'intérêt de cette fonction :
 *
 * - **Signaler reste ouvert quand la relation est bloquée.** C'est délibéré,
 *   des deux côtés du produit : `blocage_effectif` garde la lecture de
 *   l'historique à celui qui a bloqué, en toutes lettres « qui bloque a souvent
 *   besoin de l'historique pour signaler ». Fermer le signalement au moment où
 *   il sert le plus retirerait le geste à la personne qu'il protège. Côté base,
 *   rien ne s'y oppose : le `exists` de `reports_insert_member` interroge
 *   `tandems`, dont la politique de lecture laisse passer les deux
 *   participants, blocage ou non.
 * - **Bloquer se ferme plus tôt que la politique ne l'exige.** Sur une ligne
 *   `ended`, `tandems_update_member` accepterait le passage à `blocked` — le
 *   `using` sort par `status <> 'blocked'` et le `with check` est satisfait par
 *   `blocked_by = auth.uid()`. L'écran ne le propose pas : bloquer une relation
 *   déjà terminée n'a pas de sens pour la personne, et le web ne l'offre pas
 *   non plus. L'interface est ici plus fermée que la base, volontairement.
 *
 * Sur une ligne bloquée, en revanche, il n'y a rien à décider : le blocage est
 * déjà là. C'est `unblockAffordance` qui dit alors ce qui est possible, et
 * `accesConversation` ce qui reste lisible. Trois fonctions, trois questions.
 */
import type { TandemBlockView } from './blocking'

export type GestesDeProtection = {
  /** Proposer « bloquer cette relation » ? */
  peutBloquer: boolean
  /** Proposer « signaler un problème » ? */
  peutSignaler: boolean
}

export function gestesDeProtection({ status, currentUserId }: TandemBlockView): GestesDeProtection {
  // Sans identité ni tandem chargé, il n'y a pas de relation à protéger : les
  // deux écritures nomment un `tandem_id` et un `auth.uid()`, et sans eux elles
  // n'auraient rien à dire au serveur.
  if (!currentUserId || !status) return { peutBloquer: false, peutSignaler: false }

  // `blocked` et `ended` gardent le signalement : une relation qu'on a quittée
  // ou fermée reste une relation sur laquelle on peut avoir à alerter.
  return { peutBloquer: status === 'active' || status === 'paused', peutSignaler: true }
}
