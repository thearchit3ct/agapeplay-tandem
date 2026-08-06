/**
 * Qui a le droit de voir le chemin de déblocage.
 *
 * La migration `20260806012728_blocage_effectif.sql` a fait de `blocked_by` la
 * clé du déblocage : la politique `tandems_update_member` n'accepte de toucher
 * une ligne déjà `blocked` que si `auth.uid() = blocked_by`. La base sait donc
 * dire non — mais un bouton qui part et revient en erreur est une promesse
 * trahie. C'est cette fonction qui décide, côté client, si le bouton existe.
 *
 * Elle est pure, sans React ni Supabase, pour que les quatre cas soient
 * éprouvables sans base de données : c'est la seule partie de l'écran de
 * déblocage qui porte une règle plutôt qu'un affichage.
 */

/** Statut d'un tandem tel que la colonne `tandems.status` le stocke. */
export type TandemStatus = 'active' | 'paused' | 'blocked' | 'ended'

export type TandemBlockView = {
  /** `null` quand aucun tandem distant n'est chargé. */
  status: TandemStatus | null
  /** `tandems.blocked_by` — NULL sur les lignes bloquées avant la migration. */
  blockedBy: string | null
  /** L'identifiant de la personne connectée, absent hors session. */
  currentUserId: string | null | undefined
}

/**
 * - `hidden` : rien à proposer, l'écran n'affiche aucun chemin de déblocage.
 * - `unblockable` : la personne connectée a posé ce blocage, elle peut le lever.
 * - `blocked-by-other` : c'est l'autre qui a bloqué. On le dit, sans bouton.
 * - `frozen` : ligne héritée, `blocked_by` NULL — personne ne peut lever le
 *   blocage par l'API, la levée passe par le support.
 */
export type UnblockAffordance = 'hidden' | 'unblockable' | 'blocked-by-other' | 'frozen'

export function unblockAffordance({ status, blockedBy, currentUserId }: TandemBlockView): UnblockAffordance {
  // Sans identité, on ne sait pas de quel côté du blocage on se tient — et
  // « ce blocage est gelé, écris au support » est une affirmation sur *la ligne
  // de cette personne*. Ce garde-fou passe donc avant tous les autres.
  if (!currentUserId) return 'hidden'

  // `ended` n'est pas un blocage. La politique laisse d'ailleurs les deux
  // participants modifier une ligne `ended` (l'échappatoire `status <> 'blocked'`),
  // mais « lever » une relation terminée serait une tout autre décision produit.
  if (status !== 'blocked') return 'hidden'

  // Ligne héritée d'avant la migration : le schéma ne dit pas qui a bloqué, et
  // deviner reviendrait à confier la levée à un inconnu.
  if (!blockedBy) return 'frozen'

  return blockedBy === currentUserId ? 'unblockable' : 'blocked-by-other'
}
