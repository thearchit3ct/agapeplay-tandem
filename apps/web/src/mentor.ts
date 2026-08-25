/**
 * L'accès aux données de l'espace mentor — issue #16.
 *
 * Six fonctions, deux RPC et quatre écritures. La règle du dépôt s'applique
 * partout ici, et elle mérite d'être répétée parce que trois des quatre
 * écritures sont des UPDATE gardés par un `using` : **toute écriture lit sa
 * réponse**. Un UPDATE écarté par un `using` ne lève rien — PostgREST rend
 * `error: null` et zéro ligne — donc rien ici ne juge l'absence d'erreur : on
 * juge la ligne rendue.
 *
 * Rien ne traduit, rien ne calcule, rien n'ordonne : le signal arrive déjà
 * décidé par `tandem_mes_accompagnements()`, l'ordre est celui que la base a
 * choisi (alphabétique), et les mots d'encouragement sont des clés que la vue
 * traduit. C'est délibéré — un tri côté client serait un tri qu'aucun test SQL
 * ne garde.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Accompagnement, CategorieAide, MonAccompagnement, MotEncouragement } from '@agapeplay/domain'

type LigneSuivi = {
  assignment_id: string
  participant_id: string
  nom: string
  depuis_le: string
  signal: Accompagnement['signal']
  aide_ouverte_id: string | null
  aide_categorie: CategorieAide | null
  aide_demandee_le: string | null
}

type LigneMienne = {
  assignment_id: string
  mentor_id: string
  nom: string
  statut: MonAccompagnement['statut']
  verification: MonAccompagnement['verification']
  formation: MonAccompagnement['formation']
  propose_le: string
}

/**
 * Le tableau de suivi. Rend un tableau vide en cas d'échec **et** en cas
 * d'absence de droit : les deux sont indiscernables ici, et c'est voulu — un
 * mentor non vérifié ne doit pas apprendre qu'il existe des lignes qu'il ne
 * voit pas. L'écran distingue les deux par la carte de vérification, qui est
 * juste au-dessus et qui, elle, dit la vérité.
 */
export const chargerAccompagnements = async (client: SupabaseClient): Promise<Accompagnement[]> => {
  const { data, error } = await client.rpc('tandem_mes_accompagnements')
  if (error || !data) return []
  return (data as LigneSuivi[]).map((ligne) => ({
    assignmentId: ligne.assignment_id,
    participantId: ligne.participant_id,
    nom: ligne.nom,
    depuisLe: ligne.depuis_le,
    signal: ligne.signal,
    aide: ligne.aide_ouverte_id && ligne.aide_categorie && ligne.aide_demandee_le
      ? { id: ligne.aide_ouverte_id, categorie: ligne.aide_categorie, demandeeLe: ligne.aide_demandee_le }
      : null,
  }))
}

/**
 * Ce que le participant voit de son côté. La plus récente d'abord — la RPC
 * ordonne déjà, on prend la première : une seule relation à la fois est le cas
 * réel, et afficher deux propositions concurrentes serait une question de
 * produit qui ne se pose pas encore.
 */
export const chargerMonAccompagnement = async (
  client: SupabaseClient,
): Promise<MonAccompagnement | null> => {
  const { data, error } = await client.rpc('tandem_mon_accompagnement')
  if (error || !data) return null
  const lignes = data as LigneMienne[]
  if (lignes.length === 0) return null
  const ligne = lignes[0]
  return {
    assignmentId: ligne.assignment_id,
    mentorId: ligne.mentor_id,
    nom: ligne.nom,
    statut: ligne.statut,
    verification: ligne.verification,
    formation: ligne.formation,
    proposeLe: ligne.propose_le,
  }
}

/**
 * Accepter ou refuser une proposition d'accompagnement.
 *
 * `active` n'est écrivable que par le participant (décision 5 du #17), et c'est
 * cette fonction qui en est le seul chemin dans toute l'application. Le
 * `select … maybeSingle()` n'est pas décoratif : sans lui, un refus par `using`
 * — un participant qui répondrait pour l'affectation d'un autre — passerait
 * pour un succès.
 */
