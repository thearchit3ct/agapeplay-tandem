/**
 * Les règles de communauté, éprouvées sans base — issue #17.
 *
 * Ce que ces tests gardent, c'est la **correspondance** avec la migration.
 * Chacun d'eux a un jumeau dans `tests/rls/communaute.test.ts` ; celui-ci
 * tourne en quelques millisecondes et rougit à l'écriture, l'autre exige une
 * base et fait autorité. Les deux ensemble disent qu'un écran ne proposera pas
 * un geste que la base refuserait, et ne refusera pas un geste qu'elle accepte
 * — le second sens est le plus facile à casser sans s'en apercevoir.
 */
import { describe, expect, it } from 'vitest'
import {
  cohorteRecevable, etatCohorte, etatLien, jetonDepuisUrl, jourUtc,
  lienDInvitation, placesRestantes, pouvoirsEglise, refusDAdhesion,
  type Cohorte, type LienInvitation,
} from './communaute'

const cohorte = (attributs: Partial<Cohorte> = {}): Cohorte => ({
  id: 'c1', nom: 'Cohorte', statut: 'active', debutLe: null, finLe: null, ...attributs,
})

const lien = (attributs: Partial<LienInvitation> = {}): LienInvitation => ({
  jeton: 'abc', statut: 'pending', expireLe: '2026-09-30T00:00:00.000Z', usages: 0, usagesMax: 50, ...attributs,
})

const LE_25_AOUT = new Date('2026-08-25T10:00:00.000Z')

describe('pouvoirsEglise', () => {
  it('donne tout au responsable d’une église active', () => {
    expect(pouvoirsEglise('leader', 'active')).toEqual({ organiser: true, inviter: true, affecter: true })
  })

  it('laisse le responsable d’une église en attente préparer, sans faire entrer personne', () => {
    // La décision 1 de la migration, vue depuis l'écran : les boutons
    // d'organisation restent, les deux actes liants disparaissent.
    expect(pouvoirsEglise('leader', 'pending')).toEqual({ organiser: true, inviter: false, affecter: false })
    expect(pouvoirsEglise('leader', 'suspended')).toEqual({ organiser: true, inviter: false, affecter: false })
  })

  it('ne donne rien au mentor, au participant — ni à `admin`', () => {
    for (const statut of ['pending', 'active', 'suspended'] as const) {
      for (const role of ['member', 'mentor', 'admin'] as const) {
        expect(pouvoirsEglise(role, statut)).toEqual({ organiser: false, inviter: false, affecter: false })
      }
    }
  })
})

describe('etatCohorte', () => {
  it('lit la fenêtre en UTC, comme la base', () => {
    expect(jourUtc(LE_25_AOUT)).toBe('2026-08-25')
  })

  it('dit `en-cours` d’un groupe sans dates', () => {
    expect(etatCohorte(cohorte(), LE_25_AOUT)).toBe('en-cours')
  })

  it('dit `a-venir` avant le début, et laisse rejoindre', () => {
    const etat = etatCohorte(cohorte({ debutLe: '2026-09-01' }), LE_25_AOUT)
    expect(etat).toBe('a-venir')
    // S'inscrire en août à ce qui commence en septembre : le bord gauche de la
    // fenêtre n'est pas un droit, et l'écran ne doit pas en inventer un.
    expect(cohorteRecevable(etat)).toBe(true)
  })

  it('dit `terminee` le lendemain de la fin, pas le jour même', () => {
    expect(etatCohorte(cohorte({ finLe: '2026-08-25' }), LE_25_AOUT)).toBe('en-cours')
    expect(etatCohorte(cohorte({ finLe: '2026-08-24' }), LE_25_AOUT)).toBe('terminee')
    expect(cohorteRecevable('terminee')).toBe(false)
  })

  it('dit `close` d’une cohorte fermée, même dans sa fenêtre', () => {
    const fermee = cohorte({ statut: 'closed', debutLe: '2026-08-01', finLe: '2026-12-31' })
    expect(etatCohorte(fermee, LE_25_AOUT)).toBe('close')
    expect(cohorteRecevable('close')).toBe(false)
  })
})

describe('etatLien', () => {
  it('dit `vivant` d’un lien qui fait encore entrer quelqu’un', () => {
    expect(etatLien(lien(), LE_25_AOUT)).toBe('vivant')
    expect(placesRestantes(lien({ usages: 3 }))).toBe(47)
  })

  it('fait passer la révocation avant la date : c’est l’ordre de la RPC', () => {
    expect(etatLien(lien({ statut: 'revoked', expireLe: '2026-01-01T00:00:00.000Z' }), LE_25_AOUT)).toBe('revoque')
  })

  it('distingue le périmé de l’épuisé — la réponse du responsable n’est pas la même', () => {
    expect(etatLien(lien({ expireLe: '2026-08-24T00:00:00.000Z' }), LE_25_AOUT)).toBe('perime')
    expect(etatLien(lien({ usages: 50 }), LE_25_AOUT)).toBe('epuise')
  })

  it('ne compte jamais de places négatives', () => {
    expect(placesRestantes(lien({ usages: 60, usagesMax: 50 }))).toBe(0)
  })
})

describe('le lien lui-même', () => {
  it('se fabrique sans double barre, et se relit', () => {
    const url = lienDInvitation('https://tandem.agapeplay.store/', 'jeton-42')
    expect(url).toBe('https://tandem.agapeplay.store/?communaute=jeton-42')
    expect(jetonDepuisUrl('?communaute=jeton-42')).toBe('jeton-42')
  })

  it('ne confond pas un jeton de communauté avec autre chose', () => {
    expect(jetonDepuisUrl('?ref=quelquun&join=autre-chose')).toBeNull()
    expect(jetonDepuisUrl('?communaute=')).toBeNull()
    expect(jetonDepuisUrl('')).toBeNull()
  })
})

describe('refusDAdhesion', () => {
  it('reconnaît chaque code que la RPC peut lever', () => {
    // Le message réel de PostgreSQL est bavard ; c'est le code qu'on cherche.
    expect(refusDAdhesion('error: cohorte_terminee')).toBe('cohorte_terminee')
    expect(refusDAdhesion('adhesion_revoquee')).toBe('adhesion_revoquee')
    expect(refusDAdhesion('deja_dans_une_communaute')).toBe('deja_dans_une_communaute')
  })

  it('se replie honnêtement sur un message qu’il ne connaît pas', () => {
    expect(refusDAdhesion('connexion perdue')).toBe('inconnu')
    expect(refusDAdhesion('')).toBe('inconnu')
  })
})
