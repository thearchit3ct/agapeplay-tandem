/**
 * L'émission des événements de mesure, côté web — issue #20.
 *
 * Ce module tient trois choses, et rien d'autre : l'identifiant d'appareil, le
 * consentement, et un envoi qui ne peut pas faire de mal. Ce qu'un événement a
 * le droit de dire est décidé ailleurs, dans `packages/domain/src/mesure.ts`,
 * partagé avec le mobile.
 *
 * ---------------------------------------------------------------------------
 * L'exception assumée à « toute écriture lit sa réponse »
 * ---------------------------------------------------------------------------
 *
 * Partout ailleurs dans ce dépôt, une écriture lit sa réponse pour savoir si
 * elle a eu lieu — c'est ce qui empêche l'écran d'annoncer un blocage qui n'a
 * pas été posé. Ici, on lit la réponse **pour la jeter**.
 *
 * La raison est que l'événement n'est jamais le geste : personne ne clique pour
 * émettre un `session_completed`. Un envoi qui échoue ne doit donc rien
 * changer à ce que la personne voit, rien retarder, rien empêcher — et surtout
 * rien afficher. Une erreur de mesure qui interromprait une séance ou ferait
 * apparaître un message d'échec au moment d'un signalement serait une mesure
 * qui abîme ce qu'elle prétend observer.
 *
 * On lit quand même, plutôt que de laisser filer la promesse : une promesse
 * rejetée sans `catch` remonte en « unhandled rejection », que le navigateur
 * signale bruyamment. Lire pour jeter est le seul moyen de se taire vraiment.
 *
 * ---------------------------------------------------------------------------
 * Hors-ligne : la perte est assumée
 * ---------------------------------------------------------------------------
 *
 * Aucune file. `offlineQueue.ts` existe et rejoue les gestes produits — une
 * séance, une entrée de journal, un message — parce que ceux-là appartiennent à
 * quelqu'un et que les perdre serait perdre son travail. Un événement de mesure
 * n'appartient à personne. Le mettre en file coûterait du stockage sur
 * l'appareil, un rejeu à retardement qui fausse les horodatages du funnel, et
 * une file de plus à vider à la suppression de compte. Ce qu'on gagne en
 * échange — quelques pourcents de complétude sur un funnel de pilote — ne vaut
 * pas ce prix. Écart nommé dans `docs/23`.
 */
import { PROPRIETES_AUTORISEES, identifiantPerime, preparerEvenement } from '@agapeplay/domain'
import type { NomEvenement, ValeurMesure } from '@agapeplay/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

const CLEF_IDENTIFIANT = 'agapeplay-tandem-mesure-id'
const CLEF_CONSENTEMENT = 'agapeplay-tandem-mesure-consentement'
const CLEF_JALONS = 'agapeplay-tandem-mesure-jalons'

type IdentifiantStocke = { id: string; creeLe: string }

/**
 * Le refus posé sur le compte, lu à l'ouverture de session.
 *
 * `null` = on ne sait pas encore (avant connexion, ou avant que la lecture
 * n'ait répondu). Dans ce cas, seul le réglage local décide : c'est la seule
 * position tenable, puisqu'il n'y a personne à qui demander.
 *
 * Une variable de module, et non un état React : l'émission est appelée depuis
 * des fonctions qui ne sont pas des composants, et faire remonter le
 * consentement par paramètre jusqu'à chaque point d'émission le rendrait facile
 * à oublier — c'est-à-dire facile à ignorer.
 */
let refusDuCompte: boolean | null = null

/**
 * Le consentement de cet appareil. Actif par défaut : le dispositif est conçu
 * pour être défendable sans case à cocher — aucun tiers, aucune donnée reliée à
 * un compte, aucun profilage, durée bornée — et une bannière de complaisance
 * sur un produit qui promet la discrétion serait du bruit, pas du respect. Le
 * raisonnement complet, ses conditions et sa dette juridique sont dans
 * `docs/23`.
 */
export const mesureAcceptee = (): boolean => {
  if (refusDuCompte === true) return false
  try {
    return localStorage.getItem(CLEF_CONSENTEMENT) !== 'non'
  } catch {
    // Stockage indisponible (navigation privée verrouillée, quota) : on ne
    // mesure pas. Sans stockage il n'y a de toute façon pas d'identifiant
    // stable, donc rien d'exploitable — et présumer l'accord quand on ne peut
    // pas conserver un refus serait le mauvais sens du doute.
    return false
  }
}

/**
 * Le réglage de l'appareil. Un refus efface l'identifiant sur-le-champ : il n'y
 * a aucune raison de garder ce qui ne servira plus, et c'est ce qui rend le
 * refus vérifiable — il ne reste rien à regarder.
 */
export const poserConsentementLocal = (accepte: boolean) => {
  try {
    localStorage.setItem(CLEF_CONSENTEMENT, accepte ? 'oui' : 'non')
    if (!accepte) localStorage.removeItem(CLEF_IDENTIFIANT)
  } catch { /* voir mesureAcceptee : sans stockage, rien à poser */ }
}

/**
 * Le refus lu sur le compte, appliqué à cet appareil.
 *
 * Le refus l'emporte toujours sur l'accord local, jamais l'inverse : quelqu'un
 * qui a dit non depuis son navigateur ne doit pas être remesuré parce que son
 * téléphone n'a jamais été réglé. L'accord, lui, ne réactive rien tout seul —
 * `mesureAcceptee` relit le réglage local, qui peut valoir « non » sur cet
 * appareil-ci.
 */
