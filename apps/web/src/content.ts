import type { SupabaseClient } from '@supabase/supabase-js'
import type { Journey, Locale, Session } from './domain'

const CONTENT_CACHE_KEY = 'agapeplay-tandem-published-content'

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

export const loadPublishedJourney = async (client: SupabaseClient, locale: Locale): Promise<Journey | null> => {
  const journeyResult = await client
    .from('content_journeys')
    .select('id, title_fr, title_en, eyebrow_fr, eyebrow_en, description_fr, description_en, duration_fr, duration_en')
    .eq('id', 'repartir-avec-jesus')
    .maybeSingle()

  if (journeyResult.error || !journeyResult.data) return readCachedJourney(locale)

  const sessionResult = await client
    .from('content_sessions')
    .select('id, day, title_fr, title_en, theme_fr, theme_en, duration, verse_fr, verse_en, prompt_fr, prompt_en, action_fr, action_en')
    .eq('journey_id', journeyResult.data.id)
    .order('day', { ascending: true })

  if (sessionResult.error || !sessionResult.data?.length) return readCachedJourney(locale)

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
  const cachedJourneys = readCachedJourneys()
  cachedJourneys[locale] = journey
  localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cachedJourneys))
  return journey
}

const readCachedJourney = (locale: Locale): Journey | null => {
  try {
    return readCachedJourneys()[locale] ?? null
  } catch {
    return null
  }
}

const readCachedJourneys = (): Partial<Record<Locale, Journey>> => {
  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    return cached ? JSON.parse(cached) as Partial<Record<Locale, Journey>> : {}
  } catch {
    return {}
  }
}
