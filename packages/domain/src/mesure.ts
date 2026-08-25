/**
 * La mesure produit — issue #20.
 *
 * Ce fichier est le seul endroit où l'on décide **ce qu'un événement a le droit
 * de dire**. Le web et le mobile n'écrivent pas une ligne dans
 * `analytics_events` sans passer par `preparerEvenement`, et cette fonction
 * refuse tout ce qui sort du catalogue du doc 08.
 *
 * Pourquoi ici plutôt que dans chaque application : parce qu'il y en a deux, et
 * qu'une règle recopiée deux fois est une règle qui divergera. Parce que rien
 * de tout cela n'a besoin d'un navigateur, d'un stockage ni d'une base — donc
 * tout s'éprouve sans, ce qui est la seule façon de tester le cas qui compte :
 * un texte de journal qui essaie de passer.
 *
 * ---------------------------------------------------------------------------
 * La même règle est écrite deux fois, et c'est voulu
 * ---------------------------------------------------------------------------
 *
 * La contrainte `analytics_events_metadata_sobre` (migration
 * `20260825190000`) dit la même chose en SQL. Ce n'est pas une redondance
 * paresseuse : la base tient la règle contre une application compromise, ce
 * fichier la tient contre une erreur de programmation — et il la tient **plus
 * tôt**, avec un verdict lisible, avant que quoi que ce soit ne quitte
 * l'appareil.
 *
 * Les deux rendent donc le même verdict, jamais deux verdicts différents : une
 * propriété inconnue fait échouer l'événement **entier** ici, exactement comme
 * la base le refuserait. La tentation était de la retirer en silence et
 * d'émettre le reste ; on aurait alors une application qui croit avoir mesuré
 * quelque chose que la base n'a pas vu passer sous cette forme, et surtout un
 * texte de trop qui disparaît sans que personne l'apprenne.
 */

/** Les dix événements du doc 08, et rien d'autre. */
export const NOMS_EVENEMENTS = [
  'account_created',
  'journey_started',
  'session_completed',
  'partner_invited',
  'partner_accepted',
  'share_created',
  'weekly_checkin_completed',
  'help_requested',
  'report_created',
  'journey_paused',
] as const

export type NomEvenement = (typeof NOMS_EVENEMENTS)[number]

/**
 * Ce que chaque événement a le droit de porter, d'après le tableau du doc 08.
 *
 * `journey_id` et `locale` n'y figurent nulle part : ce sont des **colonnes**
 * de `analytics_events`, et les redoubler dans `metadata` créerait deux
 * vérités pour la même chose.
 *
 * Cette table-ci est plus fine que la contrainte SQL, qui ne connaît que
 * l'union de toutes les clés. Écrire la matrice complète en SQL demanderait une
 * migration à chaque retouche éditoriale du doc 08 ; la garder ici la rend
 * modifiable avec ses tests, et la base garde le dernier mot sur ce qui compte
 * vraiment — la forme et la longueur des valeurs.
 */
export const PROPRIETES_AUTORISEES: Record<NomEvenement, readonly string[]> = {
  account_created: ['platform'],
  journey_started: ['source'],
  session_completed: ['week', 'day', 'duration_bucket'],
  partner_invited: ['invitation_type'],
  partner_accepted: [],
  share_created: ['share_type'],
  weekly_checkin_completed: ['week'],
  help_requested: ['source_role', 'category'],
  report_created: ['category', 'channel_type'],
  journey_paused: ['reason_category'],
}

/** Une valeur de mesure est un scalaire court. Jamais une phrase. */
export type ValeurMesure = string | number | boolean

export const LONGUEUR_MAX_VALEUR = 40

/**
 * Treize mois — 396 jours. Au-delà, l'identifiant d'appareil est retiré et un
 * autre est tiré.
 *
 * Ce plafond ne coûte rien à la mesure : l'horizon le plus long du doc 08 est
 * la rétention à 42 jours, et la « quatrième semaine accompagnée » du funnel en
 * demande une trentaine. Un identifiant qui vivrait moins longtemps couperait
 * les cohortes tardives en deux — c'est-à-dire précisément ce que l'issue
 * demande de mesurer. Un identifiant qui vivrait indéfiniment ferait, lui, de
 * la mesure un suivi durable, ce que le produit ne veut pas être.
 */
