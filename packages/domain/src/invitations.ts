/**
 * Ce qu'une invitation est devenue, et ce qu'on peut encore en faire.
 *
 * On sait poser une invitation depuis le 04/08/2026 ; on ne savait ni la
 * revoir ni la reprendre. Deux règles manquaient, et aucune des deux n'est
 * affaire d'affichage :
 *
 * 1. **`status` ne suffit pas à dire l'état.** Rien ne fait passer une
 *    invitation de `pending` à `expired` — ni trigger, ni cron : la colonne
 *    `expires_at` est le seul juge de la péremption
 *    (`accept_tandem_invitation` et `tandems_insert_member` la lisent tous
 *    deux, jamais le statut seul). Un écran qui ferait confiance à `status`
 *    afficherait « en attente » indéfiniment sur une invitation morte depuis
 *    des semaines.
 * 2. **Révoquer n'est pas toujours possible**, et le refus ne se découvre pas
 *    en essayant. `invitations_update_participant` porte depuis
 *    `20260806161500_invitation_bloquee` un `not tandem_contact_bloque(...)`
 *    dans son `with check` : sur une paire bloquée, la révocation **lève**.
 *    C'est un écart assumé du doc 21, pas un défaut — le chemin de retour
 *    sanctionné est de lever le blocage. L'écran doit donc le dire au lieu de
 *    proposer un bouton qui échouerait.
 *
 * Ces deux règles vivent ici, pures, pour la raison qui a mis `blocking.ts` au
 * même endroit : elles s'éprouvent sans navigateur, sans base et sans réseau,
 * et `tests/rls/invitations.test.ts` reste l'autorité sur les politiques
 * qu'elles reflètent.
 */

/** `tandem_invitations.status`, tel que la contrainte `check` l'énumère. */
export type StatutInvitation = 'pending' | 'accepted' | 'revoked' | 'expired'

/**
 * L'état réellement affichable, une fois `status` et `expires_at` croisés.
 *
 * - `vivante` : `pending` et pas encore périmée — la seule qui puisse être
 *   acceptée, donc la seule qu'il vaille la peine de révoquer.
 * - `perimee` : la date est passée. Le statut stocké vaut `pending` dans
 *   l'immense majorité des cas ; `expired` existe dans la contrainte `check`
 *   mais rien ne l'écrit aujourd'hui, et les deux se disent pareil à l'écran.
 * - `acceptee` : un tandem est né de celle-ci.
 * - `revoquee` : l'inviteur l'a reprise.
 */
export type EtatInvitation = 'vivante' | 'perimee' | 'acceptee' | 'revoquee'

/** Une invitation telle que l'écran la reçoit, sans jeton ni identifiant de personne. */
export type Invitation = {
  id: string
  /** `invitee_email` pour une invitation émise. Vide sur une invitation reçue, qu'on n'affiche pas par adresse. */
  adresse: string
  statut: StatutInvitation
  /** `expires_at`, en ISO 8601 UTC. */
  expireLe: string
  creeeLe: string
  /** `accepted_at`, NULL tant que personne n'a accepté. */
  accepteeLe: string | null
}

/**
 * L'état d'une invitation, `expires_at` faisant foi sur `status`.
 *
 * L'ordre des tests n'est pas indifférent : une invitation **acceptée** dont
 * la date de péremption est passée reste acceptée. La péremption ne concerne
 * que ce qui attendait encore une réponse ; la lire d'abord ferait disparaître
 * des tandems bien réels de la liste au bout de sept jours.
 *
 * `maintenant` est un paramètre plutôt qu'un `Date.now()` interne : une règle
 * qui lit l'horloge ne se teste qu'en la déplaçant.
 */
export function etatInvitation(
  { statut, expireLe }: Pick<Invitation, 'statut' | 'expireLe'>,
  maintenant: Date,
): EtatInvitation {
  if (statut === 'accepted') return 'acceptee'
  if (statut === 'revoked') return 'revoquee'
  if (statut === 'expired') return 'perimee'
  return new Date(expireLe).getTime() > maintenant.getTime() ? 'vivante' : 'perimee'
}

/**
 * Ce que l'écran a le droit de proposer sur une invitation émise.
 *
 * Miroir volontaire d'`unblockAffordance` : trois issues nommées, dont deux
 * sans bouton, parce que la base sait dire non de deux façons différentes et
 * qu'aucune ne doit se découvrir après un clic.
 *
 * - `revocable` : `update … set status = 'revoked'` passera. Le droit existe
 *   (`grant select, insert, update on public.tandem_invitations`, migration
 *   `…_000002`), le `using` reconnaît l'inviteur, le `with check` ne trouve
 *   aucun blocage.
 * - `sans-objet` : rien à reprendre. Une invitation acceptée, révoquée ou
 *   périmée n'ouvre plus rien ; la révoquer serait un geste sans effet, et le
 *   proposer laisserait croire qu'il en a un.
 * - `bloquee` : le `with check` lèverait. C'est l'écart assumé du doc 21 — sur
 *   une paire bloquée, l'inviteur ne peut plus révoquer. On l'affiche et on
 *   l'explique ; le contourner demanderait d'élargir une politique dont le
 *   commentaire de migration dit pourquoi elle est étroite.
 */
export type RevocationInvitation = 'revocable' | 'sans-objet' | 'bloquee'

export function revocationInvitation(
  etat: EtatInvitation,
  contactBloque: boolean,
): RevocationInvitation {
  // La péremption passe avant le blocage : « cette invitation ne mène plus
  // nulle part » est vrai des deux côtés, et c'est l'information utile. Dire
  // « impossible de révoquer, vous êtes bloqués » d'une invitation déjà morte
  // ferait porter au blocage une conséquence qu'il n'a pas.
  if (etat !== 'vivante') return 'sans-objet'
  return contactBloque ? 'bloquee' : 'revocable'
}

/**
 * L'ordre de la liste : ce qui attend encore une réponse passe devant.
 *
 * `vivante` d'abord, puis `perimee`, `acceptee`, `revoquee` ; à état égal, la
 * plus récente en tête. La personne qui ouvre cet écran vient presque toujours
 * pour la même question — « mon invitation, elle en est où ? » — et cette
 * question ne porte que sur les vivantes.
 */
const rang: Record<EtatInvitation, number> = { vivante: 0, perimee: 1, acceptee: 2, revoquee: 3 }

export function trierInvitations(invitations: Invitation[], maintenant: Date): Invitation[] {
  return [...invitations].sort((a, b) =>
    rang[etatInvitation(a, maintenant)] - rang[etatInvitation(b, maintenant)]
    || b.creeeLe.localeCompare(a.creeeLe))
}
