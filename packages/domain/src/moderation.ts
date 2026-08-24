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
 *
 * Depuis le 25/08/2026, un signalement porte une catégorie et une urgence
 * (`20260825173000_categorie_et_urgence.sql`). Deux choses en découlent ici :
 * l'ordre de la file tient compte de l'urgence, et `urgenceDe` recopie la
 * dérivation que la base applique — pour l'écran de signalement, qui doit
 * pouvoir la dire avant que la ligne existe.
 */
import type { TandemStatus } from './blocking'

/** `tandem_reports.status`, tel que la contrainte `check` l'énumère. */
export type StatutSignalement = 'open' | 'reviewing' | 'resolved'

/**
 * `tandem_reports.category`, tel que la contrainte `check` l'énumère.
 *
 * Sept valeurs, dont six seulement se proposent — voir `CATEGORIES_PROPOSEES`.
 * Le type les porte toutes parce que la lecture, elle, les rencontre toutes :
 * un écran de modération qui ignorerait `non_precise` afficherait un vide sur
 * les dossiers antérieurs aux catégories.
 */
export type CategorieSignalement =
  | 'malaise'
  | 'insistance'
  | 'sexuel'
  | 'secret'
  | 'danger'
  | 'autre'
  | 'non_precise'

/** `tandem_reports.urgency`, déduite en base par une colonne générée. */
export type UrgenceSignalement = 'immediate' | 'elevee' | 'standard'

/**
 * Les six catégories qu'un écran propose, dans l'ordre où il les propose.
 *
 * L'ordre n'est pas alphabétique et n'est pas celui de l'urgence : il va du
 * plus fréquent au plus rare, parce qu'une liste se lit du haut, et se termine
 * par `autre` parce qu'une sortie de secours se met à la fin. Mettre `danger`
 * en tête paraîtrait juste et serait un piège : la première ligne d'une liste
 * est celle qu'on choisit quand on hésite.
 *
 * `non_precise` n'y est pas, et ne doit jamais y entrer : il ne nomme pas une
 * situation mais les huit signalements posés avant que la question existe.
 *
 * Le type est celui du tuple littéral, et non `readonly CategorieSignalement[]`
 * : les écrans de signalement n'ont alors aucun cas `non_precise` à traiter, et
 * l'ajouter ici ferait échouer `tsc` chez eux au lieu de passer inaperçu.
 */
export const CATEGORIES_PROPOSEES = [
  'malaise',
  'insistance',
  'secret',
  'sexuel',
  'danger',
  'autre',
] as const satisfies readonly CategorieSignalement[]

/**
 * La même dérivation que la colonne générée de `20260825173000`.
 *
 * Elle est ici en double, et c'est un choix plutôt qu'un oubli. La base reste
 * la seule autorité — c'est elle qui écrit la colonne, et une application
 * compromise ne peut pas la contredire. Cette copie sert l'écran de signalement,
 * qui doit pouvoir dire « ce que tu choisis là part tout de suite » **avant**
 * que la ligne existe.
 *
 * ⚠️ Les deux se modifient ensemble. `urgenceDe` appliquée aux lignes relues
 * doit rendre exactement leur colonne `urgency` ; un test RLS compare les deux
 * tables de correspondance valeur par valeur, et rougit si l'une dérive.
 */
export function urgenceDe(categorie: CategorieSignalement): UrgenceSignalement {
  if (categorie === 'sexuel' || categorie === 'danger') return 'immediate'
  if (categorie === 'insistance' || categorie === 'secret') return 'elevee'
  return 'standard'
}

/** Une ligne de `tandem_reports`, telle que la modération la lit. */
export type Signalement = {
  id: string
  tandemId: string
  messageId: string | null
  reporterId: string
  /** Le mot libre, `null` quand la personne n'a rien ajouté à sa catégorie. */
  reason: string | null
  categorie: CategorieSignalement
  /** Relue de la base, jamais recalculée ici : la colonne générée fait foi. */
  urgence: UrgenceSignalement
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
 * L'urgence départage à statut égal — et jamais l'inverse.
 *
 * L'ordre des deux critères est la décision, et elle se lit par le cas qu'elle
 * refuse : un dossier clos et « immédiat » ne doit pas passer devant un dossier
 * ouvert et « standard ». Un dossier clos n'attend rien de personne, quelle
 * qu'ait été sa gravité. Le statut reste donc le premier tri, l'urgence le
 * second.
 *
 * Le troisième — le plus récent d'abord — est inchangé, et c'est délibéré. À
 * urgence égale, l'ancienneté départagerait deux dossiers dont aucun n'a été
 * traité, et on peut plaider les deux sens : l'attente la plus longue est un
 * échec plus grand, la situation la plus fraîche est celle qui se joue encore.
 * On garde ce qui existait, parce que ce chantier a une raison de changer
 * l'ordre — l'urgence — et aucune de changer celui-là.
 */
const rangUrgence: Record<UrgenceSignalement, number> = { immediate: 0, elevee: 1, standard: 2 }

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
    .sort((a, b) =>
      rang[a.status] - rang[b.status]
      || rangUrgence[a.urgence] - rangUrgence[b.urgence]
      || b.createdAt.localeCompare(a.createdAt))
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
