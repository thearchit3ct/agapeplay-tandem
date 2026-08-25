/**
 * Ce que ces tests protègent : qu'un texte de journal ne puisse pas sortir de
 * l'appareil sous couvert de mesure.
 *
 * Le reste — noms d'événements, tranches de durée, péremption — sert le funnel.
 * Le premier bloc, lui, sert la promesse du doc 06, et c'est le seul dont
 * l'échec serait un incident plutôt qu'un bug.
 */
import { describe, expect, it } from 'vitest'
import {
  MESURE_DUREE_MAX_JOURS, NOMS_EVENEMENTS, PROPRIETES_AUTORISEES,
  identifiantPerime, preparerEvenement, trancheDuree,
} from './mesure'

const IDENTIFIANT = '3f2a9c1e-7b4d-4e2a-9f18-0c5b6d7e8a91'
const base = { identifiant: IDENTIFIANT, locale: 'fr' as const }

describe('ce qu’un événement ne peut pas porter', () => {
  it('refuse une propriété hors du catalogue, même sur un événement connu', () => {
    // Le cas réel qu'on redoute : quelqu'un ajoute « le contexte, ça aidera à
    // comprendre » à l'émission d'une séance terminée.
    const evenement = preparerEvenement({
      ...base, nom: 'session_completed',
      proprietes: { day: 3, reflexion: 'j’ai pleuré en écrivant ça' },
    })
    expect(evenement).toBeNull()
  })

  it('refuse une valeur trop longue sur une clé pourtant permise', () => {
    // Deuxième chemin, et le plus sournois : la clé est légitime, la valeur
    // est une phrase. `category` attend « secret », pas un récit.
    expect(preparerEvenement({
      ...base, nom: 'report_created',
      proprietes: { category: 'il me demande de ne rien dire à mes parents et j’ai peur' },
    })).toBeNull()
  })

  it('accepte la même chose une fois rangée en catégorie', () => {
    // Témoin positif : sans lui, les deux tests ci-dessus passeraient aussi
    // avec une fonction qui refuse tout.
    expect(preparerEvenement({
      ...base, nom: 'report_created',
      proprietes: { category: 'secret', channel_type: 'conversation' },
    })).toEqual({
      event_name: 'report_created',
      anonymous_id: IDENTIFIANT,
      journey_id: null,
      locale: 'fr',
      metadata: { category: 'secret', channel_type: 'conversation' },
    })
  })

  it('ne laisse aucun événement porter une propriété de texte libre', () => {
    // Garde sur le catalogue lui-même : c'est le doc 08 qui est protégé ici,
    // pas une émission particulière. Un `reason` ou un `body` ajouté un jour à
    // la matrice rougirait, migration SQL ou pas.
    const suspectes = ['text', 'body', 'reason', 'message', 'note', 'reflection', 'content']
    for (const [nom, clefs] of Object.entries(PROPRIETES_AUTORISEES)) {
      expect({ [nom]: clefs.filter((c) => suspectes.includes(c)) }).toEqual({ [nom]: [] })
    }
  })
})

describe('l’identifiant', () => {
  it('refuse un événement dont l’identifiant n’a pas la forme d’un tirage', () => {
    // Un identifiant de compte, une adresse, un pseudonyme : tous échouent ici
    // avant d'atteindre la contrainte SQL qui dit la même chose.
    for (const faux of ['claire@example.org', 'utilisateur-42', '', 'null']) {
      expect({ [faux]: preparerEvenement({ ...base, identifiant: faux, nom: 'partner_accepted' }) })
        .toEqual({ [faux]: null })
    }
  })

  it('se périme à treize mois, pas avant', () => {
    const naissance = new Date('2026-01-01T00:00:00.000Z')
    const jour = (n: number) => new Date(naissance.getTime() + n * 86_400_000)
    expect(identifiantPerime(naissance.toISOString(), jour(MESURE_DUREE_MAX_JOURS - 1))).toBe(false)
    expect(identifiantPerime(naissance.toISOString(), jour(MESURE_DUREE_MAX_JOURS))).toBe(true)
  })

  it('se périme aussi sur une date illisible ou future', () => {
    // Un stockage local bricolé ne doit pas produire un identifiant immortel.
    expect(identifiantPerime('hier')).toBe(true)
    expect(identifiantPerime(new Date(Date.now() + 86_400_000).toISOString())).toBe(true)
  })
})

describe('les événements et leurs propriétés', () => {
  it('refuse un nom d’événement inconnu de la base', () => {
    // La contrainte `analytics_events_nom_connu` refuserait la ligne ; on rend
    // le même verdict, sans aller-retour.
    expect(preparerEvenement({ ...base, nom: 'journal_written' as never })).toBeNull()
  })

  it('omet les propriétés absentes au lieu de refuser l’événement', () => {
    const evenement = preparerEvenement({
      ...base, nom: 'session_completed', journeyId: 'repartir-avec-jesus',
      proprietes: { week: null, day: 2, duration_bucket: undefined },
    })
    expect(evenement?.metadata).toEqual({ day: 2 })
    expect(evenement?.journey_id).toBe('repartir-avec-jesus')
  })

  it('couvre les dix événements du doc 08', () => {
    expect(Object.keys(PROPRIETES_AUTORISEES).sort()).toEqual([...NOMS_EVENEMENTS].sort())
  })
})

describe('les tranches de durée', () => {
  it('range plutôt qu’elle ne mesure', () => {
    const minute = 60_000
    expect(trancheDuree(30_000)).toBe('sous-2min')
    expect(trancheDuree(4 * minute)).toBe('2-5min')
    expect(trancheDuree(8 * minute)).toBe('5-10min')
    expect(trancheDuree(15 * minute)).toBe('10-20min')
    expect(trancheDuree(90 * minute)).toBe('plus-20min')
  })

  it('rend « inconnue » sur une durée impossible plutôt que d’inventer', () => {
    // Une horloge système reculée pendant une séance donne un écart négatif.
    // « sous-2min » serait faux et indétectable ; « inconnue » se compte.
    expect(trancheDuree(-1)).toBe('inconnue')
    expect(trancheDuree(Number.NaN)).toBe('inconnue')
  })

  it('tient dans la longueur permise par la base', () => {
    for (const millisecondes of [0, 60_000, 600_000, 3_600_000]) {
      expect(trancheDuree(millisecondes).length).toBeLessThanOrEqual(40)
    }
  })
})
