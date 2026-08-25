import { describe, expect, it } from 'vitest'
import { JOUR_RAPPEL_BILAN, rappelsAPlanifier } from './notifications'
import { cleDeSemaine, semaineDuBilan } from './bilan'

describe('rappelsAPlanifier', () => {
  it('pose les deux rappels quand les deux réglages sont ouverts', () => {
    expect(rappelsAPlanifier({ sessions: true, weekly_checkin: true }).map((rappel) => rappel.clef))
      .toEqual(['seance', 'bilan'])
  })

  it('n’en pose aucun quand tout est coupé', () => {
    // Le cas qui compte : une liste vide vaut annulation côté appareil. Si un
    // jour cette fonction rendait « le rappel par défaut » sur des préférences
    // coupées, quelqu'un qui a dit non recevrait quand même la notification.
    expect(rappelsAPlanifier({ sessions: false, weekly_checkin: false })).toEqual([])
  })

  it('oublie le rappel dont le réglage est coupé, et garde l’autre', () => {
    expect(rappelsAPlanifier({ sessions: false, weekly_checkin: true }).map((rappel) => rappel.clef))
      .toEqual(['bilan'])
    expect(rappelsAPlanifier({ sessions: true, weekly_checkin: false }).map((rappel) => rappel.clef))
      .toEqual(['seance'])
  })

  it('rappelle le bilan le jour où sa fenêtre s’ouvre', () => {
    // La garde qui relie les deux définitions : le jour du rappel est celui où
    // `semaineDuBilan` bascule sur la semaine qui vient de s'achever. Le
    // samedi 29 août 2026 appartient à la semaine 2026-W35, et c'est bien
    // d'elle que le bilan parle ce jour-là. La veille, il parlait encore de la
    // précédente — un rappel posé le vendredi proposerait la mauvaise semaine.
    const samedi = new Date(2026, 7, 29, 11, 0)
    expect(samedi.getDay()).toBe(JOUR_RAPPEL_BILAN)
    expect(semaineDuBilan(samedi)).toBe(cleDeSemaine(samedi))
    const vendrediVeille = new Date(2026, 7, 28, 11, 0)
    expect(semaineDuBilan(vendrediVeille)).not.toBe(cleDeSemaine(vendrediVeille))
  })
})
