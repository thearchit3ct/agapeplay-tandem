/**
 * Le bilan de fin de semaine, et la reprise après une absence — issue #18.
 *
 * Tout ce qui décide **quoi proposer, et quand** vit ici : quelle semaine un
 * bilan couvre, s'il est encore ouvert, et s'il faut plutôt accueillir
 * quelqu'un qui revient. Rien de tout cela n'a besoin d'un navigateur, d'une
 * base ni de React — c'est ce qui permet d'éprouver les cas qui comptent
 * vraiment : un vendredi de début janvier, un retour après trois semaines, et
 * la collision des deux messages sur le même écran.
 *
 * ---------------------------------------------------------------------------
 * Ce que ce fichier refuse de savoir calculer
 * ---------------------------------------------------------------------------
 *
 * Il n'y a ici **aucune fonction qui compte des semaines**. Ni « combien
 * d'affilée », ni « combien manquées », ni « depuis combien de temps ». Ce
 * n'est pas un oubli à combler : le premier critère de l'issue est qu'aucun
 * écran ne dise la honte ni la série perdue, et un écran ne peut pas afficher
 * un nombre qu'on n'a pas calculé. La garde la plus solide contre un
 * « tu as manqué 3 semaines » est qu'il n'existe nulle part de 3 à afficher.
 *
 * `repriseApresAbsence` rend donc un booléen, jamais une durée. Le seuil est
 * franchi ou il ne l'est pas ; l'écart exact ne quitte pas cette fonction.
 */

/**
 * Les cinq réponses, dans l'ordre où les écrans les proposent.
 *
 * L'ordre n'est pas une échelle et rien n'en dépend : `paisible` n'est pas
 * « mieux » que `rude`, et `ailleurs` n'est pas la dernière parce qu'elle
 * serait la moins bonne. Il est simplement stable, pour que les boutons ne
 * changent pas de place d'une semaine à l'autre.
 *
 * La contrainte `weekly_checkins_state_check` dit la même liste en SQL. Les
 * deux se lisent ensemble : la base tient la règle contre une application
 * compromise, celle-ci la tient contre une faute de frappe, et plus tôt.
 */
export const ETATS_DE_SEMAINE = ['paisible', 'dense', 'rude', 'ailleurs', 'incertain'] as const

export type EtatDeSemaine = (typeof ETATS_DE_SEMAINE)[number]

/**
 * Au-delà de douze jours sans rien ouvrir, on accueille au lieu de se taire.
 *
 * Douze, et pas huit : une semaine sautée est à l'intérieur de ce que le
 * produit tolère de lui-même — la fenêtre du bilan fait sept jours — et
 * accueillir quelqu'un « de retour » après une seule semaine calme reviendrait
 * à commenter son rythme. Douze jours, c'est deux week-ends traversés : là, il
 * s'est vraiment passé autre chose dans la vie de quelqu'un, et l'écran a
 * quelque chose à dire.
 *
 * Le seuil est un plancher, jamais une mesure : ce qui sort d'ici est un
 * booléen. Voir l'en-tête.
 */
export const ABSENCE_SEUIL_JOURS = 12

const MS_PAR_JOUR = 86_400_000

/**
 * La date civile, telle que la personne la vit, ramenée à minuit UTC.
 *
 * `getFullYear`/`getMonth`/`getDate` sont lus dans le fuseau de l'appareil —
 * c'est bien la semaine vécue qu'on découpe, pas celle de Greenwich — puis
 * reconstruits en UTC pour que toute l'arithmétique qui suit ignore les
 * changements d'heure. Un samedi 00 h 30 à Paris est un samedi ici, alors
 * qu'en UTC il serait encore vendredi.
 */
const jourCivil = (date: Date): Date =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

/** Lundi = 1 … dimanche = 7, la convention ISO. `getUTCDay()` rend 0 le dimanche. */
const jourIso = (jour: Date): number => jour.getUTCDay() || 7

const decalerJours = (jour: Date, jours: number): Date =>
  new Date(jour.getTime() + jours * MS_PAR_JOUR)

/**
 * La clé de la semaine ISO qui contient cette date — `2026-W35`.
 *
 * L'algorithme est celui de la norme, et il ne se devine pas : on se déplace
 * jusqu'au **jeudi** de la semaine, parce que c'est le jeudi qui décide de
 * l'année ISO à laquelle une semaine appartient. D'où le cas qui casse toutes
 * les implémentations naïves, et qui a son test : le 1er janvier 2027 est un
 * vendredi, il appartient donc à `2026-W53` — la semaine de la Saint-Sylvestre
 * porte l'année précédente.
 *
 * C'est aussi pourquoi on ne calcule jamais « la semaine d'avant » en
 * retranchant 1 au numéro : `2027-W01 - 1` ne vaut pas `2026-W53`, et
 * `2027-W00` n'existe pas. On recule de sept jours dans le calendrier et on
 * recalcule — voir `semaineDuBilan`.
 */
