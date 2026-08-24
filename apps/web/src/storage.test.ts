/**
 * Ce que ces tests protègent : que l'application s'ouvre.
 *
 * `loadState` est la toute première chose qu'exécute App.tsx (`useState(() =>
 * loadState())`). Une exception ici n'est pas rattrapée : l'écran reste blanc,
 * et le reste jusqu'à ce que l'utilisateur sache vider son navigateur — ce
 * qu'un adolescent de seize ans ne fera pas.
 */
import { describe, expect, it } from 'vitest'
import { clearState, initialState, loadState, saveState } from './storage'

const STORAGE_KEY = 'agapeplay-tandem-demo-state'

describe('état local', () => {
  it('rend l’état initial au tout premier lancement', () => {
    expect(loadState()).toEqual(initialState)
  })

  it('relit ce qui a été enregistré', () => {
    const state = { ...initialState, locale: 'en' as const, completedSessionIds: ['repartir-01'] }
    saveState(state)

    expect(loadState()).toEqual(state)
  })

  it('rend l’état initial quand le stockage est corrompu', () => {
    localStorage.setItem(STORAGE_KEY, '{"locale":')

    expect(loadState()).toEqual(initialState)
  })

  it('rend l’état initial quand le stockage contient autre chose qu’un objet', () => {
    localStorage.setItem(STORAGE_KEY, 'null')

    // `JSON.parse('null')` réussit : ce n'est pas le `try/catch` qui sauve ici,
    // mais l'étalement sur `initialState`. Sans lui, `state.tandem.status`
    // planterait au premier rendu.
    expect(loadState()).toEqual(initialState)
  })

  it('complète un état enregistré à qui il manque des champs ajoutés depuis', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ locale: 'en' }))
    const state = loadState()

    // Une version antérieure de l'application n'enregistrait pas tous les
    // champs. La fusion évite que `journalEntries` soit `undefined` et que le
    // journal plante à l'ouverture.
    expect(state.locale).toBe('en')
    expect(state.journalEntries).toEqual([])
    expect(state.tandem).toEqual(initialState.tandem)
  })
})

describe('effacement local', () => {
  it('ne laisse rien derrière lui, et l’application se rouvre sur l’état initial', () => {
    // Le geste que la suppression de compte déclenche côté navigateur. Ce qui
    // est mesuré n'est pas « la clé a disparu » mais « ce que l'application
    // relira » : c'est `loadState` qu'App.tsx appelle au démarrage.
    saveState({ ...initialState, journalEntries: [{ id: 'j1', createdAt: '2026-08-24', text: 'À ne pas laisser traîner.', mood: 'Présent' }] })
    expect(loadState().journalEntries).toHaveLength(1)

    clearState()

    expect(loadState()).toEqual(initialState)
  })
})
