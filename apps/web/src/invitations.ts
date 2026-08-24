/**
 * Les requêtes de l'écran des invitations, et pas une de plus.
 *
 * Elles sont ici plutôt que dans le composant pour la même raison que
 * `moderation.ts` : chacune épouse une politique du schéma, et la façon dont
 * elle est écrite *est* la garde.
 *
 * **Aucune migration n'a été nécessaire**, et c'est le premier résultat de ce
 * chantier : le chemin d'écriture de la révocation existait déjà. La contrainte
 * `check` énumère `revoked` parmi les statuts (migration `…_000002`, ligne 21),
 * `grant select, insert, update on public.tandem_invitations to authenticated`
 * ouvre l'écriture (même migration, ligne 177) et
 * `invitations_update_participant` reconnaît l'inviteur. Le témoin positif de
 * `tests/rls/invitation-bloquee.test.ts:139` le prouvait déjà sans que rien ne
 * l'utilise.
 *
 * Ce qu'il ne faut surtout pas « resserrer » au passage : ce `grant` porte sur
 * toute la table, là où la modération a un `grant update (status)`. La
 * différence n'est pas un oubli. `accept_tandem_invitation` est `security
 * invoker` depuis `…_000004`, et son UPDATE nomme trois colonnes — `status`,
 * `accepted_by`, `accepted_at`. Un grant par colonne ferait refuser l'ordre
 * entier (« permission denied for table »), et casserait toutes les
 * acceptations pour économiser un droit dont la politique borne déjà les
 * lignes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { etatInvitation, trierInvitations } from '@agapeplay/domain'
import type { Invitation } from '@agapeplay/domain'

/**
 * Une invitation émise, avec ce que l'écran a le droit d'en proposer.
 *
 * `contactBloque` vient de `tandem_contact_bloque()` et vaut « le `with check`
 * lèverait ». Il est porté par la ligne plutôt que recalculé à l'affichage :
 * l'appel coûte un parcours séquentiel d'`auth.users` (voir plus bas), et un
 * composant qui le rappellerait à chaque rendu le paierait à chaque frappe.
 *
 * **Il ne vaut que sur une invitation vivante.** La sonde est bornée à
 * celles-là, si bien qu'il rend `false` sur une invitation périmée, acceptée ou
 * annulée — sans que cela dise quoi que ce soit du blocage. `revocationInvitation`
 * ne le lit qu'après avoir écarté ces états ; l'afficher ailleurs mentirait.
 */
export type InvitationEmise = Invitation & { contactBloque: boolean }

type LigneInvitation = {
  id: string
  inviter_id: string
  invitee_email: string
  status: Invitation['statut']
  expires_at: string
  created_at: string
  accepted_at: string | null
}

/**
 * Les invitations visibles du compte connecté, émises et reçues.
 *
 * **Une seule lecture, sans filtre.** `invitations_select_participant` dit
 * exactement ce que cet écran veut montrer — « celles que j'ai émises, et
 * celles qui visent mon adresse » — et rajouter un `.or(...)` côté client
 * reviendrait à réécrire la politique dans le composant, avec le risque de
 * s'en écarter. Le tri entre les deux listes se fait sur `inviter_id`, la seule
 * colonne qui distingue les deux branches.
 *
 * **Le jeton n'est pas demandé.** Il est lisible — la politique ne restreint
 * pas les colonnes — mais accepter une invitation a déjà son chemin, le lien
 * reçu par e-mail, et le second l'exposerait dans un DOM pour rien.
 *
 * `accepted_by` non plus : c'est l'uuid d'une personne, et ce dépôt fait
 * ressortir des dérivés, jamais des identifiants.
 */
export const chargerInvitations = async (
  client: SupabaseClient,
  utilisateurId: string,
  maintenant: Date,
): Promise<{ emises: InvitationEmise[]; recues: Invitation[]; erreur: boolean }> => {
  const echec = { emises: [], recues: [], erreur: true }

  const { data, error } = await client
    .from('tandem_invitations')
    .select('id, inviter_id, invitee_email, status, expires_at, created_at, accepted_at')
  if (error) return echec

  const lignes = (data ?? []) as LigneInvitation[]
  const enInvitation = (ligne: LigneInvitation, adresse: string): Invitation => ({
    id: ligne.id,
    adresse,
    statut: ligne.status,
    expireLe: ligne.expires_at,
    creeeLe: ligne.created_at,
    accepteeLe: ligne.accepted_at,
  })

  const emises = trierInvitations(
    lignes.filter((ligne) => ligne.inviter_id === utilisateurId).map((ligne) => enInvitation(ligne, ligne.invitee_email)),
    maintenant,
  )
  const recues = lignes.filter((ligne) => ligne.inviter_id !== utilisateurId)

  const [bloques, masquees] = await Promise.all([
    contactsBloques(client, emises, maintenant),
    inviteursBloques(client, utilisateurId, recues.map((ligne) => ligne.inviter_id)),
  ])
  if (!bloques) return echec

  return {
    erreur: false,
    emises: emises.map((invitation) => ({ ...invitation, contactBloque: bloques.has(invitation.adresse.toLowerCase()) })),
    // Une invitation d'un inviteur bloqué ne s'affiche pas. Ce n'est pas de la
    // dissimulation : `tandems_insert_member` exige
    // `not tandem_paire_bloquee(...)`, si bien qu'elle ne peut plus être
    // acceptée — c'est une ligne morte, et la montrer ferait passer par
    // l'interface la sollicitation que le blocage promet de faire cesser
    // (doc 21, « une invitation antérieure à un blocage reste visible du
    // bloqueur — à traiter par péremption ou côté interface »). Ne pas
    // « réparer » en la réaffichant avec une mention : la mention *est* la
    // sollicitation.
    recues: trierInvitations(
      recues.filter((ligne) => !masquees.has(ligne.inviter_id)).map((ligne) => enInvitation(ligne, '')),
      maintenant,
    ),
  }
}

