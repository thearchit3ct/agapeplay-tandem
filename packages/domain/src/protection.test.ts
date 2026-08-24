/**
 * Ce que ces tests protègent : que l'écran ne propose pas de bloquer une
 * relation où le geste n'a plus de sens, et qu'il n'enlève pas le signalement à
 * quelqu'un au moment où il en a besoin.
 *
 * Le cas qui justifie le fichier est le deuxième : sur une ligne `ended`, la
 * politique `tandems_update_member` **accepterait** un passage à `blocked`. Ce
 * n'est donc pas la base qui referme ce cas, c'est cette règle — et sans test,
 * personne ne saurait que l'écart est voulu.
 */
import { describe, expect, it } from 'vitest'
import { gestesDeProtection } from './protection'

const moi = '11111111-1111-4111-8111-111111111111'
const autre = '22222222-2222-4222-8222-222222222222'

describe('gestesDeProtection', () => {
  it('propose les deux gestes sur une relation vivante', () => {
    expect(gestesDeProtection({ status: 'active', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutBloquer: true, peutSignaler: true })
  })

  it('laisse bloquer une relation en pause', () => {
    // `paused` n'est pas un blocage : `messages_insert_member` y accepte encore
    // l'écriture. Une relation où l'on peut encore écrire doit pouvoir être
    // fermée.
    expect(gestesDeProtection({ status: 'paused', blockedBy: null, currentUserId: moi }).peutBloquer).toBe(true)
  })

  it('ne propose plus de bloquer une relation déjà bloquée', () => {
    // Vrai des deux côtés : celui qui a bloqué n'a rien à re-bloquer, et l'autre
    // se verrait refuser l'écriture par le `using`, en silence.
    expect(gestesDeProtection({ status: 'blocked', blockedBy: moi, currentUserId: moi }).peutBloquer).toBe(false)
    expect(gestesDeProtection({ status: 'blocked', blockedBy: autre, currentUserId: moi }).peutBloquer).toBe(false)
  })

  it('ne propose pas de bloquer une relation terminée, que la politique laisserait pourtant passer', () => {
    // `using` sort par `status <> 'blocked'`, `with check` est satisfait par
    // `blocked_by = auth.uid()` : l'écriture aboutirait. C'est l'écran qui
    // referme, parce que le geste n'a plus d'objet.
    expect(gestesDeProtection({ status: 'ended', blockedBy: null, currentUserId: moi }).peutBloquer).toBe(false)
  })

  it('garde le signalement ouvert quel que soit l’état de la relation', () => {
    for (const status of ['active', 'paused', 'blocked', 'ended'] as const) {
      expect(gestesDeProtection({ status, blockedBy: autre, currentUserId: moi }).peutSignaler).toBe(true)
    }
    // Y compris sur une ligne gelée d'avant la migration : plus personne n'y lit
    // ni n'y écrit, mais la modération, elle, peut encore être saisie.
    expect(gestesDeProtection({ status: 'blocked', blockedBy: null, currentUserId: moi }).peutSignaler).toBe(true)
  })

  it('se tait tant qu’il n’y a ni identité ni tandem', () => {
    expect(gestesDeProtection({ status: 'active', blockedBy: null, currentUserId: null }))
      .toEqual({ peutBloquer: false, peutSignaler: false })
    expect(gestesDeProtection({ status: null, blockedBy: null, currentUserId: moi }))
      .toEqual({ peutBloquer: false, peutSignaler: false })
  })
})