export const repondreALaProposition = async (
  client: SupabaseClient,
  assignmentId: string,
  reponse: 'active' | 'ended',
): Promise<boolean> => {
  const { data, error } = await client
    .from('mentor_assignments')
    .update({ status: reponse })
    .eq('id', assignmentId)
    .select('id')
    .maybeSingle()
  return !error && Boolean(data)
}

/** Une demande d'aide ouverte, s'il y en a une. Sert à ne pas proposer d'appeler deux fois. */
export const chargerMaDemandeOuverte = async (
  client: SupabaseClient,
  moi: string,
): Promise<{ id: string; categorie: CategorieAide; statut: 'open' | 'acknowledged' } | null> => {
  const { data, error } = await client
    .from('help_requests')
    .select('id, category, status')
    .eq('requester_id', moi)
    .in('status', ['open', 'acknowledged'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return { id: data.id as string, categorie: data.category as CategorieAide, statut: data.status as 'open' | 'acknowledged' }
}

export const demanderDeLAide = async (
  client: SupabaseClient,
  demande: { assignmentId: string; mentorId: string; moi: string; categorie: CategorieAide },
): Promise<boolean> => {
  const { data, error } = await client
    .from('help_requests')
    .insert({
      assignment_id: demande.assignmentId,
      requester_id: demande.moi,
      mentor_id: demande.mentorId,
      category: demande.categorie,
    })
    .select('id')
    .maybeSingle()
  return !error && Boolean(data)
}

export const cloreMaDemande = async (client: SupabaseClient, id: string): Promise<boolean> => {
  const { data, error } = await client
    .from('help_requests')
    .update({ status: 'closed' })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  return !error && Boolean(data)
}

export const direQueJaiVu = async (client: SupabaseClient, id: string): Promise<boolean> => {
  const { data, error } = await client
    .from('help_requests')
    .update({ status: 'acknowledged' })
    .eq('id', id)
    .select('id')
    .maybeSingle()
  return !error && Boolean(data)
}

/**
 * Envoyer un mot. Trois issues, et l'écran doit les distinguer : envoyé, déjà
 * envoyé aujourd'hui, échoué.
 *
 * La deuxième est un **refus réussi** — l'index unique `(assignment_id, jour)`
 * a fait son travail — et la confondre avec une panne ferait dire « ça n'est
 * pas parti » à quelqu'un dont le message précédent, lui, est bien parti.
 * PostgREST rend `23505` sur une violation d'unicité.
 */
export const envoyerUnMot = async (
  client: SupabaseClient,
  envoi: { assignmentId: string; moi: string; participantId: string; mot: MotEncouragement },
): Promise<'envoye' | 'deja-aujourdhui' | 'echec'> => {
  const { data, error } = await client
    .from('mentor_encouragements')
    .insert({
      assignment_id: envoi.assignmentId,
      mentor_id: envoi.moi,
      participant_id: envoi.participantId,
      message_key: envoi.mot,
    })
    .select('id')
    .maybeSingle()
  if (error) return error.code === '23505' ? 'deja-aujourdhui' : 'echec'
  return data ? 'envoye' : 'echec'
}

export type MotRecu = { id: string; mot: MotEncouragement; recuLe: string; lu: boolean }

/**
 * Les mots reçus. Le filtre sur `participant_id` n'est pas redondant avec la
 * RLS : les deux politiques de lecture sont permissives et s'unissent, donc un
 * mentor qui est aussi accompagné lirait sans lui les mots qu'il a **envoyés**,
 * mêlés à ceux qu'il a reçus. La politique dit qui a le droit ; la requête dit
 * ce qu'on demande.
 */
export const chargerMesEncouragements = async (
  client: SupabaseClient,
  moi: string,
): Promise<MotRecu[]> => {
  const { data, error } = await client
    .from('mentor_encouragements')
    .select('id, message_key, created_at, read_at')
    .eq('participant_id', moi)
    .order('created_at', { ascending: false })
    .limit(5)
  if (error || !data) return []
  return data.map((ligne) => ({
    id: ligne.id as string,
    mot: ligne.message_key as MotEncouragement,
    recuLe: ligne.created_at as string,
    lu: ligne.read_at !== null,
  }))
}
