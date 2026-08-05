/**
 * Ce que ces tests protègent : la langue dans laquelle un jeune lit sa séance,
 * et le fait qu'il puisse la lire du tout quand le réseau manque.
 *
 * `loadPublishedJourney` choisit treize champs à la main, un ternaire
 * `locale === 'fr' ? … : …` par champ. Une seule inversion — un `verse_fr`
 * laissé dans la branche anglaise — et un adolescent anglophone reçoit son
 * verset en français, sans qu'aucune erreur ne soit levée nulle part. Le seul
 * moyen de voir cela est de comparer champ par champ.
 */
import { describe, expect, it } from 'vitest'
import { loadPublishedJourney } from './journey'
import { createFakeSupabase } from '../../tests/fakeSupabase'

const journeyRow = {
  id: 'repartir-avec-jesus',
  title_fr: 'titre FR', title_en: 'titre EN',
  eyebrow_fr: 'surtitre FR', eyebrow_en: 'surtitre EN',
  description_fr: 'description FR', description_en: 'description EN',
  duration_fr: 'durée FR', duration_en: 'durée EN',
}

const sessionRow = {
  id: 'seance-01', day: 1, duration: 8,
  title_fr: 'séance titre FR', title_en: 'séance titre EN',
  theme_fr: 'thème FR', theme_en: 'thème EN',
  verse_fr: 'verset FR', verse_en: 'verset EN',
  prompt_fr: 'question FR', prompt_en: 'question EN',
  action_fr: 'action FR', action_en: 'action EN',
}

const published = (journey: unknown = journeyRow, sessions: unknown = [sessionRow]) =>
  createFakeSupabase({
    content_journeys: { data: journey, error: null },
    content_sessions: { data: sessions, error: null },
  })

describe('loadPublishedJourney — résolution par langue', () => {
  it('rend chaque champ du parcours dans sa version française', async () => {
    const { client } = published()
    const journey = await loadPublishedJourney(client, 'fr')

    expect(journey).toEqual({
      id: 'repartir-avec-jesus',
      title: 'titre FR',
      eyebrow: 'surtitre FR',
      description: 'description FR',
      duration: 'durée FR',
      sessions: [{
        id: 'seance-01', day: 1, duration: 8,
        title: 'séance titre FR', theme: 'thème FR',
        verse: 'verset FR', prompt: 'question FR', action: 'action FR',
      }],
    })
  })

  it('rend chaque champ du parcours dans sa version anglaise', async () => {
    const { client } = published()
    const journey = await loadPublishedJourney(client, 'en')

    expect(journey).toEqual({
      id: 'repartir-avec-jesus',
      title: 'titre EN',
      eyebrow: 'surtitre EN',
      description: 'description EN',
      duration: 'durée EN',
      sessions: [{
        id: 'seance-01', day: 1, duration: 8,
        title: 'séance titre EN', theme: 'thème EN',
        verse: 'verset EN', prompt: 'question EN', action: 'action EN',
      }],
    })
  })

  it('ne laisse aucun texte de l’autre langue passer dans le résultat', async () => {
    const { client } = published()
    const french = JSON.stringify(await loadPublishedJourney(client, 'fr'))
    const english = JSON.stringify(await loadPublishedJourney(client, 'en'))

    // Une inversion de ternaire ne se voit pas champ par champ si le test se
    // contente de vérifier la présence des textes attendus : elle se voit à
    // l'absence des autres.
    //
    // La première assertion est l'ancre : sans elle, réécrire les fixtures
    // sans le marqueur « FR » viderait la seconde de son sens tout en la
    // laissant au vert.
    expect(french).toContain('FR')
    expect(english).not.toContain('FR')
  })
})

describe('loadPublishedJourney — ce qui est demandé au serveur', () => {
  it('demande le parcours publié et des séances triées par jour', async () => {
    const { client, calls } = published()
    await loadPublishedJourney(client, 'fr')

    const journeyCall = calls.find((call) => call.table === 'content_journeys')
    expect(journeyCall?.filters).toEqual([['id', 'repartir-avec-jesus']])

    // Le tri par jour est délégué à PostgREST. Le test ne peut pas vérifier
    // qu'il trie — il vérifie qu'on le lui demande. Sans ce `order`, les
    // séances arriveraient dans l'ordre d'insertion et le jour 4 pourrait
    // s'afficher avant le jour 2.
    const sessionCall = calls.find((call) => call.table === 'content_sessions')
    expect(sessionCall?.filters).toEqual([['journey_id', 'repartir-avec-jesus']])
    expect(sessionCall?.order).toEqual([['day', { ascending: true }]])
  })
})

describe('loadPublishedJourney — repli sur le cache hors ligne', () => {
  const seedCache = async () => {
    const { client } = published()
    return loadPublishedJourney(client, 'fr')
  }

  it('sert le parcours mis en cache quand la requête parcours échoue', async () => {
    const cached = await seedCache()
    const { client } = createFakeSupabase({
      content_journeys: { data: null, error: { message: 'réseau coupé' } },
      content_sessions: { data: [sessionRow], error: null },
    })

    expect(await loadPublishedJourney(client, 'fr')).toEqual(cached)
  })

  it('sert le cache quand aucun parcours n’est publié', async () => {
    const cached = await seedCache()
    const { client } = published(null)

    expect(await loadPublishedJourney(client, 'fr')).toEqual(cached)
  })

  it('sert le cache quand la requête des séances échoue', async () => {
    const cached = await seedCache()
    const { client } = createFakeSupabase({
      content_journeys: { data: journeyRow, error: null },
      content_sessions: { data: null, error: { message: 'réseau coupé' } },
    })

    expect(await loadPublishedJourney(client, 'fr')).toEqual(cached)
  })

  it('sert le cache plutôt qu’un parcours vide quand aucune séance ne revient', async () => {
    const cached = await seedCache()
    const { client } = published(journeyRow, [])

    // Sans ce repli, l'application afficherait un parcours sans une seule
    // séance : un écran vide, là où le contenu déjà lu était disponible.
    expect(await loadPublishedJourney(client, 'fr')).toEqual(cached)
    expect(cached?.sessions).toHaveLength(1)
  })

  it('rend null, sans lever d’erreur, quand rien n’a jamais été mis en cache', async () => {
    const { client } = published(null)
    await expect(loadPublishedJourney(client, 'fr')).resolves.toBeNull()
  })

  it('rend null, sans lever d’erreur, quand le cache est corrompu', async () => {
    localStorage.setItem('agapeplay-tandem-published-content', '{ ceci n’est pas du JSON')
    const { client } = published(null)

    // Un cache illisible ne doit pas propager une exception jusqu'au rendu :
    // l'écran d'accueil deviendrait blanc pour un appareil, définitivement,
    // jusqu'à ce que l'utilisateur vide son navigateur.
    await expect(loadPublishedJourney(client, 'fr')).resolves.toBeNull()
  })

  it('garde les deux langues en cache côte à côte', async () => {
    const { client } = published()
    const french = await loadPublishedJourney(client, 'fr')
    await loadPublishedJourney(client, 'en')

    // Le cache est un objet indexé par langue : écrire `en` ne doit pas
    // effacer `fr`. Un jeune qui bascule de langue puis repasse hors ligne
    // perdrait sinon le parcours qu'il lisait.
    const { client: offline } = published(null)
    expect(await loadPublishedJourney(offline, 'fr')).toEqual(french)
  })
})
