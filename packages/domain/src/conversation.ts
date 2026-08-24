/**
 * Ce qu'une personne peut faire de la conversation de son tandem.
 *
 * Deux droits, et ils ne se recouvrent pas : lire l'historique et y écrire.
 * Les deux sont décidés par le serveur — `messages_select_member` et
 * `messages_insert_member`, refaits par `20260806012728_blocage_effectif.sql`.
 * Cette fonction ne fait que dire *à l'avance* ce que ces deux politiques
 * répondront, pour que l'écran n'affiche ni un composeur qui lèvera, ni un vide
 * inexpliqué là où la lecture est coupée.
 *
 * Le cas qui justifie ce fichier : une personne bloquée par l'autre reçoit
 * **zéro ligne sans erreur** — la politique de lecture la filtre en silence.
 * Un écran qui ne lirait que `error` conclurait « aucun message » et afficherait
 * « rien encore ». C'est faux, et c'est cruel : la conversation existe, elle lui
 * est fermée.
 *
 * Ce que cette fonction ne dit **pas** : qui a posé le blocage, et qui peut le
 * lever. C'est `unblockAffordance` qui tranche cela, et il n'y a pas deux
 * sources pour cette clé-là. L'écran compose les deux réponses.
 */
import type { TandemBlockView } from './blocking'

export type AccesConversation = {
  /** L'historique remontera-t-il ? `false` ⇒ le serveur rendra une liste vide. */
  peutLire: boolean
  /** Un envoi aboutira-t-il ? `false` ⇒ le `with check` d'insertion lèverait. */
  peutEcrire: boolean
}

export function accesConversation({ status, blockedBy, currentUserId }: TandemBlockView): AccesConversation {
  // Sans identité ni tandem chargé, il n'y a pas de conversation dont parler.
  if (!currentUserId || !status) return { peutLire: false, peutEcrire: false }

  // `messages_insert_member` exige `t.status in ('active', 'paused')`. `paused`
  // écrit donc autant qu'`active` : ce n'est pas un blocage, et le refermer ici
  // inventerait une règle que la base n'a pas.
  if (status === 'active' || status === 'paused') return { peutLire: true, peutEcrire: true }

  // `ended` n'est pas un blocage : la politique de lecture ne regarde que
  // `status <> 'blocked'`, l'historique reste donc entier pour les deux. Seule
  // l'écriture se ferme, faute d'être `active` ou `paused`.
  if (status === 'ended') return { peutLire: true, peutEcrire: false }

  // Reste `blocked`. La lecture est gardée pour qui a bloqué — il en a souvent
  // besoin pour signaler — et coupée pour l'autre. Sur une ligne gelée
  // (`blocked_by` NULL, héritée d'avant la migration), elle est coupée pour les
  // deux : `auth.uid() = t.blocked_by` n'est vrai de personne.
  return { peutLire: blockedBy === currentUserId, peutEcrire: false }
}
