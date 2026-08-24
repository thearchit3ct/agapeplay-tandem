/**
 * Ce que ces tests protègent : le premier écran de la journée. Une erreur ici
 * ne lève rien et ne se voit pas — elle propose la mauvaise séance, ou aucune.
 *
 * Ils épinglent l'existant, y compris ce qui se discute : le retour à la
 * première séance quand tout est fait est une décision de produit, et si elle
 * change un jour, c'est ce fichier qui doit le dire en échouant.
 */
import { describe, expect, it } from 'vitest'
import { prochaineSeance } from './parcours'
import type { Session } from './index'

const seance = (id: string, day: number): Session => ({
  id,
  day,
  title: `Séance ${day}`,
  theme: 'Confiance',
  duration: 15,
  verse: 'Psaume 23',
  prompt: 'Ce que tu gardes pour toi',
  action: 'Écris-lui',
})

const parcours = [seance('j1', 1), seance('j2', 2), seance('j3', 3)]

describe('prochaineSeance', () => {
  it('propose la première séance d’un parcours neuf', () => {
    expect(prochaineSeance(parcours, [])).toBe(parcours[0])
  })

  it('propose la première séance non faite', () => {
    expect(prochaineSeance(parcours, ['j1'])).toBe(parcours[1])
  })

  it('saute un trou plutôt que de le reproposer', () => {
    // Une séance ouverte hors de l'ordre — c'est possible depuis la vue
    // parcours — ne fait pas revenir en arrière : on reprend au premier trou.
    expect(prochaineSeance(parcours, ['j2'])).toBe(parcours[0])
    expect(prochaineSeance(parcours, ['j1', 'j3'])).toBe(parcours[1])
  })

  it('retombe sur la première quand tout est fait', () => {
    // Décision héritée, épinglée telle quelle : le parcours se relit, il ne se
    // termine pas sur un écran vide.
    expect(prochaineSeance(parcours, ['j1', 'j2', 'j3'])).toBe(parcours[0])
  })

  it('ne rend rien sur un parcours vide', () => {
    // Le seul cas où l'écran n'a aucune séance à montrer. Rendre une séance
    // inventée serait pire : il n'y a rien à lire.
    expect(prochaineSeance([], [])).toBeUndefined()
    expect(prochaineSeance([], ['j1'])).toBeUndefined()
  })

  it('ignore les identifiants qu’il ne connaît pas', () => {
    // Le stockage local survit à un changement de parcours : des ids d'un
    // ancien contenu y restent. Ils ne doivent rien décider ici.
    expect(prochaineSeance(parcours, ['ancien-1', 'ancien-2'])).toBe(parcours[0])
    expect(prochaineSeance(parcours, ['ancien-1', 'j1'])).toBe(parcours[1])
  })

  it('suit l’ordre du tableau, pas le numéro du jour', () => {
    // Aucun tri par `day` : le contenu publié range les séances. Un tri ici
    // masquerait un parcours mal ordonné au lieu de le montrer.
    const desordre = [seance('j3', 3), seance('j1', 1)]
    expect(prochaineSeance(desordre, [])).toBe(desordre[0])
  })
})
