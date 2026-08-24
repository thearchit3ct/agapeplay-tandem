/**
 * Ce qu'un dossier de modération est, et dans quel ordre on le traite.
 *
 * La base sait déjà tout dire — `20260806163000_role_moderateur.sql` a donné un
 * lecteur aux signalements, `20260806180000_suivi_moderation.sql` leur a donné
 * un statut et une trace. Ce qui manquait entre les deux, c'est la couture :
 * trois requêtes rendent trois listes séparées (les signalements, l'état des
 * tandems signalés, les messages signalés), et l'écran a besoin d'un objet par
 * dossier.
 *
 * Cette couture est ici, et pas dans le composant, pour la même raison que
 * `blocking.ts` : elle porte une règle — quel dossier passe devant, quelle
 * décision reste possible — et une règle s'éprouve sans navigateur ni base.
 *
 * Aucun identifiant de personne n'entre dans ce qui en sort. Ce n'est pas une
 * précaution décorative : le doc 21 range « la modération ne lit pas les
 * participants d'un tandem » parmi les écarts assumés, et la vue
 * `tandem_contexte_signale` va jusqu'à exclure `blocked_by` au seul motif que
 * c'est l'uuid d'un participant. `reporter_id` et `sender_id` entrent donc ici
 * — ils sont lisibles du modérateur, et leur comparaison dit quelque chose
 * d'utile — mais il en ressort une origine, jamais un identifiant.
 */
import type { TandemStatus } from './blocking'

/** `tandem_reports.status`, tel que la contrainte `check` l'énumère. */
export type StatutSignalement = 'open' | 'reviewing' | 'resolved'

/** Une ligne de `tandem_reports`, telle que la modération la lit. */
export type Signalement = {
  id: string
  tandemId: string
  messageId: string | null
  reporterId: string
  reason: string
  status: StatutSignalement
  createdAt: string
  resolvedAt: string | null
}

/** Une ligne de la vue `tandem_contexte_signale` : l'état, jamais les personnes. */
export type ContexteSignale = {
  tandemId: string
  status: TandemStatus
  createdAt: string
  blockedAt: string | null
  endedAt: string | null
}

/** Une ligne de `tandem_messages` ouverte par `messages_select_moderator_reported`. */
export type MessageSignale = {
  id: string
  senderId: string
  body: string
  createdAt: string
}

/**
 * Qui a écrit le message signalé — dit sans le nommer.
 *
 * `signalant` veut dire que la personne a signalé son propre message ; le cas
 * existe et il change la lecture d'un dossier. `autre` désigne le second
 * participant, et c'est tout ce qu'on en saura : la modération ne dispose
 * d'aucun chemin vers son profil, et n'a pas à en disposer.
 */
export type OrigineMessage = 'signalant' | 'autre'

export type DossierModeration = {
  signalement: Signalement
  /** `null` si la vue n'a pas rendu ce tandem — un état à afficher, pas une erreur. */
  contexte: ContexteSignale | null
  /** `null` quand le signalement ne vise aucun message précis (`message_id` est nullable). */
  message: { body: string; createdAt: string; origine: OrigineMessage } | null
}

/**
 * Les statuts qu'une décision peut atteindre depuis celui-ci.
 *
 * Le schéma n'interdit aucune transition — la contrainte `check` ne parle que
 * des trois valeurs — et le trigger sait déjà défaire une clôture : « si le
 * nouveau statut vaut `resolved`, poser `resolved_at` ; si l'ancien valait
 * `resolved`, l'effacer ». Rouvrir un dossier clos est donc un geste prévu, et
 * l'écran doit le proposer plutôt que de laisser une décision hâtive sans
 * retour.
 *
 * Ce qu'on retire, c'est le sur-place : proposer « prendre en charge » à un
 * dossier déjà pris en charge écrirait une ligne d'audit qui ne dit rien —
 * d'ailleurs le trigger ne l'écrirait pas (`is distinct from`), et le bouton
 * mentirait deux fois : sur l'effet et sur la trace.
 */
export function transitionsPossibles(statut: StatutSignalement): StatutSignalement[] {
  if (statut === 'open') return ['reviewing', 'resolved']
  if (statut === 'reviewing') return ['resolved']
  return ['reviewing']
}

/**
 * L'ordre de la pile : ce qui attend une décision passe devant.
 *
 * `open` d'abord, `reviewing` ensuite, `resolved` en dernier ; à statut égal, le
 * plus récent en tête. Un dossier pris en charge n'est pas plus urgent qu'un
 * dossier neuf du point de vue de la personne signalée — mais il l'est du point
 * de vue de la modération, qui doit voir d'un coup d'œil ce que personne n'a
 * encore ouvert.
 */
const rang: Record<StatutSignalement, number> = { open: 0, reviewing: 1, resolved: 2 }

/**
 * Recoud les trois lectures en une liste de dossiers.
 *
 * Les trois entrées viennent de trois politiques distinctes qui n'ont aucune
 * raison de couvrir exactement les mêmes lignes — un message signalé puis
 * effacé laisse `message_id` à NULL (`on delete set null`), et la vue de
 * contexte peut se taire si le tandem a disparu. Chaque absence est donc rendue
 * telle quelle, en `null`, pour que l'écran la dise au lieu de la combler.
 */
export function assemblerDossiers(
  signalements: Signalement[],
  contextes: ContexteSignale[],
  messages: MessageSignale[],
): DossierModeration[] {
  const contexteParTandem = new Map(contextes.map((contexte) => [contexte.tandemId, contexte]))
  const messageParId = new Map(messages.map((message) => [message.id, message]))

  return [...signalements]
    .sort((a, b) => rang[a.status] - rang[b.status] || b.createdAt.localeCompare(a.createdAt))
    .map((signalement) => {
      const message = signalement.messageId ? messageParId.get(signalement.messageId) : undefined
      return {
        signalement,
        contexte: contexteParTandem.get(signalement.tandemId) ?? null,
        message: message
          ? {
              body: message.body,
              createdAt: message.createdAt,
              origine: message.senderId === signalement.reporterId ? ('signalant' as const) : ('autre' as const),
            }
          : null,
      }
    })
}
