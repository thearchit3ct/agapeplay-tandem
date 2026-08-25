/**
 * L'émission des événements de mesure, côté mobile — issue #20.
 *
 * Le jumeau de `apps/web/src/mesure.ts`, et les décisions y sont écrites une
 * fois pour les deux : identifiant tiré au sort et jamais dérivé du compte,
 * consentement dont le refus l'emporte, envoi silencieux, aucune file
 * hors-ligne. Ce fichier ne réécrit que ce qui diffère réellement.
 *
 * Ce qui diffère, et c'est tout :
 *
 *   - **le stockage est asynchrone**. Tout passe par le wrapper `stockage`, qui
 *     porte le repli mémoire quand le module natif d'AsyncStorage est nul (voir
 *     son commentaire — le bug est mesuré, pas théorique). Un quatrième usage
 *     direct d'AsyncStorage referait ce bug ;
 *   - **`crypto.randomUUID` n'existe pas partout** sur Hermes. On tire donc
 *     l'identifiant à partir d'octets aléatoires quand la fonction manque ;
 *   - **`platform` vaut `mobile`**, là où le doc 08 le prévoit.
 *
 * Ce que le mobile n'émet pas, et pourquoi : `account_created`. Le geste qui
 * crée un compte au sens de ce produit — âge confirmé, consentements posés —
 * n'existe que sur le web (`saveTrust`). L'écran mobile de connexion envoie un
 * lien magique et rien d'autre. Émettre l'événement à la première session
 * mobile compterait un compte de plus à chaque appareil, et le funnel dirait
 * qu'il se crée plus de comptes qu'il n'y a de personnes. Écart nommé dans
 * `docs/25`.
 */
import { PROPRIETES_AUTORISEES, identifiantPerime, preparerEvenement } from '@agapeplay/domain'
import type { Locale, NomEvenement, ValeurMesure } from '@agapeplay/domain'
import { stockage } from './storage'
import { supabase } from './supabase'

const CLEF_IDENTIFIANT = 'agapeplay:tandem:mesure-id'
const CLEF_CONSENTEMENT = 'agapeplay:tandem:mesure-consentement'

type IdentifiantStocke = { id: string; creeLe: string }

/** Voir le jumeau web : `null` = pas encore lu, le refus l'emporte. */
let refusDuCompte: boolean | null = null

/**
 * Un UUID v4, sans dépendre de `crypto.randomUUID`.
 *
 * Hermes ne la fournit pas dans toutes les versions d'Expo, et un identifiant
 * qui manque à l'exécution ferait taire la mesure sur les appareils les plus
 * anciens — c'est-à-dire, sur un produit destiné à des adolescents, ceux qu'on
 * a le plus de raisons de compter.
 */
const tirerIdentifiant = (): string => {
  const global = globalThis as { crypto?: { randomUUID?: () => string } }
  if (typeof global.crypto?.randomUUID === 'function') return global.crypto.randomUUID()
  const hexadecimal = () => Math.floor(Math.random() * 16).toString(16)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caractere) =>
    caractere === 'x' ? hexadecimal() : ((Math.floor(Math.random() * 4) + 8).toString(16)))
}

/**
 * Le consentement de cet appareil, tel qu'il est enregistré ici.
 *
 * Asynchrone, contrairement au web : une lecture de stockage l'est sur mobile.
 * Les appelants sont des gestes déjà asynchrones, cela ne coûte rien.
 */
export const mesureAcceptee = async (): Promise<boolean> => {
  if (refusDuCompte === true) return false
  return (await stockage.getItem(CLEF_CONSENTEMENT)) !== 'non'
}

/** Le réglage de l'appareil. Un refus efface l'identifiant sur-le-champ. */
export const poserConsentementLocal = async (accepte: boolean): Promise<void> => {
  await stockage.setItem(CLEF_CONSENTEMENT, accepte ? 'oui' : 'non')
  if (!accepte) await stockage.removeItem(CLEF_IDENTIFIANT)
}