/**
 * Les adresses émises qui appartiennent à un compte en blocage avec l'appelant.
 *
 * `null` en retour vaut échec de lecture : sans cette réponse, l'écran ne peut
 * pas savoir si le bouton de révocation tiendrait, et proposer un bouton au
 * hasard est précisément ce qu'on évite.
 *
 * **Seules les invitations vivantes sont sondées**, et c'est un compromis
 * énoncé. `tandem_contact_bloque` compare `lower(u.email)` sans index
 * utilisable dans `auth.users` — sa migration assume ce parcours séquentiel au
 * motif que l'émission est « un geste rare et manuel ». L'afficher en liste le
 * déplace vers « à chaque ouverture de l'onglet, une fois par invitation ». On
 * borne donc aux seules lignes dont l'état pourrait porter un bouton : les
 * autres n'ont rien à révoquer, blocage ou pas. Les doublons d'adresse sont
 * fusionnés pour la même raison.
 */
const contactsBloques = async (
  client: SupabaseClient,
  emises: Invitation[],
  maintenant: Date,
): Promise<Set<string> | null> => {
  const adresses = [...new Set(
    emises
      // `etatInvitation` plutôt qu'un `status === 'pending'` réécrit ici : la
      // péremption a une seule définition, et c'est elle qui doit décider des
      // deux côtés — de la sonde comme de l'affichage.
      .filter((invitation) => etatInvitation(invitation, maintenant) === 'vivante')
      .map((invitation) => invitation.adresse.toLowerCase()),
  )]

  const reponses = await Promise.all(adresses.map((adresse) => client.rpc('tandem_contact_bloque', { p_email: adresse })))
  if (reponses.some((reponse) => reponse.error)) return null
  return new Set(adresses.filter((_, index) => reponses[index].data === true))
}

/**
 * Les inviteurs avec qui l'appelant est en blocage.
 *
 * `tandem_paire_bloquee(a, b)` plutôt que `tandem_contact_bloque` : une
 * invitation reçue porte l'uuid de son émetteur, pas son adresse, et aucun
 * chemin de lecture ne mène de l'un à l'autre — c'est même l'intention de
 * `tandem_partenaire()`, sans paramètre pour ne pas devenir un annuaire
 * inversé. La fonction par paire, elle, prend deux identifiants et rend `true`
 * — donc « bloqué », donc masqué — pour qui n'est pas participant : sa polarité
 * de repli va dans le sens de cet écran, et elle ne renseigne sur aucune paire
 * dont l'appelant serait absent.
 *
 * Une lecture en échec compte comme un blocage — l'invitation est masquée. La
 * polarité de repli est celle de la fonction appelée, et elle referme : mieux
 * vaut taire une invitation légitime le temps d'une panne réseau que laisser
 * passer une sollicitation qu'un blocage devait arrêter.
 */
const inviteursBloques = async (
  client: SupabaseClient,
  utilisateurId: string,
  inviteurs: string[],
): Promise<Set<string>> => {
  const identifiants = [...new Set(inviteurs)]
  const reponses = await Promise.all(identifiants.map(async (inviteurId) => {
    const { data, error } = await client.rpc('tandem_paire_bloquee', { p_a: utilisateurId, p_b: inviteurId })
    return !error && data === false
  }))
  return new Set(identifiants.filter((_, index) => !reponses[index]))
}

/**
 * La révocation : un statut écrit, et la ligne relue.
 *
 * **Le `select` de retour n'est pas cosmétique.** `invitations_update_participant`
 * refuse par son `using` toute invitation dont on n'est ni l'inviteur ni le
 * destinataire, et un UPDATE que le `using` refuse **ne lève rien** : il touche
 * zéro ligne et PostgREST rend `error: null`. Sans lire la ligne revenue,
 * l'écran dirait « invitation révoquée » alors que rien n'aurait bougé.
 *
 * L'autre refus, lui, lève : le `with check` appelle
 * `not tandem_contact_bloque(invitee_email)`, et la nouvelle ligne porte
 * toujours l'adresse de la paire bloquée. `revocationInvitation` est là pour
 * qu'on n'arrive jamais jusqu'ici dans ce cas — mais un blocage posé entre le
 * chargement de la page et le clic est possible, et alors `error` est non nul.
 * Les deux échecs se traitent pareil : `null`.
 *
 * `status` seul dans la charge utile, bien que le `grant` porte sur toute la
 * table : `expires_at` ou `invitee_email` n'ont aucune raison de bouger, et
 * réécrire l'adresse est le contournement que
 * `20260806161500_invitation_bloquee` a fermé.
 */
export const revoquerInvitation = async (
  client: SupabaseClient,
  invitationId: string,
): Promise<boolean> => {
  const { data, error } = await client
    .from('tandem_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .select('id, status')
    .maybeSingle()
  return !error && data?.status === 'revoked'
}
