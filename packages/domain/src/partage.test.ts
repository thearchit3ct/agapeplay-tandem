/**
 * Ce que ces tests protègent : qu'un blocage referme réellement les partages du
 * journal, et qu'aucun écran ne présente un bouton « partager » là où le
 * `with check` de `journal_shares_insert_author` lèverait.
 *
 * Ils reprennent, sans base de données, la clause de statut que
 * `20260825160000_partage_du_journal.sql` pose aux deux bouts — insertion et
 * lecture. Le miroir est volontaire : si la migration change,
 * `tests/rls/partage-journal.test.ts` reste l'autorité et ce fichier doit
 * changer avec elle.
 */
import { describe, expect, it } from 'vitest'
import { partageDuJournal } from './partage'
import { accesConversation } from './conversation'

const moi = '11111111-1111-4111-8111-111111111111'
const autre = '22222222-2222-4222-8222-222222222222'

describe('partageDuJournal', () => {
  it('ouvre le partage sur un tandem actif', () => {
    expect(partageDuJournal({ status: 'active', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutPartager: true, raison: 'ouvert' })
  })

  it('l’ouvre aussi sur un tandem en pause', () => {
    // Même porte que `messages_insert_member` : `paused` n'est pas une
    // fermeture, et refermer ici inventerait une règle que la base n'a pas.
    expect(partageDuJournal({ status: 'paused', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutPartager: true, raison: 'ouvert' })
  })

  it('le referme sur une relation terminée', () => {
    expect(partageDuJournal({ status: 'ended', blockedBy: null, currentUserId: moi }))
      .toEqual({ peutPartager: false, raison: 'termine' })
  })

  it('le referme sur un blocage, sans identité chargée non plus', () => {
    expect(partageDuJournal({ status: 'blocked', blockedBy: autre, currentUserId: moi }))
      .toEqual({ peutPartager: false, raison: 'bloque' })
    expect(partageDuJournal({ status: 'active', blockedBy: null, currentUserId: null }))
      .toEqual({ peutPartager: false, raison: 'aucun-tandem' })
    expect(partageDuJournal({ status: null, blockedBy: null, currentUserId: moi }))
      .toEqual({ peutPartager: false, raison: 'aucun-tandem' })
  })

  it('CONTRASTE — celui qui a bloqué garde les messages, jamais les partages', () => {
    // C'est la décision de conception du chantier, et elle est fragile
    // précisément parce qu'elle a l'air d'une incohérence. Une même entrée,
    // deux réponses opposées : `blocage_effectif` garde l'historique lisible à
    // qui a bloqué (il en a besoin pour signaler), tandis qu'une entrée de
    // journal reste entière à son auteur — bloquer quelqu'un, c'est cesser de
    // lui donner à lire. « Harmoniser » les deux rouvrirait le journal d'un
    // mineur à la personne dont il vient de se protéger.
    const vue = { status: 'blocked', blockedBy: moi, currentUserId: moi } as const

    expect(accesConversation(vue).peutLire).toBe(true)
    expect(partageDuJournal(vue).peutPartager).toBe(false)
  })
})
