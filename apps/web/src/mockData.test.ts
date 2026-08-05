/**
 * Ce que ces tests protègent : le parcours servi quand Supabase n'est pas
 * joignable — c'est-à-dire tout ce que voit un utilisateur hors ligne, et tout
 * ce que voit l'application tant que le contenu n'est pas publié.
 *
 * Les deux jeux de séances sont écrits à la main, l'un sous l'autre. Ajouter
 * une séance française sans son équivalent anglais raccourcit le parcours d'un
 * anglophone sans qu'aucune erreur ne se produise ; et comme la progression
 * s'enregistre par identifiant de séance, deux identifiants divergents feraient
 * repartir de zéro un jeune qui change de langue.
 */
import { describe, expect, it } from 'vitest'
import { getJourney } from './mockData'

const french = getJourney('fr')
const english = getJourney('en')

describe('parcours de repli', () => {
  it('porte le même identifiant de parcours dans les deux langues', () => {
    // App.tsx écrit `journey_id: 'repartir-avec-jesus'` en dur au moment
    // d'enregistrer la progression : cet identifiant est un contrat.
    expect(french.id).toBe('repartir-avec-jesus')
    expect(english.id).toBe(french.id)
  })

  it('propose autant de séances dans les deux langues', () => {
    expect(english.sessions).toHaveLength(french.sessions.length)
    expect(french.sessions.length).toBeGreaterThan(0)
  })

  it('aligne les identifiants et les jours des séances', () => {
    const repere = (journey: typeof french) => journey.sessions.map((session) => [session.id, session.day])

    expect(repere(english)).toEqual(repere(french))
  })

  it('numérote les jours à partir de 1, sans trou ni doublon', () => {
    const jours = french.sessions.map((session) => session.day)

    expect(jours).toEqual(Array.from({ length: jours.length }, (_, index) => index + 1))
  })

  it('traduit tout le texte affiché, sans rien laisser en français', () => {
    for (const key of ['title', 'eyebrow', 'description', 'duration'] as const) {
      expect({ [key]: english[key] }).not.toEqual({ [key]: french[key] })
    }
    english.sessions.forEach((session, index) => {
      for (const key of ['title', 'theme', 'verse', 'prompt', 'action'] as const) {
        expect({ [`séance ${index + 1} · ${key}`]: session[key] })
          .not.toEqual({ [`séance ${index + 1} · ${key}`]: french.sessions[index][key] })
      }
    })
  })
})