export const MESURE_DUREE_MAX_JOURS = 396

/** La charge utile d'un événement, telle que `analytics_events` l'attend. */
export type EvenementMesure = {
  event_name: NomEvenement
  anonymous_id: string
  journey_id: string | null
  locale: 'fr' | 'en'
  metadata: Record<string, ValeurMesure>
}

const FORME_IDENTIFIANT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Prépare un événement, ou rend `null` s'il ne peut pas être mesuré honnêtement.
 *
 * `null` plutôt qu'une exception : l'émission ne doit jamais interrompre un
 * geste produit, et une exception au milieu d'un envoi de message serait
 * exactement ce qu'on refuse. L'appelant jette, la personne ne voit rien —
 * c'est le contrat, et il est écrit dans `apps/web/src/mesure.ts`.
 */
export const preparerEvenement = (entree: {
  nom: NomEvenement
  identifiant: string
  locale: 'fr' | 'en'
  journeyId?: string | null
  proprietes?: Record<string, ValeurMesure | null | undefined>
}): EvenementMesure | null => {
  if (!NOMS_EVENEMENTS.includes(entree.nom)) return null
  if (!FORME_IDENTIFIANT.test(entree.identifiant)) return null

  const autorisees = PROPRIETES_AUTORISEES[entree.nom]
  const metadata: Record<string, ValeurMesure> = {}

  for (const [cle, valeur] of Object.entries(entree.proprietes ?? {})) {
    // Une propriété absente n'est pas une propriété interdite : `undefined` et
    // `null` sont ce que rend un appelant qui n'a rien à dire sur ce champ —
    // une séance sans semaine connue, par exemple. On l'omet et on continue.
    if (valeur === null || valeur === undefined) continue
    if (!autorisees.includes(cle)) return null
    if (typeof valeur === 'string' && valeur.length > LONGUEUR_MAX_VALEUR) return null
    if (typeof valeur === 'number' && !Number.isFinite(valeur)) return null
    metadata[cle] = valeur
  }

  return {
    event_name: entree.nom,
    anonymous_id: entree.identifiant,
    journey_id: entree.journeyId ?? null,
    locale: entree.locale,
    metadata,
  }
}

/**
 * La durée d'une séance, rangée en tranches — jamais la durée exacte.
 *
 * Le doc 08 demande un `duration_bucket`, et le mot compte. Une durée à la
 * seconde près est un signal de comportement : elle dit combien de temps
 * quelqu'un est resté sur une page de journal intime, et deux durées exactes
 * suffisent souvent à reconnaître un appareil. Cinq tranches suffisent à
 * répondre à la question qu'on se pose réellement — la séance a-t-elle été
 * traversée ou vécue.
 *
 * Les bornes viennent du contenu : les séances du parcours publié annoncent 7,
 * 8 et 9 minutes. `sous-2min` est donc « on a cliqué sans lire », et
 * `plus-20min` « on est parti faire autre chose », les trois tranches du milieu
 * portant tout ce qui est réellement une séance.
 */
export const trancheDuree = (millisecondes: number): string => {
  const minutes = millisecondes / 60_000
  if (!Number.isFinite(minutes) || minutes < 0) return 'inconnue'
  if (minutes < 2) return 'sous-2min'
  if (minutes < 5) return '2-5min'
  if (minutes < 10) return '5-10min'
  if (minutes < 20) return '10-20min'
  return 'plus-20min'
}

/**
 * L'identifiant a-t-il dépassé son terme ?
 *
 * Rend `true` aussi sur une date illisible : un stockage local abîmé ou
 * bricolé à la main ne doit pas produire un identifiant immortel. Le coût du
 * faux positif est un appareil qui repart à neuf dans le funnel ; celui du faux
 * négatif est un identifiant qui vit indéfiniment.
 */
export const identifiantPerime = (creeLe: string, maintenant: Date = new Date()): boolean => {
  const naissance = Date.parse(creeLe)
  if (!Number.isFinite(naissance)) return true
  const jours = (maintenant.getTime() - naissance) / 86_400_000
  return jours < 0 || jours >= MESURE_DUREE_MAX_JOURS
}
