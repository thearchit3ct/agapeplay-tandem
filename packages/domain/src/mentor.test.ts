import { describe, expect, it } from 'vitest'

import {
  CATEGORIES_AIDE,
  MOTS_ENCOURAGEMENT,
  SIGNAL_SEUIL_JOURS,
  SIGNAUX,
  gestesDuParticipant,
  mentorJoignable,
  orientationHumaine,
} from './mentor'
import { ABSENCE_SEUIL_JOURS } from './bilan'
import type { MonAccompagnement } from './mentor'

const accompagnement = (surcharge: Partial<MonAccompagnement> = {}): MonAccompagnement => ({
  assignmentId: 'a1',
  mentorId: 'm1',
  nom: 'Claire',
  statut: 'active',
  verification: 'verified',
  formation: 'completed',
  proposeLe: '2026-08-01T10:00:00.000Z',
  ...surcharge,
})

describe('les listes closes', () => {
  it('garde les quatre signaux, et pas un de plus', () => {
    // Un cinquième signal ajouté ici sans son jumeau dans la migration
    // produirait un écran qui affiche un mot que la base n'écrit jamais.
    expect(SIGNAUX).toEqual(['aide_demandee', 'nouveau', 'actif', 'a_relancer'])
  })

  it('propose six mots d’encouragement, tous distincts', () => {
    expect(MOTS_ENCOURAGEMENT).toHaveLength(6)
    expect(new Set(MOTS_ENCOURAGEMENT).size).toBe(6)
  })

  it('met « autre » en dernier dans les catégories d’aide', () => {
    // Comme CATEGORIES_PROPOSEES du signalement : la sortie de secours ne
    // se présente pas en premier, sinon elle absorbe tout.
    expect(CATEGORIES_AIDE.at(-1)).toBe('autre')
  })

  it('n’oriente vers les numéros que sur « moral »', () => {
    expect(orientationHumaine('moral')).toBe(true)
    // Témoin : les quatre autres n'affichent rien, sans quoi l'avertissement
    // deviendrait un décor qu'on ne lit plus.
    expect(CATEGORIES_AIDE.filter((c) => orientationHumaine(c))).toEqual(['moral'])
  })

  it('part strictement après l’horloge du bilan', () => {
    // Le point de la décision : si les deux seuils se croisaient, un même
    // silence produirait deux relances le même jour, dont une par un adulte.
    expect(SIGNAL_SEUIL_JOURS).toBeGreaterThan(ABSENCE_SEUIL_JOURS)
  })
})

describe('mentorJoignable', () => {
  it('exige la vérification ET la formation, pas l’une ou l’autre', () => {
    expect(mentorJoignable(accompagnement())).toBe(true)
    expect(mentorJoignable(accompagnement({ verification: 'pending' }))).toBe(false)
    expect(mentorJoignable(accompagnement({ formation: 'in_progress' }))).toBe(false)
  })

  it('ne tient pas une proposition pour une relation', () => {
    // « pending » veut dire que le jeune n'a pas encore répondu. Rien ne part
    // vers un mentor avant ce oui.
    expect(mentorJoignable(accompagnement({ statut: 'pending' }))).toBe(false)
  })

  it('rend faux sans accompagnement du tout', () => {
    expect(mentorJoignable(null)).toBe(false)
  })
})

describe('gestesDuParticipant', () => {
  it('n’offre le bouton d’aide qu’à qui sera vraiment lu', () => {
    expect(gestesDuParticipant(accompagnement(), false).demanderDeLAide).toBe(true)
    expect(gestesDuParticipant(accompagnement({ verification: 'revoked' }), false).demanderDeLAide).toBe(false)
  })

  it('ne laisse pas rappeler tant qu’une demande est ouverte', () => {
    // Sinon l'écran fait échouer le geste sur l'index unique de la base, et
    // un refus technique se lit comme une panne.
    expect(gestesDuParticipant(accompagnement(), true).demanderDeLAide).toBe(false)
  })

  it('oriente exactement quand personne ne peut recevoir — jamais de silence', () => {
    // Le critère de l'issue : « l'écran ne promet pas une aide que personne ne
    // recevra ». Il n'existe donc aucun état où les deux sont faux.
    for (const cas of [null, accompagnement({ statut: 'pending' }), accompagnement({ formation: 'expired' })]) {
      expect(gestesDuParticipant(cas, false).orienter).toBe(true)
    }
    // Témoin : un mentor joignable, lui, n'a pas besoin d'être contourné.
    expect(gestesDuParticipant(accompagnement(), false).orienter).toBe(false)
    expect(gestesDuParticipant(null, false)).toEqual({ repondre: false, demanderDeLAide: false, orienter: true })
  })

  it('propose de répondre tant que la proposition attend', () => {
    expect(gestesDuParticipant(accompagnement({ statut: 'pending' }), false).repondre).toBe(true)
    expect(gestesDuParticipant(accompagnement(), false).repondre).toBe(false)
  })
})
