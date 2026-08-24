/**
 * Ce que ces tests protègent : qu'aucun écran ne montre un composeur qui
 * lèverait, et surtout qu'aucun ne prenne une lecture coupée par la RLS pour
 * une conversation vide.
 *
 * Ils reprennent, sans base de données, les deux politiques de
 * `public.tandem_messages` telles que `20260806012728_blocage_effectif.sql` les
 * laisse. Le miroir est volontaire — si une politique change, ce fichier doit
 * changer avec elle, et `tests/rls/conversations-privees.test.ts` et
 * `tests/rls/blocage.test.ts` restent l'autorité.
 */
import { describe, expect, it } from 'vitest'
import { accesConversation } from './conversation'

const moi = '11111111-1111-4111-8111-111111111111'
const autre = '22222222-2222-4222-8222-222222222222'

describe('accesConversation', () => {
  it('ouvre tout sur un tandem actif', () => {
    expect(accesConversation({ status: 'active', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutLire: true, peutEcrire: true })
  })

  it('laisse écrire sur un tandem en pause', () => {
    // `messages_insert_member` accepte `paused` autant qu'`active`. Refermer
    // l'écriture ici inventerait une règle que la base n'applique pas.
    expect(accesConversation({ status: 'paused', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutLire: true, peutEcrire: true })
  })

  it('garde l’historique lisible sur une relation terminée', () => {
    // `ended` n'est pas `blocked` : la politique de lecture ne le filtre pas.
    expect(accesConversation({ status: 'ended', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutLire: true, peutEcrire: false })
  })

  it('garde la lecture à celui qui a bloqué, et lui ferme l’écriture', () => {
    // Le découpage de la migration : qui bloque a besoin de l'historique pour
    // signaler, mais la conversation s'arrête pour les deux.
    expect(accesConversation({ status: 'blocked', blockedBy: moi, currentUserId: moi }))
      .toEqual({ peutLire: true, peutEcrire: false })
  })

  it('coupe la lecture à celui qui a été bloqué', () => {
    // Le cas qui justifie cette fonction : le serveur rend zéro ligne sans
    // erreur. C'est ici, et pas dans une réponse HTTP, que l'écran l'apprend.
    expect(accesConversation({ status: 'blocked', blockedBy: autre, currentUserId: moi }))
      .toEqual({ peutLire: false, peutEcrire: false })
  })

  it('coupe la lecture aux deux sur un tandem gelé', () => {
    // `blocked_by` NULL : `auth.uid() = t.blocked_by` n'est vrai de personne.
    expect(accesConversation({ status: 'blocked', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutLire: false, peutEcrire: false })
  })

  it('ne dit rien sans identité ni sans tandem chargé', () => {
    expect(accesConversation({ status: 'active', blockedBy: null, currentUserId: undefined }))
      .toEqual({ peutLire: false, peutEcrire: false })
    expect(accesConversation({ status: null, blockedBy: null, currentUserId: moi }))
      .toEqual({ peutLire: false, peutEcrire: false })
  })
})