export const cleDeSemaine = (date: Date): string => {
  const jeudi = jourCivil(date)
  jeudi.setUTCDate(jeudi.getUTCDate() + 4 - jourIso(jeudi))
  const annee = jeudi.getUTCFullYear()
  const premierJanvier = Date.UTC(annee, 0, 1)
  const numero = Math.round((jeudi.getTime() - premierJanvier) / MS_PAR_JOUR / 7) + 1
  return `${annee}-W${String(numero).padStart(2, '0')}`
}

/**
 * La semaine sur laquelle porte le bilan ouvert à cet instant.
 *
 * **Du samedi au vendredi suivant.** Le bilan de la semaine W s'ouvre le samedi
 * de W — la semaine est vécue, on peut en parler — et se referme le vendredi
 * soir de W+1. Sept jours pleins, ce qui donne la propriété qui compte : à
 * chaque instant il y a **exactement une** semaine dont le bilan est ouvert.
 * Jamais deux à la fois, donc jamais de choix à faire ni de file d'attente ;
 * jamais zéro non plus, donc pas de jour mort où le geste disparaît.
 *
 * Une semaine dont la fenêtre s'est refermée s'en va pour de bon. Elle ne
 * revient pas, elle ne s'empile pas, et rien ne la compte : c'est ce que
 * « une semaine sans bilan n'est pas un échec » veut dire quand on l'écrit en
 * dates. Un arriéré de bilans en retard serait exactement le contraire — une
 * dette, avec sa liste.
 */
export const semaineDuBilan = (maintenant: Date): string => {
  const jour = jourCivil(maintenant)
  // Samedi (6) et dimanche (7) : la semaine en cours s'achève, c'est d'elle
  // qu'on parle. Du lundi au vendredi : c'est encore la précédente, qu'on a
  // jusqu'à vendredi soir pour clore.
  return jourIso(jour) >= 6 ? cleDeSemaine(jour) : cleDeSemaine(decalerJours(jour, -7))
}

/**
 * Ce que l'écran d'accueil propose de doux, ou rien.
 *
 * Un seul type de retour, et pas deux appels séparés : c'est là qu'on tranche
 * la précédence. Quelqu'un qui revient après trois semaines remplit les deux
 * conditions en même temps, et lui présenter côte à côte un mot d'accueil et
 * une question à remplir transformerait un retour en formalité. Le retour passe
 * d'abord ; le bilan attendra le prochain écran, ou la semaine suivante.
 */
export type InvitationDouce =
  | { forme: 'aucune' }
  | { forme: 'reprise' }
  | { forme: 'bilan'; semaine: string }

export type ContexteInvitation = {
  maintenant: Date
  /**
   * Le dernier signe de vie connu — séance terminée ou bilan posé —, ou `null`
   * si l'on n'en connaît aucun.
   *
   * `null` ne déclenche **pas** la reprise : quelqu'un qui n'a jamais rien fait
   * n'est pas quelqu'un qui revient, et l'accueillir comme tel serait un écran
   * qui se trompe de personne. C'est aussi le cas d'une application qui n'a pas
   * encore lu la base, où affirmer une absence serait affirmer plus qu'on ne
   * sait.
   */
  derniereActivite: Date | null
  /** Les semaines déjà renseignées, sous forme de clés `2026-W35`. */
  semainesFaites: readonly string[]
  /** `notification_preferences.weekly_checkin`. */
  rappelBilan: boolean
  /** `notification_preferences.absence`, en place depuis le premier jour. */
  rappelAbsence: boolean
}

/**
 * Faut-il accueillir quelqu'un qui revient ?
 *
 * Rend un booléen et rien d'autre : ni le nombre de jours, ni la date, ni un
 * « niveau » d'absence. Voir l'en-tête du fichier — ce qui n'est pas calculé ne
 * peut pas être affiché.
 *
 * Une date future rend `false`. Une horloge d'appareil en avance n'est pas une
 * absence, et le seul repli honnête est de se taire.
 */
export const repriseApresAbsence = (derniereActivite: Date | null, maintenant: Date): boolean => {
  if (!derniereActivite) return false
  const ecart = maintenant.getTime() - derniereActivite.getTime()
  if (!Number.isFinite(ecart) || ecart < 0) return false
  return ecart >= ABSENCE_SEUIL_JOURS * MS_PAR_JOUR
}

export const invitationDouce = (contexte: ContexteInvitation): InvitationDouce => {
  if (contexte.rappelAbsence && repriseApresAbsence(contexte.derniereActivite, contexte.maintenant)) {
    return { forme: 'reprise' }
  }
  if (!contexte.rappelBilan) return { forme: 'aucune' }
  const semaine = semaineDuBilan(contexte.maintenant)
  // Un bilan déjà posé ne se redemande pas. On peut toujours le corriger depuis
  // la liste — mais la carte, elle, ne réapparaît pas : reposer une question
  // déjà répondue est la forme la plus banale du harcèlement doux.
  if (contexte.semainesFaites.includes(semaine)) return { forme: 'aucune' }
  return { forme: 'bilan', semaine }
}
