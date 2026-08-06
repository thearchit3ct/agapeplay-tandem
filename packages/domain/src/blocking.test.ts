/**
 * Ce que ces tests protègent : qu'aucun écran ne propose un déblocage qui
 * échouerait, et qu'aucun blocage levable ne reste sans porte.
 *
 * Ils reprennent, sans base de données, la règle de `tandems_update_member`
 * (migration 20260806012728) : sur une ligne `blocked`, seul `blocked_by` peut
 * écrire. Le miroir est volontaire — si la politique change, ce fichier doit
 * changer avec elle, et `tests/rls/blocage.test.ts` reste l'autorité.
 */
import { describe, expect, it } from 'vitest'
import { unblockAffordance } from './blocking'

const moi = '11111111-1111-4111-8111-111111111111'
const autre = '22222222-2222-4222-8222-222222222222'

describe('unblockAffordance', () => {
  it('ouvre le chemin à celui qui a bloqué', () => {
    expect(unblockAffordance({ status: 'blocked', blockedBy: moi, currentUserId: moi })).toBe('unblockable')
  })

  it('ne propose rien à celui qui a été bloqué, et le nomme', () => {
    // Pas 'hidden' : l'autre doit comprendre pourquoi la conversation est
    // muette. Mais pas de bouton non plus — la politique le refuserait.
    expect(unblockAffordance({ status: 'blocked', blockedBy: autre, currentUserId: moi })).toBe('blocked-by-other')
  })

  it('signale les tandems gelés d’avant la migration', () => {
    // `blocked_by` NULL : ni l'un ni l'autre ne peut lever, la levée passe par
    // le support. Vrai des deux côtés de la relation.
    expect(unblockAffordance({ status: 'blocked', blockedBy: null, currentUserId: moi })).toBe('frozen')
    expect(unblockAffordance({ status: 'blocked', blockedBy: null, currentUserId: autre })).toBe('frozen')
  })

  it('se tait tant que personne n’est connecté', () => {
    // Sans identité on ne sait pas de quel côté du blocage on se tient : dire
    // « gelé, écris au support » serait une affirmation sur la ligne de
    // quelqu'un d'autre. Ce cas passe avant celui du `blocked_by` NULL.
    expect(unblockAffordance({ status: 'blocked', blockedBy: null, currentUserId: null })).toBe('hidden')
    expect(unblockAffordance({ status: 'blocked', blockedBy: moi, currentUserId: undefined })).toBe('hidden')
  })

  it('ne parle de déblocage que sur un tandem bloqué', () => {
    // `ended` compris : la vue coupe la messagerie de la même façon, mais une
    // relation terminée n'est pas un blocage et n'a rien à lever.
    for (const status of ['active', 'paused', 'ended', null] as const) {
      expect(unblockAffordance({ status, blockedBy: moi, currentUserId: moi })).toBe('hidden')
    }
  })
})