/**
 * Le refus lu sur le compte. Appelé à l'ouverture de l'accueil, une fois la
 * session connue : c'est ainsi qu'un refus posé depuis le navigateur vaut
 * aussi ici, ce que le seul réglage local ne saurait pas faire.
 */
export const appliquerConsentementDuCompte = async (mesure: boolean): Promise<void> => {
  refusDuCompte = !mesure
  if (!mesure) await stockage.removeItem(CLEF_IDENTIFIANT)
}

/**
 * Lit le consentement du compte et l'applique. Rend l'état effectif, prêt à
 * afficher. Une lecture qui échoue ne change rien : on garde ce que l'appareil
 * savait déjà, plutôt que de présumer l'accord.
 */
export const lireConsentementDuCompte = async (userId: string): Promise<boolean> => {
  if (!supabase) return mesureAcceptee()
  const { data, error } = await supabase.from('mesure_preferences').select('mesure').eq('user_id', userId).maybeSingle()
  if (!error) await appliquerConsentementDuCompte(data?.mesure ?? true)
  return mesureAcceptee()
}

/**
 * Pose le réglage des deux côtés : l'appareil d'abord, le compte ensuite.
 *
 * L'écriture distante lit sa réponse — c'est un réglage, pas un événement, et
 * l'exception « on lit pour jeter » ne couvre que l'émission. Rend l'état
 * effectif ; l'écran affiche ce que la base a confirmé, pas ce qu'on espérait.
 */
export const basculerMesure = async (accepte: boolean, userId: string | null): Promise<boolean> => {
  await poserConsentementLocal(accepte)
  if (!supabase || !userId) return accepte
  const { data, error } = await supabase
    .from('mesure_preferences')
    .upsert({ user_id: userId, mesure: accepte, updated_at: new Date().toISOString() })
    .select('mesure')
    .maybeSingle()
  if (error || !data) return mesureAcceptee()
  await appliquerConsentementDuCompte(data.mesure)
  return mesureAcceptee()
}

const identifiant = async (): Promise<string | null> => {
  const brut = await stockage.getItem(CLEF_IDENTIFIANT)
  if (brut) {
    try {
      const stocke = JSON.parse(brut) as IdentifiantStocke
      if (stocke?.id && !identifiantPerime(stocke.creeLe)) return stocke.id
    } catch { /* stockage abîmé : on repart d'un tirage neuf */ }
  }
  const neuf: IdentifiantStocke = { id: tirerIdentifiant(), creeLe: new Date().toISOString() }
  await stockage.setItem(CLEF_IDENTIFIANT, JSON.stringify(neuf))
  return neuf.id
}

/** Efface l'identifiant de cet appareil. Voir le jumeau web. */
export const oublierIdentifiantDeMesure = async (): Promise<void> => {
  await stockage.removeItem(CLEF_IDENTIFIANT)
}

/**
 * Émet un événement. Ne lève jamais, ne rend rien, n'affiche rien — et surtout
 * pas d'`Alert.alert`, que ce dépôt bannit de toute façon.
 */
export const emettre = async (
  nom: NomEvenement,
  options: {
    locale: Locale
    journeyId?: string | null
    proprietes?: Record<string, ValeurMesure | null | undefined>
  },
): Promise<void> => {
  if (!supabase) return
  try {
    if (!(await mesureAcceptee())) return
    const monIdentifiant = await identifiant()
    if (!monIdentifiant) return

    const evenement = preparerEvenement({
      nom,
      identifiant: monIdentifiant,
      locale: options.locale,
      journeyId: options.journeyId,
      proprietes: PROPRIETES_AUTORISEES[nom].includes('platform')
        ? { platform: 'mobile', ...options.proprietes }
        : options.proprietes,
    })
    if (!evenement) return

    await supabase.from('analytics_events').insert(evenement)
  } catch { /* on lit la réponse pour la jeter : voir l'en-tête du jumeau web */ }
}
