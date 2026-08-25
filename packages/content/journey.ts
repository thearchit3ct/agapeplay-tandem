/**
 * Catalogue de parcours : lecture du contenu publié dans Supabase, avec un
 * cache local pour rester lisible hors ligne.
 *
 * Déplacé le 05/08/2026 depuis `apps/web/src/content.ts`.
 *
 * **Le stockage est injecté depuis le 26/08/2026** (issue #13), et l'en-tête
 * précédent l'annonçait : « le jour où le mobile chargera le contenu publié,
 * ce stockage devra être injecté ». Ce jour est arrivé, et le motif n'était pas
 * cosmétique — l'écriture du cache était un `localStorage.setItem` nu, sur le
 * chemin **heureux** et hors de tout `try`. Sous Hermes, c'est-à-dire sur un
 * téléphone, cet appel lève une `ReferenceError` : la promesse échouait au
 * moment précis où la lecture réseau venait de réussir, et l'écran n'aurait
 * jamais reçu le parcours qu'il venait de charger.
 *
 * Le défaut reste `localStorage`, si bien que le web n'a rien à passer et rien
 * à changer. Le mobile, lui, injecte son wrapper `stockage` (AsyncStorage, avec
 * repli mémoire quand le module natif manque).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Journey, Locale, Session } from '@agapeplay/domain'

const CONTENT_CACHE_KEY = 'agapeplay-tandem-published-content'

/**
 * Le cache, vu par ce module : deux gestes, éventuellement asynchrones.
 *
 * Asynchrone parce que le stockage d'un téléphone l'est ; le web passe des
 * fonctions synchrones, et `await` sur une valeur non promise ne coûte rien.
 */
export type CacheDeParcours = {
  lire: () => Promise<string | null> | string | null
  ecrire: (valeur: string) => Promise<void> | void
}

/**
 * Le cache du navigateur. Gardé par `try/catch` des deux côtés : un mode privé
 * qui refuse l'écriture ne doit pas faire échouer un chargement qui, lui, a
 * réussi.
 */
export const cacheDuNavigateur: CacheDeParcours = {
  lire: () => {
    try { return localStorage.getItem(CONTENT_CACHE_KEY) } catch { return null }
  },
  ecrire: (valeur) => {
    try { localStorage.setItem(CONTENT_CACHE_KEY, valeur) } catch { /* cache indisponible : le contenu reste affichable, il ne survivra pas au redémarrage */ }
  },
}

type JourneyRow = {
  id: string
  title_fr: string
  title_en: string
  eyebrow_fr: string
  eyebrow_en: string
  description_fr: string
  description_en: string
  duration_fr: string
  duration_en: string
}

type SessionRow = {
  id: string
  day: number
  title_fr: string
  title_en: string
  theme_fr: string
  theme_en: string
  duration: number
  verse_fr: string
  verse_en: string
  prompt_fr: string
  prompt_en: string
  action_fr: string
  action_en: string
}

export const loadPublishedJourney = async (
  client: SupabaseClient,
  locale: Locale,
  cache: CacheDeParcours = cacheDuNavigateur,
): Promise<Journey | null> => {
  const journeyResult = await client
    .from('content_journeys')
    .select('id, title_fr, title_en, eyebrow_fr, eyebrow_en, description_fr, description_en, duration_fr, duration_en')
    .eq('id', 'repartir-avec-jesus')
    .maybeSingle()

  if (journeyResult.error || !journeyResult.data) return readCachedJourney(locale, cache)

  const sessionResult = await client
    .from('content_sessions')
    .select('id, day, title_fr, title_en, theme_fr, theme_en, duration, verse_fr, verse_en, prompt_fr, prompt_en, action_fr, action_en')
    .eq('journey_id', journeyResult.data.id)
    .order('day', { ascending: true })

  if (sessionResult.error || !sessionResult.data?.length) return readCachedJourney(locale, cache)

  const journeyRow = journeyResult.data as JourneyRow
  const sessions = (sessionResult.data as SessionRow[]).map<Session>((session) => ({
    id: session.id,
    day: session.day,
    title: locale === 'fr' ? session.title_fr : session.title_en,
    theme: locale === 'fr' ? session.theme_fr : session.theme_en,
    duration: session.duration,
    verse: locale === 'fr' ? session.verse_fr : session.verse_en,
    prompt: locale === 'fr' ? session.prompt_fr : session.prompt_en,
    action: locale === 'fr' ? session.action_fr : session.action_en,
  }))

  const journey: Journey = {
    id: journeyRow.id,
    title: locale === 'fr' ? journeyRow.title_fr : journeyRow.title_en,
    eyebrow: locale === 'fr' ? journeyRow.eyebrow_fr : journeyRow.eyebrow_en,
    description: locale === 'fr' ? journeyRow.description_fr : journeyRow.description_en,
    duration: locale === 'fr' ? journeyRow.duration_fr : journeyRow.duration_en,
    sessions,
  }
  const cachedJourneys = await readCachedJourneys(cache)
  cachedJourneys[locale] = journey
  await cache.ecrire(JSON.stringify(cachedJourneys))
  return journey
}

const readCachedJourney = async (locale: Locale, cache: CacheDeParcours): Promise<Journey | null> => {
  return (await readCachedJourneys(cache))[locale] ?? null
}

const readCachedJourneys = async (cache: CacheDeParcours): Promise<Partial<Record<Locale, Journey>>> => {
  try {
    const cached = await cache.lire()
    return cached ? JSON.parse(cached) as Partial<Record<Locale, Journey>> : {}
  } catch {
    // Cache illisible ou abîmé : on repart de rien plutôt que de propager une
    // exception jusqu'au rendu — un écran blanc définitif pour un appareil.
    return {}
  }
}
