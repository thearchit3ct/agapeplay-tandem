/**
 * Ce qu'une communauté permet, et à qui — issue #17.
 *
 * Tout ce qui est écrit ici a un jumeau dans la migration
 * `20260825230000_communaute_et_cohortes.sql`, et le jumeau fait foi : c'est
 * lui qui refuse, ces règles-ci ne font qu'éviter de proposer un geste qui
 * serait refusé. La raison de les dupliquer est celle qui a mis
 * `invitations.ts` au même endroit — un refus qui se découvre après un clic est
 * un refus qu'on n'a pas su dire — et la raison de les mettre *ici* plutôt que
 * dans l'écran est qu'elles s'éprouvent sans navigateur, sans base et sans
 * réseau.
 *
 * `tests/rls/communaute.test.ts` reste l'autorité sur les politiques. Si les
 * deux divergent un jour, c'est ce fichier qui a tort.
 */

/** `church_members.role`, tel que la contrainte `check` l'énumère. */
export type RoleEglise = 'member' | 'mentor' | 'leader' | 'admin'

/** `churches.status`. */
export type StatutEglise = 'pending' | 'active' | 'suspended'

/**
 * Ce que l'écran a le droit de proposer, sachant qui l'on est et où en est la
 * communauté.
 *
 * Deux axes, et il faut les deux : le rôle dit *qui*, le statut dit *quand*.
 * Un responsable d'église en attente a tous les pouvoirs d'organisation et
 * aucun des deux actes liants — c'est la décision 1 de la migration, et c'est
 * exactement ce que cette forme rend visible.
 */
export type PouvoirsEglise = {
  /** Créer un groupe ou une cohorte, poser ses dates, la clôturer. */
  organiser: boolean
  /** Émettre un lien d'invitation. Le premier acte liant : faire entrer quelqu'un. */
  inviter: boolean
  /** Nommer un mentor, et lui proposer un participant. Le second acte liant. */
  affecter: boolean
}

const AUCUN: PouvoirsEglise = { organiser: false, inviter: false, affecter: false }

/**
 * `admin` ne rend rien, et ce n'est pas un oubli : aucun chemin d'écriture du
 * dépôt ne peut écrire ce rôle, et l'autorité de plateforme est
 * `tandem_moderators` (ADR-007). Le `Record` typé fait échouer `tsc -b` le jour
 * où un rôle s'ajouterait sans qu'on ait dit ce qu'il peut — un rôle muet par
 * inadvertance serait pire qu'un rôle muet par décision.
 */
const ORGANISATEURS: Record<RoleEglise, boolean> = {
  leader: true,
  mentor: false,
  member: false,
  admin: false,
}

export function pouvoirsEglise(role: RoleEglise, statut: StatutEglise): PouvoirsEglise {
  if (!ORGANISATEURS[role]) return AUCUN
  const activee = statut === 'active'
  return { organiser: true, inviter: activee, affecter: activee }
}

/** Une cohorte telle que l'écran la reçoit. `null` de part et d'autre = groupe permanent. */
export type Cohorte = {
  id: string
  nom: string
  statut: 'active' | 'closed'
  /** `starts_on`, en `YYYY-MM-DD`. */
  debutLe: string | null
  /** `ends_on`, en `YYYY-MM-DD`. */
  finLe: string | null
}

/**
 * - `close` : quelqu'un l'a fermée. L'emporte sur tout le reste — une cohorte
 *   close avant son terme est close, pas « en cours ».
 * - `terminee` : la date de fin est passée.
 * - `a-venir` : la date de début n'est pas arrivée. **On peut la rejoindre** :
 *   s'inscrire en août à ce qui commence en septembre est le geste normal.
 * - `en-cours` : tout le reste, y compris un groupe permanent sans dates.
 */
export type EtatCohorte = 'a-venir' | 'en-cours' | 'terminee' | 'close'

/**
 * `aujourdhui` est un paramètre plutôt qu'un `new Date()` interne : une règle
 * qui lit l'horloge ne se teste qu'en la déplaçant. On le compare en **UTC**,
 * comme la base — `(timezone('utc', now()))::date` dans la migration — pour que
 * les deux ne basculent pas à des heures différentes.
 */
export const jourUtc = (instant: Date): string => instant.toISOString().slice(0, 10)