export const appliquerConsentementDuCompte = (mesure: boolean) => {
  refusDuCompte = !mesure
  if (!mesure) {
    try { localStorage.removeItem(CLEF_IDENTIFIANT) } catch { /* rien à effacer */ }
  }
}

/**
 * L'identifiant d'appareil : tiré au sort, jamais dérivé du compte.
 *
 * C'est la pièce qui décide de tout le reste. Il ne naît que d'un
 * `crypto.randomUUID()` — aucune graine, aucun hachage d'e-mail, aucun
 * identifiant de session. Deux conséquences qu'il faut assumer plutôt que
 * corriger : une même personne sur deux appareils compte deux fois, et un
 * navigateur nettoyé repart à zéro. Le funnel compte donc des appareils, et la
 * vue SQL le dit dans son propre commentaire.
 */
const identifiant = (): string | null => {
  try {
    const brut = localStorage.getItem(CLEF_IDENTIFIANT)
    if (brut) {
      const stocke = JSON.parse(brut) as IdentifiantStocke
      if (stocke?.id && !identifiantPerime(stocke.creeLe)) return stocke.id
    }
    const neuf: IdentifiantStocke = { id: crypto.randomUUID(), creeLe: new Date().toISOString() }
    localStorage.setItem(CLEF_IDENTIFIANT, JSON.stringify(neuf))
    return neuf.id
  } catch {
    return null
  }
}

/**
 * Efface l'identifiant de cet appareil.
 *
 * Appelé à la suppression de compte et à la remise à zéro de la démonstration.
 * C'est **toute** la procédure de suppression côté mesure, et ce n'est pas une
 * pauvreté : rien en base ne désigne la personne, donc il n'y a rien d'autre à
 * supprimer. Ce qu'on efface ici est le seul fil qui reliait les événements
 * d'un même appareil entre eux ; une fois coupé, il ne se renoue pas.
 */
export const oublierIdentifiantDeMesure = () => {
  try {
    localStorage.removeItem(CLEF_IDENTIFIANT)
    // Les jalons partent avec l'identifiant, et pas par symétrie : les garder
    // ferait taire à jamais le `journey_started` du prochain compte ouvert sur
    // cet ordinateur — souvent un ordinateur partagé, à seize ans.
    localStorage.removeItem(CLEF_JALONS)
  } catch { /* rien à effacer */ }
}

/**
 * « Est-ce la première fois, sur cet appareil ? »
 *
 * Certains événements du funnel ne correspondent à aucun geste unique. Le
 * produit ne propose qu'un parcours et n'a pas d'écran de choix : « parcours
 * commencé » se lit donc dans la première ouverture d'une séance, geste qui,
 * lui, se répète. Sans jalon, le funnel compterait un début de parcours par
 * clic et la deuxième étape dépasserait la première.
 *
 * Le jalon vit sur l'appareil, comme l'identifiant, et part avec lui.
 */
export const premiereFois = (jalon: string): boolean => {
  try {
    const poses = JSON.parse(localStorage.getItem(CLEF_JALONS) ?? '[]') as string[]
    if (Array.isArray(poses) && poses.includes(jalon)) return false
    localStorage.setItem(CLEF_JALONS, JSON.stringify([...(Array.isArray(poses) ? poses : []), jalon]))
    return true
  } catch {
    // Sans stockage, on ne peut pas savoir si c'est la première fois. Répondre
    // « non » ne perd qu'une mesure ; répondre « oui » en émettrait une par
    // clic, ce qui est pire qu'un trou : c'est un chiffre faux.
    return false
  }
}

/**
 * Émet un événement. Ne lève jamais, ne rend rien, n'affiche rien.
 *
 * `void emettre(...)` sur l'appel : la signature rend une promesse pour être
 * testable, mais aucun appelant ne l'attend — attendre la mesure ferait entrer
 * un aller-retour réseau dans le chemin d'un geste produit.
 */
export const emettre = async (
  client: SupabaseClient | null,
  nom: NomEvenement,
  options: {
    locale: 'fr' | 'en'
    journeyId?: string | null
    proprietes?: Record<string, ValeurMesure | null | undefined>
  },
): Promise<void> => {
  // Hors session, il n'y a plus de chemin d'écriture : la politique d'insertion
  // est réservée à `authenticated` depuis la migration `20260825190000`. On
  // s'arrête avant l'appel plutôt que d'aller chercher un refus.
  if (!client) return
  if (!mesureAcceptee()) return

  const monIdentifiant = identifiant()
  if (!monIdentifiant) return

  const evenement = preparerEvenement({
    nom,
    identifiant: monIdentifiant,
    locale: options.locale,
    journeyId: options.journeyId,
    // `platform` n'est permis que là où le doc 08 le prévoit — sur
    // `account_created`, la seule mesure où la plateforme est la question. Le
    // poser partout ferait échouer tous les autres événements, puisque le
    // domaine refuse en bloc une propriété hors catalogue.
    proprietes: PROPRIETES_AUTORISEES[nom].includes('platform')
      ? { platform: 'web', ...options.proprietes }
      : options.proprietes,
  })
  // `null` : une propriété hors catalogue, une valeur trop longue. La base
  // refuserait la ligne ; on ne l'envoie pas. Silencieux ici aussi — un
  // avertissement en console porterait la valeur fautive, c'est-à-dire
  // exactement le texte qu'on refuse de laisser sortir.
  if (!evenement) return

  try {
    await Promise.resolve(client.from('analytics_events').insert(evenement))
  } catch { /* voir l'en-tête : on lit la réponse pour la jeter */ }
}
