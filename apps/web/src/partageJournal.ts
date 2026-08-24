/**
 * Les cinq requêtes du partage de journal, et pas une de plus.
 *
 * Elles sont ici plutôt que dans le composant pour la raison qui a sorti
 * `moderation.ts` d'`App.tsx` : chacune épouse une garde du schéma, et la
 * façon dont elle est écrite *est* la garde côté client. Deux formes comptent
 * particulièrement ici, et les commentaires disent à chaque fois laquelle sert.
 *
 * **Toute écriture lit sa réponse.** C'est la règle du dépôt, et le partage de
 * journal en est le cas d'école : `journal_shares_select_author` et
 * `journal_select_own` masquent aux ordres DELETE les lignes qui ne sont pas
 * les leurs. Un retrait ou une suppression refusés ne lèvent donc **rien** —
 * ils touchent zéro ligne, en silence. Un écran qui ne lirait que `error`
 * annoncerait « c'est retiré » sur un partage toujours ouvert : le pire
 * mensonge possible sur cet écran-là. D'où le `.select()` accroché à chaque
 * suppression, qui rend les lignes réellement touchées et transforme le
 * silence en fait mesurable.
 *
 * **Le destinataire ne lit pas la table.** Il appelle
 * `journal_partage_avec_moi()` — voir `20260825160000_partage_du_journal.sql`
 * pour le pourquoi : `journal_entries` reste own-only, aucune politique n'y a
 * été ajoutée, et la fonction est le seul chemin.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Un partage posé par la personne connectée, tel que son journal l'affiche. */
export type PartageEmis = {
  entreeId: string
  tandemId: string
  poseLe: string
}

/** Une entrée qu'un binôme a ouverte à la personne connectée. */
export type EntreePartagee = {
  entreeId: string
  texte: string
  humeur: string
  ecritLe: string
  partageLe: string
}

/**
 * Les partages que j'ai posés.
 *
 * Aucun filtre sur `shared_by` : `journal_shares_select_author` le pose déjà,
 * et l'écrire ici en plus laisserait croire que la garde est côté client. Une
 * erreur rend une liste vide **et** le drapeau d'échec : sans lui, l'écran
 * afficherait « aucune entrée partagée » sur une lecture qui a échoué, et
 * proposerait de repartager ce qui l'est déjà.
 */
export const chargerPartagesEmis = async (
  client: SupabaseClient,
): Promise<{ partages: PartageEmis[]; erreur: boolean }> => {
  const { data, error } = await client.from('journal_shares').select('entry_id, tandem_id, created_at')
  if (error) return { partages: [], erreur: true }
  return {
    partages: (data ?? []).map((ligne) => ({
      entreeId: ligne.entry_id as string,
      tandemId: ligne.tandem_id as string,
      poseLe: ligne.created_at as string,
    })),
    erreur: false,
  }
}

/**
 * Ce que mon binôme m'a partagé.
 *
 * La fonction est sans paramètre : elle ne répond que sur l'appelant, et elle
 * ne rend rien sur un tandem bloqué ou terminé. Une liste vide ne signifie donc
 * pas « il ne m'a rien partagé » — elle peut vouloir dire « la relation est
 * fermée ». C'est `partageDuJournal()` qui tranche, côté écran, et c'est
 * pourquoi ce module ne se risque pas à interpréter le vide.
 */
export const chargerPartagesRecus = async (
  client: SupabaseClient,
): Promise<{ entrees: EntreePartagee[]; erreur: boolean }> => {
  const { data, error } = await client.rpc('journal_partage_avec_moi')
  if (error) return { entrees: [], erreur: true }
  const lignes = (data ?? []) as Array<Record<string, unknown>>
  return {
    entrees: lignes.map((ligne) => ({
      entreeId: ligne.entree_id as string,
      texte: ligne.texte as string,
      humeur: ligne.humeur as string,
      ecritLe: ligne.ecrit_le as string,
      partageLe: ligne.partage_le as string,
    })),
    erreur: false,
  }
}

/**
 * Ouvre une entrée à son binôme.
 *
 * Les trois conjoncts du `with check` (l'entrée est la mienne, le tandem est le
 * mien, il est vivant) sont vérifiés par le serveur : une insertion refusée
 * **lève** ici, contrairement aux suppressions plus bas — un `with check` viole
 * la politique au lieu de filtrer des lignes. On rend donc le résultat plutôt
 * que de laisser passer l'exception, et l'écran dit « rien n'a changé ».
 */
export const poserPartage = async (
  client: SupabaseClient,
  partage: { entreeId: string; tandemId: string; auteurId: string },
): Promise<{ pose: boolean; poseLe: string | null }> => {
  const { data, error } = await client
    .from('journal_shares')
    .insert({ entry_id: partage.entreeId, tandem_id: partage.tandemId, shared_by: partage.auteurId })
    .select('created_at')
  if (error || !data || data.length === 0) return { pose: false, poseLe: null }
  return { pose: true, poseLe: data[0].created_at as string }
}

/**
 * Retire un partage. Rend le nombre de lignes réellement retirées.
 *
 * `.select()` n'est pas décoratif : sans lui, `data` vaut `null` et un retrait
 * qui n'a rien touché serait indiscernable d'un retrait réussi. Voir l'en-tête.
 */
export const retirerPartage = async (
  client: SupabaseClient,
  entreeId: string,
): Promise<{ retirees: number; erreur: boolean }> => {
  const { data, error } = await client.from('journal_shares').delete().eq('entry_id', entreeId).select('entry_id')
  if (error) return { retirees: 0, erreur: true }
  return { retirees: (data ?? []).length, erreur: false }
}

/**
 * Efface une entrée du journal. Rend le nombre de lignes réellement effacées.
 *
 * `journal_delete_own` existe depuis la toute première migration — c'est
 * l'écran qui n'avait pas le geste. Les partages posés sur cette entrée partent
 * avec elle, par la clé étrangère `on delete cascade` : rien à faire ici, et
 * `tests/rls/partage-journal.test.ts` en fait la preuve plutôt que de le
 * supposer.
 */
export const supprimerEntree = async (
  client: SupabaseClient,
  entreeId: string,
): Promise<{ supprimees: number; erreur: boolean }> => {
  const { data, error } = await client.from('journal_entries').delete().eq('id', entreeId).select('id')
  if (error) return { supprimees: 0, erreur: true }
  return { supprimees: (data ?? []).length, erreur: false }
}
