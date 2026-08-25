/**
 * Le bilan de fin de semaine, côté mobile — issue #18.
 *
 * Le jumeau d'`apps/web/src/bilan.ts`, et les décisions sont écrites là-bas une
 * fois pour les deux : une semaine et un mot, la note reste une entrée de
 * journal, l'écriture lit sa réponse. Ce fichier ne porte que ce qui diffère.
 *
 * Ce qui diffère, et c'est tout :
 *
 *   - **le client Supabase est un singleton de module**, comme dans
 *     `mesure.ts` : le mobile n'a pas d'objet de session qui circule en props ;
 *   - **la préférence de rappel se lit et s'écrit ici**. Le mobile n'a pas
 *     d'écran de réglages, et `notification_preferences.weekly_checkin` vit sur
 *     le compte : un interrupteur local serait un second endroit qui dit la
 *     même chose, et quelqu'un qui a coupé le rappel depuis son navigateur le
 *     retrouverait allumé sur son téléphone. C'est exactement le bug que le
 *     consentement à la mesure a déjà corrigé (voir `mesure.ts`) ;
 *   - **rien n'est mis en file**. Le bilan n'entre pas dans `offlineQueue.ts` —
 *     une question de fin de semaine posée hier n'a pas à être renvoyée demain,
 *     et l'écran le dit plutôt que de le promettre.
 */
import { supabase } from './supabase'
import type { EtatDeSemaine } from '@agapeplay/domain'

export type EtatDuBilan = {
  /** Les semaines déjà renseignées. */
  semainesFaites: string[]
  /** Le dernier signe de vie connu — séance terminée ou bilan posé. */
  derniereActivite: Date | null
  /** `notification_preferences.weekly_checkin`, ou son défaut. */
  rappelBilan: boolean
  /** `notification_preferences.absence`, ou son défaut. */
  rappelAbsence: boolean
  /**
   * Les séances déjà terminées, par identifiant — issue #13.
   *
   * Lues ici parce que la progression est déjà interrogée pour connaître la
   * dernière activité : demander deux fois la même table à deux endroits
   * paierait deux allers-retours pour une seule question.
   */
  seancesFaites: string[]
  /**
   * `notification_preferences.sessions`, ou son défaut — issue #13.
   *
   * Il est lu ici, avec les deux autres, parce que c'est la même ligne et la
   * même question : que proposer à l'ouverture de l'écran. Jusqu'au
   * 26/08/2026 le rappel de séance vivait dans une clé locale du téléphone, et
   * un rappel coupé depuis le navigateur revenait donc sur l'appareil.
   */
  rappelSeance: boolean
}

/**
 * Les deux réglages de rappel que le mobile sait poser, par leur nom de
 * colonne. `messages`, `church` et `absence` n'en sont pas : voir
 * `PreferencesDeRappel` dans le domaine.
 */
export type ClefDeRappel = 'weekly_checkin' | 'sessions'

/**
 * Ce que l'écran d'accueil a besoin de savoir, en une lecture.
 *
 * Les trois requêtes partent ensemble parce qu'elles répondent à la même
 * question — que proposer — et qu'une seule des trois laisserait les autres
 * décider à l'aveugle : sans les préférences, on proposerait un rappel coupé ;
 * sans la progression, on accueillerait « de retour » quelqu'un qui n'est
 * jamais parti.
 *
 * Une lecture qui échoue rend les défauts et **aucune semaine faite** — ce qui
 * ferait reposer une question déjà répondue. Le repli inverse (tout supposer
 * fait) serait pire : il ferait disparaître le geste sans rien dire. Entre
 * insister à tort et s'effacer à tort, l'écran choisit d'insister, parce que
 * c'est le seul des deux qui se corrige d'un appui.
 */
export const lireEtatDuBilan = async (compteId: string): Promise<EtatDuBilan> => {
  const client = supabase
  if (!client) return { semainesFaites: [], seancesFaites: [], derniereActivite: null, rappelBilan: true, rappelAbsence: true, rappelSeance: true }

  const [bilans, progression, preferences] = await Promise.all([
    client.from('weekly_checkins').select('week_key, updated_at'),
    client.from('session_progress').select('session_id, completed_at').eq('user_id', compteId),
    client.from('notification_preferences').select('weekly_checkin, absence, sessions').eq('user_id', compteId).maybeSingle(),
  ])

  const instants = [
    ...(bilans.data ?? []).map((ligne) => ligne.updated_at as string | null),
    ...(progression.data ?? []).map((ligne) => ligne.completed_at as string | null),
  ].filter((valeur): valeur is string => Boolean(valeur)).sort()

  return {
    semainesFaites: (bilans.data ?? []).map((ligne) => ligne.week_key as string),
    seancesFaites: (progression.data ?? []).map((ligne) => ligne.session_id as string),
    // Les dates ISO se comparent lexicographiquement : le tri suffit, et la
    // dernière est la plus récente.
    derniereActivite: instants.length > 0 ? new Date(instants[instants.length - 1]) : null,
    // Ligne absente = les défauts de la table, qui sont `true` pour les trois.
    rappelBilan: preferences.data?.weekly_checkin ?? true,
    rappelAbsence: preferences.data?.absence ?? true,
    rappelSeance: preferences.data?.sessions ?? true,
  }
}

/**
 * Pose ou corrige la réponse d'une semaine. Rend `false` si rien n'a été écrit.
 *
 * `upsert` sur `(user_id, week_key)` : répondre deux fois pour la même semaine
 * n'est pas deux bilans, c'est une réponse corrigée.
 */
export const poserBilan = async (compteId: string, semaine: string, etat: EtatDeSemaine): Promise<boolean> => {
  const client = supabase
  if (!client) return false
  const { error } = await client.from('weekly_checkins').upsert(
    { user_id: compteId, week_key: semaine, state: etat, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,week_key' },
  )
  return !error
}

/**
 * Bascule un rappel, et rend **l'état réellement enregistré des deux**.
 *
 * L'écriture lit sa réponse, comme partout : un interrupteur qui bascule à
 * l'écran sur une écriture refusée ferait croire à un réglage posé, et le
 * rappel reviendrait au prochain lancement sans que rien ne l'explique. Les
 * deux valeurs reviennent ensemble parce que l'appelant en a besoin des deux —
 * c'est la liste complète des rappels qu'il replanifie ensuite, jamais un
 * delta (voir `rappelsAPlanifier`).
 *
 * Une seule colonne part dans la charge utile : PostgREST n'écrit à la mise à
 * jour que ce qu'on lui donne, si bien que basculer le bilan ne peut pas
 * effacer le réglage des séances. `null` en retour vaut « rien n'a bougé ».
 */
export const basculerRappel = async (
  compteId: string,
  clef: ClefDeRappel,
  actif: boolean,
): Promise<{ rappelBilan: boolean; rappelSeance: boolean } | null> => {
  const client = supabase
  if (!client) return null
  const { data, error } = await client
    .from('notification_preferences')
    .upsert({ user_id: compteId, [clef]: actif, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('weekly_checkin, sessions')
    .maybeSingle()
  if (error || !data) return null
  return { rappelBilan: data.weekly_checkin as boolean, rappelSeance: data.sessions as boolean }
}
