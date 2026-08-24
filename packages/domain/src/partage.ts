/**
 * Ce qu'une personne peut faire du partage de son journal.
 *
 * Le partage d'une entrée n'est pas un don : c'est une fenêtre ouverte dans une
 * relation vivante, et la migration `20260825160000_partage_du_journal.sql` la
 * referme dès que la relation cesse de l'être. Deux endroits disent la même
 * chose côté serveur, et cette fonction dit d'avance ce qu'ils répondront :
 *
 * - `journal_shares_insert_author` exige `t.status in ('active', 'paused')` :
 *   un partage ne se pose pas sur une relation bloquée ou terminée ;
 * - `journal_partage_avec_moi()` exige la même chose à la lecture : un partage
 *   déjà posé ne s'ouvre plus.
 *
 * Les deux droits coïncident donc toujours — c'est pour cela qu'il n'y a qu'un
 * seul drapeau ici, et non un `peutPartager` doublé d'un `partagesLisibles` qui
 * seraient condamnés à valoir la même chose. Ce que la fonction ajoute au
 * drapeau, c'est la `raison` : sans elle, l'écran n'aurait qu'un bouton absent
 * et un panneau vide à montrer, c'est-à-dire deux façons de laisser croire
 * qu'il n'y a jamais rien eu.
 *
 * Le cas qui justifie ce fichier — et le seul endroit où il fallait décider :
 * **un tandem bloqué referme les partages pour les deux, y compris pour la
 * personne qui a bloqué.** C'est l'exact contraire de `accesConversation`, où
 * `blocked` garde la lecture de l'historique à qui a posé le blocage. Les deux
 * règles sont justes en même temps parce qu'elles portent sur deux choses
 * différentes : la conversation est écrite à deux et sert à signaler ; une
 * entrée de journal reste entière à son auteur, et bloquer quelqu'un veut dire
 * « je ne lui donne plus rien à lire ». Le test de contraste, dans
 * `partage.test.ts`, est là pour qu'un correctif bien intentionné ne vienne pas
 * « harmoniser » les deux.
 */
import type { TandemBlockView } from './blocking'

/**
 * - `aucun-tandem` : personne à qui partager. L'écran propose d'inviter.
 * - `ouvert` : la relation est vivante (`active` ou `paused`).
 * - `bloque` : la relation est bloquée — par soi ou par l'autre, cela ne change
 *   rien ici, et c'est justement la décision. `unblockAffordance` dit, lui, de
 *   quel côté l'on se tient et s'il y a un chemin de retour.
 * - `termine` : la relation est terminée. Il n'y a pas de retour.
 */
export type RaisonPartage = 'aucun-tandem' | 'ouvert' | 'bloque' | 'termine'

export type PartageDuJournal = {
  /**
   * Poser un partage aboutira-t-il, et un partage déjà posé s'ouvre-t-il ?
   * `false` ⇒ ni bouton « partager », ni promesse que le binôme lira.
   */
  peutPartager: boolean
  raison: RaisonPartage
}

export function partageDuJournal({ status, currentUserId }: TandemBlockView): PartageDuJournal {
  // Sans identité ni tandem chargé, il n'y a pas de relation à ouvrir : le
  // `with check` d'insertion nomme un `tandem_id` et un `auth.uid()`, et sans
  // eux il n'aurait rien à dire au serveur.
  if (!currentUserId || !status) return { peutPartager: false, raison: 'aucun-tandem' }

  if (status === 'active' || status === 'paused') return { peutPartager: true, raison: 'ouvert' }

  // `blockedBy` n'est volontairement pas consulté : voir l'en-tête. La lecture
  // est fermée des deux côtés d'un blocage, sur cette table-là.
  return { peutPartager: false, raison: status === 'blocked' ? 'bloque' : 'termine' }
}
