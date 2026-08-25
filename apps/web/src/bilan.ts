/**
 * Les deux requêtes du bilan de fin de semaine — issue #18.
 *
 * Deux, et il n'en faut pas plus : lire ce qui a déjà été répondu, et poser une
 * réponse. La note et son partage n'ont **aucun code ici** — ce sont une entrée
 * de journal et une ligne de `journal_shares`, écrites par les chemins qui
 * existent depuis l'issue #11. Voir l'en-tête de
 * `20260825213000_bilan_hebdomadaire.sql` pour le raisonnement complet ; la
 * conséquence en TypeScript est ce fichier de soixante lignes.
 *
 * **L'écriture lit sa réponse**, comme partout. Le cas est moins spectaculaire
 * qu'un retrait de partage — les politiques sont own-only et rien n'est masqué
 * à l'insertion — mais le mode d'échec reste le même : un `upsert` refusé pour
 * une autre raison (contrainte de format, réseau) ne se voit que dans `error`,
 * et un écran qui ne le lirait pas afficherait « c'est noté » sur une réponse
 * qui n'existe pas. On lit, et l'appelant décide quoi dire.
 *
 * Ce module ne calcule **jamais** de semaine : `semaineDuBilan` et
 * `cleDeSemaine` vivent dans le domaine, avec leurs tests, et la clé arrive
 * ici toute faite. Recalculer une date au bord d'une requête est la façon
 * classique de se retrouver avec deux règles.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EtatDeSemaine } from '@agapeplay/domain'

/** Un bilan posé, tel que l'écran l'affiche. */
export type BilanPose = {
  semaine: string
  etat: EtatDeSemaine
  /**
   * Quand la réponse a été posée ou corrigée.
   *
   * Lu pour une seule raison : un bilan est un signe de vie au même titre
   * qu'une séance terminée, et l'écran d'accueil a besoin du plus récent des
   * deux pour savoir s'il accueille quelqu'un qui revient. Sans cette colonne,
   * quelqu'un qui répond chaque samedi sans ouvrir de séance serait accueilli
   * « de retour » alors qu'il n'est jamais parti.
   */
  poseLe: string
}

/**
 * Les bilans déjà répondus.
 *
 * Aucun filtre sur `user_id` : `weekly_checkins_select_own` le pose déjà, et
 * l'écrire ici laisserait croire que la garde est côté client.
 *
 * Le drapeau d'échec compte autant que la liste. Sans lui, une lecture qui
 * échoue rendrait une liste vide, l'écran conclurait « pas encore répondu » et
 * reposerait la question de la semaine — celle à laquelle la personne vient
 * peut-être de répondre. Une question déjà répondue qu'on repose est le petit
 * harcèlement que ce chantier essaie précisément de ne pas produire.
 */
export const chargerBilans = async (
  client: SupabaseClient,
): Promise<{ bilans: BilanPose[]; erreur: boolean }> => {
  const { data, error } = await client.from('weekly_checkins').select('week_key, state, updated_at')
  if (error) return { bilans: [], erreur: true }
  return {
    bilans: (data ?? []).map((ligne) => ({
      semaine: ligne.week_key as string,
      etat: ligne.state as EtatDeSemaine,
      poseLe: ligne.updated_at as string,
    })),
    erreur: false,
  }
}

/**
 * Pose ou corrige la réponse d'une semaine.
 *
 * `upsert` sur `(user_id, week_key)` plutôt qu'un `insert` : répondre deux fois
 * pour la même semaine n'est pas deux bilans, c'est une réponse corrigée — la
 * clé primaire le dit déjà, et un `insert` échouerait avec une violation de
 * contrainte là où la personne a simplement changé d'avis.
 *
 * `user_id` est envoyé explicitement parce que la colonne n'a pas de valeur par
 * défaut ; `weekly_checkins_insert_own` et le `with check` de l'update
 * vérifient qu'il vaut bien l'appelant. Un identifiant d'autrui ne passerait
 * pas — mais il n'est pas non plus question de le tenter depuis ici.
 */
export const poserBilan = async (
  client: SupabaseClient,
  compteId: string,
  semaine: string,
  etat: EtatDeSemaine,
): Promise<boolean> => {
  const { error } = await client.from('weekly_checkins').upsert(
    {
      user_id: compteId,
      week_key: semaine,
      state: etat,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,week_key' },
  )
  return !error
}
