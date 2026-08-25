/**
 * L'espace mentor — issue #16.
 *
 * Tout ce qui décide **ce qu'un écran a le droit de dire** d'une personne
 * accompagnée vit ici : les quatre signaux et rien de plus, les six mots
 * d'encouragement, les cinq catégories de demande d'aide, et la question qui
 * décide de tout le reste — un mentor est-il en état de recevoir quoi que ce
 * soit.
 *
 * Chacune de ces listes a un jumeau en SQL, dans
 * `supabase/migrations/20260826090000_espace_mentor.sql`, et **le jumeau fait
 * foi**. Ce qui est écrit ici tient contre une faute de frappe, et plus tôt ;
 * la base tient contre une application compromise. `tests/rls/espace-mentor.test.ts`
 * reste l'autorité : si les deux divergent, c'est ce fichier qui a tort.
 *
 * ---------------------------------------------------------------------------
 * Ce que ce fichier refuse de savoir calculer
 * ---------------------------------------------------------------------------
 *
 * Il n'y a ici **aucune fonction qui ordonne des participants**. Ni « le plus
 * en retard », ni « le moins actif », ni un score. Le dernier critère de
 * l'issue #16 est qu'aucune métrique de classement n'existe, et ce critère ne
 * dit pas « ne l'affiche pas » : un tri qui existe finit sur un écran. La garde
 * est la même que celle de `bilan.ts` contre la série perdue — il n'existe
 * nulle part de nombre à classer, parce qu'aucun nombre n'est calculé.
 *
 * Le signal lui-même n'est pas calculé ici non plus, et c'est délibéré : il
 * naît dans `tandem_mes_accompagnements()`, à partir de lignes que le client ne
 * lit jamais. Une fonction `signalDe(dernièreActivité)` dans ce fichier aurait
 * exigé que la date d'activité traverse le réseau — c'est-à-dire exactement ce
 * que la migration se donne du mal à empêcher. Ce fichier ne fait que
 * **reconnaître** un signal déjà décidé.
 */

/**
 * Les quatre signaux, dans l'ordre où la migration les résout.
 *
 * L'ordre est celui de la précédence, pas celui d'une échelle : `aide_demandee`
 * passe avant tout parce que c'est le seul des quatre que la personne a posé
 * elle-même. Rien dans le produit n'a le droit de s'en servir comme d'un rang.
 */
export const SIGNAUX = ['aide_demandee', 'nouveau', 'actif', 'a_relancer'] as const

export type SignalAccompagnement = (typeof SIGNAUX)[number]

/**
 * Quatorze jours sans activité, et l'écran propose de faire signe.
 *
 * Quatorze, et pas les douze de `ABSENCE_SEUIL_JOURS` : ce n'est pas la même
 * horloge. Les douze jours du bilan déclenchent un message que l'application
 * adresse à la personne elle-même ; les quatorze d'ici déclenchent la
 * sollicitation d'un tiers, et l'horloge du mentor doit partir **après** celle
 * de l'application — sinon un même silence produit deux relances le même jour,
 * et la seconde vient d'un adulte.
 *
 * La constante est exportée pour être citée par la documentation et par les
 * tests, jamais pour être appliquée côté client : c'est la migration qui
 * compte les jours, et elle est seule à voir les dates.
 */
export const SIGNAL_SEUIL_JOURS = 14

/**
 * Les six mots d'encouragement.
 *
 * Une liste close, et pas un champ de texte : c'est ce qui empêche ce canal à
 * sens unique — un adulte vers un mineur, hors de la conversation de tandem,
 * donc hors du blocage et du signalement — de devenir une messagerie privée.
 * Le texte de chaque clé vit dans `packages/content/copy`, en français et en
 * anglais ; la base ne stocke jamais qu'une clé, et le participant lit dans
 * SA langue un mot envoyé dans une autre.
 *
 * Aucune de ces six ne félicite d'un résultat, aucune ne reproche un silence.
 * « aucun wording de honte » (#49) vaut face au mentor comme face à soi. En
 * ajouter une demande trois gestes : la contrainte `check` de la migration, ce
 * tableau, et les deux catalogues de copy — le test de parité mesure le
 * troisième.
 */
