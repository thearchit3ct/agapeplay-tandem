/**
 * Ce que ces tests protègent : qu'aucune invitation morte ne se présente comme
 * vivante, et qu'aucun bouton de révocation ne soit proposé là où la politique
 * lèverait.
 *
 * Ils reprennent sans base deux règles du schéma — la péremption par
 * `expires_at` (lue par `accept_tandem_invitation` et par
 * `tandems_insert_member`, jamais par le statut seul) et le
 * `not tandem_contact_bloque(...)` du `with check` de
 * `invitations_update_participant` (migration 20260806161500). Le miroir est
 * volontaire : si une politique change, ce fichier doit changer avec elle, et
 * `tests/rls/invitations.test.ts` reste l'autorité.
 */
import { describe, expect, it } from 'vitest'
import { etatInvitation, revocationInvitation, trierInvitations } from './invitations'
import type { Invitation, StatutInvitation } from './invitations'

const maintenant = new Date('2026-08-24T12:00:00.000Z')
const hier = '2026-08-23T12:00:00.000Z'
const demain = '2026-08-25T12:00:00.000Z'

const invitation = (parts: Partial<Invitation>): Invitation => ({
  id: 'i1',
  adresse: 'camille@test.local',
  statut: 'pending',
  expireLe: demain,
  creeeLe: '2026-08-18T12:00:00.000Z',
  accepteeLe: null,
  ...parts,
})

describe('etatInvitation', () => {
  it('dit vivante ce qui attend encore une réponse', () => {
    expect(etatInvitation({ statut: 'pending', expireLe: demain }, maintenant)).toBe('vivante')
  })

  it('dit périmée une invitation « pending » dont la date est passée', () => {
    // Le cœur de la règle : rien ne fait passer `status` à `expired` — ni
    // trigger, ni cron. Une invitation morte reste `pending` en base, et un
    // écran qui lirait le statut afficherait « en attente » pour toujours.
    expect(etatInvitation({ statut: 'pending', expireLe: hier }, maintenant)).toBe('perimee')
  })

  it('traite le statut « expired » comme la péremption par date', () => {
    // La contrainte `check` l'énumère et rien ne l'écrit aujourd'hui. S'il
    // apparaît un jour — purge, reprise manuelle — il se dit pareil à l'écran.
    expect(etatInvitation({ statut: 'expired', expireLe: demain }, maintenant)).toBe('perimee')
  })

  it('laisse une invitation acceptée le rester passé sa date', () => {
    // L'ordre des tests dans la fonction se joue ici : un tandem né il y a un
    // mois ne doit pas disparaître de la liste parce que sept jours ont passé.
    expect(etatInvitation({ statut: 'accepted', expireLe: hier }, maintenant)).toBe('acceptee')
  })

  it('laisse une invitation révoquée le rester passé sa date', () => {
    expect(etatInvitation({ statut: 'revoked', expireLe: hier }, maintenant)).toBe('revoquee')
  })

  it('ne fait pas d’une date atteinte à la seconde une invitation encore vivante', () => {
    // `expires_at > now()` côté SQL : la borne est stricte des deux côtés.
    expect(etatInvitation({ statut: 'pending', expireLe: maintenant.toISOString() }, maintenant)).toBe('perimee')
  })
})

describe('revocationInvitation', () => {
  it('ouvre la révocation sur une invitation vivante et un contact libre', () => {
    expect(revocationInvitation('vivante', false)).toBe('revocable')
  })

  it('ne propose rien sur une paire bloquée, et le nomme', () => {
    // Pas 'sans-objet' : l'inviteur doit comprendre pourquoi son invitation
    // reste là. Mais pas de bouton non plus — le `with check` lèverait.
    expect(revocationInvitation('vivante', true)).toBe('bloquee')
  })

  it('ne propose rien sur ce qui ne mène plus nulle part', () => {
    for (const etat of ['perimee', 'acceptee', 'revoquee'] as const) {
      expect(revocationInvitation(etat, false)).toBe('sans-objet')
    }
  })

  it('dit « sans objet » plutôt que « bloquée » sur une invitation déjà morte', () => {
    // Le blocage n'est pas la cause de son état : elle serait périmée de toute
    // façon. Lui attribuer cette conséquence tromperait sur ce qu'un déblocage
    // changerait.
    expect(revocationInvitation('perimee', true)).toBe('sans-objet')
    expect(revocationInvitation('acceptee', true)).toBe('sans-objet')
  })
})

describe('trierInvitations', () => {
  it('met devant ce qui attend encore une réponse, puis la plus récente', () => {
    const acceptee = invitation({ id: 'acceptee', statut: 'accepted', creeeLe: '2026-08-22T12:00:00.000Z' })
    const perimee = invitation({ id: 'perimee', expireLe: hier, creeeLe: '2026-08-21T12:00:00.000Z' })
    const vieilleVivante = invitation({ id: 'vieille', creeeLe: '2026-08-19T12:00:00.000Z' })
    const jeuneVivante = invitation({ id: 'jeune', creeeLe: '2026-08-23T12:00:00.000Z' })

    expect(trierInvitations([acceptee, perimee, vieilleVivante, jeuneVivante], maintenant).map((i) => i.id))
      .toEqual(['jeune', 'vieille', 'perimee', 'acceptee'])
  })

  it('ne modifie pas la liste qu’on lui donne', () => {
    const liste = [invitation({ id: 'a', creeeLe: '2026-08-19T12:00:00.000Z' }), invitation({ id: 'b' })]
    trierInvitations(liste, maintenant)
    expect(liste.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('range les quatre états dans l’ordre annoncé', () => {
    const statuts: StatutInvitation[] = ['revoked', 'accepted', 'pending']
    const liste = [
      ...statuts.map((statut) => invitation({ id: statut, statut })),
      invitation({ id: 'perimee', expireLe: hier }),
    ]
    expect(trierInvitations(liste, maintenant).map((i) => i.id))
      .toEqual(['pending', 'perimee', 'accepted', 'revoked'])
  })
})
