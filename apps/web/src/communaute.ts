/**
 * Les requêtes de l'espace église — issue #17.
 *
 * Elles sont ici plutôt que dans le composant pour la même raison que
 * `invitations.ts` et `moderation.ts` : chacune épouse une politique du schéma,
 * et la façon dont elle est écrite *est* la garde.
 *
 * Une règle gouverne tout ce fichier, et c'est celle que la migration rend
 * indispensable : **toute écriture lit sa réponse**. Les politiques de ce
 * chantier refusent de deux façons différentes, et une seule fait du bruit —
 * un `with check` lève, un `using` ne lève pas. Un `update` que le `using`
 * écarte touche zéro ligne et PostgREST rend `error: null` ; l'écran dirait
 * « cohorte clôturée » sur une base qui n'a pas bougé. Chaque écriture demande
 * donc la ligne en retour, et l'absence de ligne compte comme un échec.
 */
import { pouvoirsEglise, refusDAdhesion } from '@agapeplay/domain'
import type {
  ChurchSnapshot, Cohorte, LienInvitation, RefusDAdhesion, RoleEglise, StatutEglise,
} from '@agapeplay/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Un membre tel que `tandem_membres_de_ma_communaute()` le rend. */
export type MembreCommunaute = {
  id: string
  nom: string
  role: RoleEglise
  statut: 'invited' | 'active' | 'revoked'
  entreLe: string
}

export type EspaceResponsable = {
  cohortes: Cohorte[]
  membres: MembreCommunaute[]
  liens: LienInvitation[]
}

const VIDE: EspaceResponsable = { cohortes: [], membres: [], liens: [] }

/**
 * L'appartenance du compte, et l'église qui va avec.
 *
 * `.limit(1)` **avec** un tri : la RPC de jointure interdit une seconde
 * appartenance active, mais un `.limit(1)` sans ordre choisirait au hasard le
 * jour où cette borne serait levée — et l'écran changerait de communauté d'un
 * rechargement à l'autre sans que personne comprenne pourquoi. Le tri coûte
 * zéro et rend la borne visible.
 *
 * Le nom et le statut viennent de `churches` par jointure PostgREST : la
 * politique `churches_member_read` la borne déjà aux églises dont on est
 * membre actif, il n'y a donc rien à filtrer de plus ici.
 */