export const MOTS_ENCOURAGEMENT = [
  'je_pense_a_toi',
  'je_prie_pour_toi',
  'prends_ton_temps',
  'fais_moi_signe',
  'content_de_cheminer_avec_toi',
  'on_reprend_quand_tu_veux',
] as const

export type MotEncouragement = (typeof MOTS_ENCOURAGEMENT)[number]

/**
 * Les cinq catégories d'une demande d'aide, dans l'ordre où l'écran les
 * propose : les deux plus fréquentes d'abord, `autre` en dernier. C'est l'ordre
 * de `CATEGORIES_PROPOSEES` du signalement (#46), et pour la même raison — les
 * boutons ne changent pas de place.
 *
 * `moral` est offert au même rang que les autres. L'écran affiche les numéros
 * du doc 22 **avant** l'envoi lorsqu'elle est choisie, jamais après : ce
 * produit ne surveille pas la nuit, et il vaut mieux le dire pendant qu'on
 * hésite.
 */
export const CATEGORIES_AIDE = ['parcours', 'pratique', 'spirituel', 'moral', 'autre'] as const

export type CategorieAide = (typeof CATEGORIES_AIDE)[number]

/**
 * Les catégories pour lesquelles l'écran montre les numéros d'urgence avant
 * l'envoi. Une seule aujourd'hui — la fonction existe pour que la liste puisse
 * grandir sans qu'on aille chercher un `===` perdu dans un composant.
 */
export const orientationHumaine = (categorie: CategorieAide): boolean => categorie === 'moral'

/** Une ligne rendue par `tandem_mes_accompagnements()`, telle qu'elle arrive. */
export type Accompagnement = {
  assignmentId: string
  participantId: string
  nom: string
  depuisLe: string
  signal: SignalAccompagnement
  /** Renseignés ensemble, et seulement quand le signal vaut `aide_demandee`. */
  aide: { id: string; categorie: CategorieAide; demandeeLe: string } | null
}

/** Ce que le participant voit de son côté, par `tandem_mon_accompagnement()`. */
export type MonAccompagnement = {
  assignmentId: string
  mentorId: string
  nom: string
  statut: 'pending' | 'active'
  verification: 'pending' | 'verified' | 'rejected' | 'revoked'
  formation: 'required' | 'in_progress' | 'completed' | 'expired'
  proposeLe: string
}

/**
 * Un mentor est joignable quand son église l'a fait vérifier **et** qu'il a
 * terminé sa formation. Les deux, pas l'un ou l'autre.
 *
 * Le jumeau SQL est `tandem_accompagnement_actif()`, et il tient la règle
 * contre une application compromise. Celle-ci sert à l'écran du participant :
 * elle décide si le bouton « demander de l'aide » existe, plutôt que de le
 * montrer et de laisser la base refuser. Un bouton qui échoue toujours est pire
 * qu'un bouton absent — il fait croire qu'on a appelé.
 */
export const mentorJoignable = (accompagnement: MonAccompagnement | null): boolean =>
  accompagnement !== null
  && accompagnement.statut === 'active'
  && accompagnement.verification === 'verified'
  && accompagnement.formation === 'completed'

/**
 * Ce que l'écran du participant a le droit de proposer, en un seul objet plutôt
 * qu'en quatre booléens éparpillés dans le composant.
 *
 * `orienter` est vrai exactement quand `demanderDeLAide` est faux : il n'y a
 * pas d'état où l'écran se tait. Quelqu'un sans mentor, ou dont le mentor n'est
 * pas encore vérifié, voit les recours réels — son binôme, le responsable de sa
 * communauté, et les numéros du doc 22. C'est le critère « l'écran ne promet
 * pas une aide que personne ne recevra ».
 */
export type GestesDuParticipant = {
  repondre: boolean
  demanderDeLAide: boolean
  orienter: boolean
}

export const gestesDuParticipant = (
  accompagnement: MonAccompagnement | null,
  aideDejaOuverte: boolean,
): GestesDuParticipant => {
  const joignable = mentorJoignable(accompagnement)
  return {
    repondre: accompagnement?.statut === 'pending',
    // Une demande déjà ouverte n'en autorise pas une seconde : la base porte un
    // index unique partiel, et un écran qui laisserait rappeler ferait échouer
    // le geste au lieu de dire « c'est déjà parti ».
    demanderDeLAide: joignable && !aideDejaOuverte,
    orienter: !joignable,
  }
}
