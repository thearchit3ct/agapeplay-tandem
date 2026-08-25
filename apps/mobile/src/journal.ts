/**
 * Le journal mobile et ses partages — issue #13, troisième front.
 *
 * Le jumeau d'`apps/web/src/partageJournal.ts`, dont l'en-tête porte le
 * raisonnement une fois pour les deux : chaque requête épouse une garde du
 * schéma, **toute suppression lit les lignes réellement touchées** (un DELETE
 * que le `using` refuse ne lève rien, il touche zéro ligne en silence), et le
 * destinataire ne lit jamais `journal_entries` — il appelle
 * `journal_partage_avec_moi()`, seul chemin ouvert par
 * `20260825160000_partage_du_journal.sql`.
 *
 * Ce fichier ne dit que ce qui diffère réellement du web :
 *
 *   - **le client est un singleton de module**, comme dans `mesure.ts` et
 *     `bilan.ts` : le mobile n'a pas d'objet de session qui circule en props ;
 *   - **l'identifiant de l'entrée vient de la base**, jamais du client.
 *     `crypto.randomUUID` n'est pas garantie sous Hermes (voir `mesure.ts`), et
 *     `journal_entries.id` a un `default gen_random_uuid()` : on insère sans
 *     `id` et on relit la ligne rendue. Le web, lui, en fabrique un parce que
 *     sa file hors-ligne a besoin d'une clé stable avant l'aller-retour ;
 *   - **aucune file hors-ligne**. Écrire dans le journal demande la connexion,
 *     et l'écran le dit — c'est l'écart déjà assumé par la conversation
 *     mobile (doc 21), et non une file à moitié faite ;
 *   - **`mood` n'est pas envoyé.** Le produit n'a qu'une humeur, la valeur par
 *     défaut de la colonne (« Présent ») : le web l'écrit en dur et affiche sa
 *     traduction, il ne la choisit nulle part. Inventer ici une liste
 *     d'humeurs créerait un vocabulaire que le web ne saurait pas relire.
 */
import { supabase } from './supabase'
import type { TandemStatus } from '@agapeplay/domain'

/** Une entrée du journal de la personne connectée. */
export type EntreeDeJournal = {
  id: string
  texte: string
  humeur: string
  ecritLe: string
}

/** Une entrée qu'un binôme a ouverte à la personne connectée. */
export type EntreePartagee = {
  entreeId: string
  texte: string
  humeur: string
  ecritLe: string
  partageLe: string
}

/** Le tandem courant, tel que les règles de partage veulent le connaître. */
export type TandemCourant = { id: string; status: TandemStatus } | null

/**
 * Le tandem le plus récent, ou `null`.
 *
 * La même lecture que l'écran tandem, refaite ici plutôt qu'importée depuis
 * lui : un écran n'est pas un module de données, et l'y prendre ferait dépendre
 * le journal du montage d'un autre écran. `partageDuJournal` a besoin du statut
 * pour dire ce que l'écran a le droit de proposer — sans lui, il proposerait un
 * partage que le `with check` refuserait.
 */
export const lireTandemCourant = async (compteId: string): Promise<TandemCourant> => {
  const client = supabase
  if (!client) return null
  const { data, error } = await client
    .from('tandems')
    .select('id, status, created_at')
    .or(`participant_a_id.eq.${compteId},participant_b_id.eq.${compteId}`)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error || !data?.[0]) return null
  return { id: data[0].id as string, status: data[0].status as TandemStatus }
}

/**
 * Les entrées de la personne connectée, la plus récente d'abord.
 *
 * Aucun filtre sur `user_id` : `journal_select_own` le pose déjà, et l'écrire
 * ici en plus laisserait croire que la garde est côté client. Le drapeau
 * d'erreur compte : sans lui, une lecture en panne s'afficherait comme un
 * journal vide, et l'écran inviterait à écrire une première entrée à quelqu'un
 * qui en a cent.
 */
export const chargerJournal = async (): Promise<{ entrees: EntreeDeJournal[]; erreur: boolean }> => {
  const client = supabase
  if (!client) return { entrees: [], erreur: true }
  const { data, error } = await client
    .from('journal_entries')
    .select('id, text, mood, created_at')
    .order('created_at', { ascending: false })
  if (error) return { entrees: [], erreur: true }
  return {
    entrees: (data ?? []).map((ligne) => ({
      id: ligne.id as string,
      texte: ligne.text as string,
      humeur: ligne.mood as string,
      ecritLe: ligne.created_at as string,
    })),
    erreur: false,
  }
}

