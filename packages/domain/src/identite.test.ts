/**
 * Le nom déduit de l'identité, et l'initiale d'avatar.
 *
 * Ces deux fonctions remplacent des constantes de maquette (« Claire »,
 * l'avatar « É ») : leur pire régression serait de se remettre à inventer.
 * D'où les cas vides — la chaîne vide EST le comportement voulu quand la
 * source ne sait pas, jamais un nom plausible.
 */
import { describe, expect, it } from 'vitest'
import { initialeDe, nomDepuisIdentite } from './index'

describe('nomDepuisIdentite', () => {
  it('préfère le nom complet du fournisseur d’identité', () => {
    expect(nomDepuisIdentite({ full_name: 'Naomi Dupont', name: 'naomi' }, 'x@y.fr')).toBe('Naomi Dupont')
  })

  it('retombe sur name, puis sur la partie locale de l’email', () => {
    expect(nomDepuisIdentite({ name: 'Naomi' }, 'x@y.fr')).toBe('Naomi')
    expect(nomDepuisIdentite({}, 'naomi.dupont@exemple.fr')).toBe('naomi.dupont')
  })

  it('ignore les métadonnées vides ou non textuelles au lieu de les afficher', () => {
    expect(nomDepuisIdentite({ full_name: '   ', name: 42 }, 'x@y.fr')).toBe('x')
  })

  it('rend une chaîne vide quand rien n’est connu — jamais un nom inventé', () => {
    expect(nomDepuisIdentite(undefined, undefined)).toBe('')
    expect(nomDepuisIdentite({}, '')).toBe('')
  })
})

describe('initialeDe', () => {
  it('rend la première lettre en capitale, accents compris', () => {
    expect(initialeDe('élodie')).toBe('É')
    expect(initialeDe('  benjamin')).toBe('B')
  })

  it('rend « ? » sur vide ou absent, pas une lettre inventée', () => {
    expect(initialeDe('')).toBe('?')
    expect(initialeDe(null)).toBe('?')
    expect(initialeDe(undefined)).toBe('?')
  })
})