export function etatCohorte(cohorte: Cohorte, aujourdhui: Date): EtatCohorte {
  if (cohorte.statut === 'closed') return 'close'
  const jour = jourUtc(aujourdhui)
  if (cohorte.finLe !== null && cohorte.finLe < jour) return 'terminee'
  if (cohorte.debutLe !== null && cohorte.debutLe > jour) return 'a-venir'
  return 'en-cours'
}

/**
 * La fenêtre n'a qu'un bord fermé, et c'est celui de droite. Miroir exact du
 * refus de la base (`cohorte_close`, `cohorte_terminee`) : l'écran ne propose
 * pas ce que la RPC rejetterait.
 */
export function cohorteRecevable(etat: EtatCohorte): boolean {
  return etat === 'en-cours' || etat === 'a-venir'
}

/** Un lien d'invitation tel que le responsable le voit dans sa liste. */
export type LienInvitation = {
  jeton: string
  statut: 'pending' | 'revoked'
  /** `expires_at`, ISO 8601 UTC. */
  expireLe: string
  usages: number
  usagesMax: number
}

/**
 * - `vivant` : il fait encore entrer quelqu'un ;
 * - `revoque` : repris par le responsable ;
 * - `perime` : la date est passée ;
 * - `epuise` : le plafond est atteint. Distinct de `perime` parce que la
 *   réponse du responsable diffère — on n'attend pas, on en émet un autre.
 */
export type EtatLien = 'vivant' | 'perime' | 'epuise' | 'revoque'

export function etatLien(lien: LienInvitation, maintenant: Date): EtatLien {
  // L'ordre compte, et il suit ce que la base vérifie en premier : un lien
  // révoqué est introuvable pour la RPC, quelle que soit sa date.
  if (lien.statut === 'revoked') return 'revoque'
  if (new Date(lien.expireLe).getTime() <= maintenant.getTime()) return 'perime'
  if (lien.usages >= lien.usagesMax) return 'epuise'
  return 'vivant'
}

/** Ce qu'il reste de places. Jamais négatif : un plafond dépassé afficherait un nombre absurde. */
export function placesRestantes(lien: LienInvitation): number {
  return Math.max(0, lien.usagesMax - lien.usages)
}

/**
 * Le paramètre d'URL qui porte un jeton de communauté.
 *
 * Un nom à lui, distinct de tout ce qui existe : le lien de tandem et celui-ci
 * ne confèrent pas la même chose, et un jour où les deux se croiseraient dans
 * la même URL, il faut que l'application sache lequel elle lit.
 */
export const PARAM_COMMUNAUTE = 'communaute'

export function lienDInvitation(origine: string, jeton: string): string {
  return `${origine.replace(/\/+$/, '')}/?${PARAM_COMMUNAUTE}=${encodeURIComponent(jeton)}`
}

export function jetonDepuisUrl(recherche: string): string | null {
  const jeton = new URLSearchParams(recherche).get(PARAM_COMMUNAUTE)
  return jeton !== null && jeton.trim() !== '' ? jeton : null
}

/**
 * Les refus de la RPC, nommés.
 *
 * `rejoindre_une_communaute` lève des codes courts (`cohorte_terminee`,
 * `deja_dans_une_communaute`…) parce qu'un message d'erreur de base de données
 * n'est pas un texte d'écran : il n'est pas traduit, il n'est pas relu, et il
 * change au gré des migrations. Le client reconnaît le code et choisit ses
 * mots — c'est le seul point du dépôt où l'on lit une chaîne d'erreur SQL, et
 * il est isolé ici pour cette raison.
 *
 * `inconnu` n'est pas un cas d'échec de cette fonction, c'est son cas de repli
 * honnête : mieux vaut « quelque chose n'a pas fonctionné » que la traduction
 * confiante d'un code qu'on n'a pas prévu.
 */
export type RefusDAdhesion =
  | 'invitation_introuvable'
  | 'invitation_epuisee'
  | 'communaute_inactive'
  | 'cohorte_close'
  | 'cohorte_terminee'
  | 'adhesion_revoquee'
  | 'deja_dans_une_communaute'
  | 'identite_absente'
  | 'inconnu'

const CODES: readonly RefusDAdhesion[] = [
  'invitation_introuvable', 'invitation_epuisee', 'communaute_inactive',
  'cohorte_close', 'cohorte_terminee', 'adhesion_revoquee',
  'deja_dans_une_communaute', 'identite_absente',
]

export function refusDAdhesion(message: string): RefusDAdhesion {
  return CODES.find((code) => message.includes(code)) ?? 'inconnu'
}