export const chargerAppartenance = async (
  client: SupabaseClient,
  utilisateurId: string,
): Promise<ChurchSnapshot> => {
  const { data, error } = await client
    .from('church_members')
    .select('church_id, role, created_at, churches(name, status)')
    .eq('user_id', utilisateurId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
  if (error || !data || data.length === 0) return null

  const ligne = data[0] as unknown as {
    church_id: string
    role: RoleEglise
    churches: { name: string; status: StatutEglise } | null
  }
  // Sans la ligne d'église, on ne sait pas dire si les gestes liants sont
  // ouverts. Afficher un espace en supposant « active » serait proposer des
  // boutons que la base refuserait : on préfère ne rien afficher.
  if (!ligne.churches) return null

  const { count } = await client
    .from('group_members')
    .select('group_id', { count: 'exact', head: true })
    .eq('user_id', utilisateurId)

  return {
    churchId: ligne.church_id,
    nom: ligne.churches.name,
    statut: ligne.churches.status,
    role: ligne.role,
    groupCount: count ?? 0,
  }
}

/**
 * Ce qu'un responsable voit de sa communauté. Rien pour les autres — et ce
 * n'est pas l'écran qui le décide : les trois lectures rendent déjà vide sous
 * `church_invitations_leader_read` et `tandem_membres_de_ma_communaute()`. On
 * s'abstient quand même de les lancer, pour ne pas faire trois appels dont on
 * connaît la réponse.
 */
export const chargerEspaceResponsable = async (
  client: SupabaseClient,
  eglise: NonNullable<ChurchSnapshot>,
): Promise<EspaceResponsable> => {
  if (!pouvoirsEglise(eglise.role, eglise.statut).organiser) return VIDE

  const [groupes, membres, liens] = await Promise.all([
    client.from('church_groups').select('id, name, status, starts_on, ends_on')
      .eq('church_id', eglise.churchId).order('created_at', { ascending: false }),
    client.rpc('tandem_membres_de_ma_communaute'),
    client.from('church_invitations').select('token, status, expires_at, uses, max_uses')
      .eq('church_id', eglise.churchId).order('created_at', { ascending: false }),
  ])

  return {
    cohortes: (groupes.data ?? []).map(enCohorte),
    membres: ((membres.data ?? []) as LigneMembre[]).map((m) => ({
      id: m.user_id, nom: m.nom, role: m.role, statut: m.statut, entreLe: m.entre_le,
    })),
    liens: ((liens.data ?? []) as LigneLien[]).map(enLien),
  }
}

type LigneGroupe = { id: string; name: string; status: 'active' | 'closed'; starts_on: string | null; ends_on: string | null }
type LigneMembre = { user_id: string; nom: string; role: RoleEglise; statut: MembreCommunaute['statut']; entre_le: string }
type LigneLien = { token: string; status: 'pending' | 'revoked'; expires_at: string; uses: number; max_uses: number }

const enCohorte = (ligne: LigneGroupe): Cohorte => ({
  id: ligne.id, nom: ligne.name, statut: ligne.status, debutLe: ligne.starts_on, finLe: ligne.ends_on,
})

const enLien = (ligne: LigneLien): LienInvitation => ({
  jeton: ligne.token, statut: ligne.status, expireLe: ligne.expires_at,
  usages: ligne.uses, usagesMax: ligne.max_uses,
})

/**
 * Fonder : la RPC rend l'identifiant, ou lève un code.
 *
 * `nom_invalide` n'est pas traduit ici parce que l'écran ne laisse pas
 * atteindre ce cas — le bouton reste inerte tant que le champ est vide. Il
 * reste éprouvé côté base, où il vaut vraiment quelque chose : c'est la
 * dernière garde si un jour l'écran cesse d'en poser une.
 */
export const fonderCommunaute = async (
  client: SupabaseClient,
  nom: string,
): Promise<{ churchId: string } | { refus: RefusDAdhesion | 'nom_invalide' }> => {
  const { data, error } = await client.rpc('creer_ma_communaute', { p_nom: nom })
  if (error) {
    return { refus: error.message.includes('nom_invalide') ? 'nom_invalide' : refusDAdhesion(error.message) }
  }
  return typeof data === 'string' ? { churchId: data } : { refus: 'inconnu' }
}

/**
 * Rejoindre. Le jeton peut arriver sous deux formes — l'URL entière collée
 * depuis un message, ou le code seul lu à voix haute — et les deux mènent au
 * même appel : c'est `jetonDepuisUrl` qui les réconcilie côté écran.
 */
export const rejoindreCommunaute = async (
  client: SupabaseClient,
  jeton: string,
): Promise<{ churchId: string } | { refus: RefusDAdhesion }> => {
  const { data, error } = await client.rpc('rejoindre_une_communaute', { p_token: jeton })
  if (error) return { refus: refusDAdhesion(error.message) }
  return typeof data === 'string' ? { churchId: data } : { refus: 'inconnu' }
}

/**
 * Créer une cohorte. Le `select` de retour est ce qui prouve que la lecture
 * suit l'écriture : sans `groups_church_member_read`, cet appel rendrait une
 * ligne vide sur une insertion pourtant réussie, et l'écran annoncerait un
 * échec. Le test RLS qui garde cette paire porte le même nom que ce commentaire.
 */
export const creerCohorte = async (
  client: SupabaseClient,
  churchId: string,
  cohorte: { nom: string; debutLe: string | null; finLe: string | null },
): Promise<Cohorte | null> => {
  const { data, error } = await client
    .from('church_groups')
    .insert({ church_id: churchId, name: cohorte.nom, starts_on: cohorte.debutLe, ends_on: cohorte.finLe })
    .select('id, name, status, starts_on, ends_on')
    .maybeSingle()
  return error || !data ? null : enCohorte(data as LigneGroupe)
}

/** Clôturer. Refus silencieux possible : on lit le statut revenu, pas l'absence d'erreur. */
export const cloturerCohorte = async (client: SupabaseClient, cohorteId: string): Promise<boolean> => {
  const { data, error } = await client
    .from('church_groups')
    .update({ status: 'closed' })
    .eq('id', cohorteId)
    .select('id, status')
    .maybeSingle()
  return !error && (data as { status?: string } | null)?.status === 'closed'
}

/**
 * Émettre un lien.
 *
 * `created_by` est envoyé explicitement : la colonne n'a pas de valeur par
 * défaut, et le `with check` de la politique exige qu'elle vaille `auth.uid()`.
 * Ni `token`, ni `expires_at`, ni `max_uses` ne sont donnés — leurs valeurs par
 * défaut sont les bonnes (48 caractères aléatoires, 30 jours, 50 entrées) et
 * les proposer à l'écran demanderait d'expliquer trois réglages pour un geste
 * qui doit tenir en un bouton.
 */
export const emettreLien = async (
  client: SupabaseClient,
  churchId: string,
  utilisateurId: string,
  cohorteId: string | null,
): Promise<LienInvitation | null> => {
  const { data, error } = await client
    .from('church_invitations')
    .insert({ church_id: churchId, group_id: cohorteId, created_by: utilisateurId })
    .select('token, status, expires_at, uses, max_uses')
    .maybeSingle()
  return error || !data ? null : enLien(data as LigneLien)
}

export const revoquerLien = async (client: SupabaseClient, jeton: string): Promise<boolean> => {
  const { data, error } = await client
    .from('church_invitations')
    .update({ status: 'revoked' })
    .eq('token', jeton)
    .select('token, status')
    .maybeSingle()
  return !error && (data as { status?: string } | null)?.status === 'revoked'
}

/**
 * Changer le rôle ou le statut d'un membre.
 *
 * Un seul point d'entrée pour les deux : la politique est la même, ses deux
 * bornes aussi (`admin` est irrecevable, et sa propre ligne est hors de
 * portée), et deux fonctions jumelles auraient invité à n'en corriger qu'une.
 * Le type d'entrée exclut `admin` — `tsc -b` refuse l'appel plutôt que la base,
 * ce qui est plus tôt et moins cher.
 */
export const changerMembre = async (
  client: SupabaseClient,
  churchId: string,
  membreId: string,
  changement: { role: Exclude<RoleEglise, 'admin'> } | { statut: 'active' | 'revoked' },
): Promise<MembreCommunaute | null> => {
  const charge = 'role' in changement ? { role: changement.role } : { status: changement.statut }
  const { data, error } = await client
    .from('church_members')
    .update(charge)
    .eq('church_id', churchId)
    .eq('user_id', membreId)
    .select('user_id, role, status, created_at')
    .maybeSingle()
  if (error || !data) return null
  const ligne = data as { user_id: string; role: RoleEglise; status: MembreCommunaute['statut']; created_at: string }
  // Le nom ne revient pas d'ici : `profiles` reste fermée, et cette ligne vient
  // de `church_members`. L'appelant reprend le nom qu'il avait déjà — c'est
  // pourquoi cette fonction rend le membre plutôt qu'un booléen.
  return { id: ligne.user_id, nom: '', role: ligne.role, statut: ligne.status, entreLe: ligne.created_at }
}