/**
 * Écrit une entrée et rend **la ligne telle que la base l'a gardée**.
 *
 * `user_id` est envoyé explicitement : `journal_insert_own` exige
 * `auth.uid() = user_id`, et la colonne n'a pas de valeur par défaut. `id` et
 * `created_at`, eux, ne le sont jamais — voir l'en-tête. Un objet fabriqué ici
 * porterait l'heure du téléphone, qui peut être fausse de plusieurs heures.
 */
export const ecrireEntree = async (compteId: string, texte: string): Promise<EntreeDeJournal | null> => {
  const client = supabase
  if (!client) return null
  const { data, error } = await client
    .from('journal_entries')
    .insert({ user_id: compteId, text: texte })
    .select('id, text, mood, created_at')
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id as string,
    texte: data.text as string,
    humeur: data.mood as string,
    ecritLe: data.created_at as string,
  }
}

/**
 * Efface une entrée. Rend le nombre de lignes réellement effacées.
 *
 * Les partages posés sur cette entrée partent avec elle, par la clé étrangère
 * `on delete cascade` — c'est `tests/rls/partage-journal.test.ts` qui en fait
 * la preuve, et non ce commentaire.
 */
export const supprimerEntree = async (entreeId: string): Promise<{ supprimees: number; erreur: boolean }> => {
  const client = supabase
  if (!client) return { supprimees: 0, erreur: true }
  const { data, error } = await client.from('journal_entries').delete().eq('id', entreeId).select('id')
  if (error) return { supprimees: 0, erreur: true }
  return { supprimees: (data ?? []).length, erreur: false }
}

/** Les partages que j'ai posés, par identifiant d'entrée. */
export const chargerPartagesEmis = async (): Promise<{ entrees: Set<string>; erreur: boolean }> => {
  const client = supabase
  if (!client) return { entrees: new Set(), erreur: true }
  const { data, error } = await client.from('journal_shares').select('entry_id')
  if (error) return { entrees: new Set(), erreur: true }
  return { entrees: new Set((data ?? []).map((ligne) => ligne.entry_id as string)), erreur: false }
}

/**
 * Ce que mon binôme m'a partagé.
 *
 * La fonction est sans paramètre : elle ne répond que sur l'appelant, et elle
 * ne rend rien sur un tandem bloqué ou terminé. Une liste vide ne signifie donc
 * pas « il ne m'a rien partagé » — c'est `partageDuJournal()` qui tranche, côté
 * écran, et ce module ne se risque pas à interpréter le vide.
 */
export const chargerPartagesRecus = async (): Promise<{ entrees: EntreePartagee[]; erreur: boolean }> => {
  const client = supabase
  if (!client) return { entrees: [], erreur: true }
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
 * **lève**, contrairement aux suppressions — un `with check` viole la politique
 * au lieu de filtrer des lignes. On rend donc le résultat plutôt que de laisser
 * passer l'exception, et l'écran dit « rien n'a changé ».
 */
export const poserPartage = async (
  partage: { entreeId: string; tandemId: string; auteurId: string },
): Promise<boolean> => {
  const client = supabase
  if (!client) return false
  const { data, error } = await client
    .from('journal_shares')
    .insert({ entry_id: partage.entreeId, tandem_id: partage.tandemId, shared_by: partage.auteurId })
    .select('entry_id')
  return !error && (data ?? []).length > 0
}

/**
 * Retire un partage. Rend le nombre de lignes réellement retirées.
 *
 * `.select()` n'est pas décoratif : sans lui, `data` vaut `null` et un retrait
 * qui n'a rien touché serait indiscernable d'un retrait réussi. Voir l'en-tête.
 */
export const retirerPartage = async (entreeId: string): Promise<{ retirees: number; erreur: boolean }> => {
  const client = supabase
  if (!client) return { retirees: 0, erreur: true }
  const { data, error } = await client.from('journal_shares').delete().eq('entry_id', entreeId).select('entry_id')
  if (error) return { retirees: 0, erreur: true }
  return { retirees: (data ?? []).length, erreur: false }
}
