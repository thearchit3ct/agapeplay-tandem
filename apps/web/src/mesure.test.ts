/**
 * Ce que ces tests protègent : qu'un refus soit vraiment un refus, et qu'une
 * mesure ne puisse jamais faire tomber un geste produit.
 *
 * Les deux se testent ici et nulle part ailleurs. La règle sur le contenu des
 * événements vit dans `packages/domain/src/mesure.ts`, avec ses tests ; ce
 * fichier-ci ne parle que de ce qui est propre à cet appareil — le stockage, le
 * consentement, et le silence de l'envoi.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appliquerConsentementDuCompte, emettre, mesureAcceptee,
  oublierIdentifiantDeMesure, poserConsentementLocal, premiereFois,
} from './mesure'

/** Un client qui note ce qu'on lui a demandé d'écrire. */
const clientEspion = (reponse: () => Promise<unknown> = async () => ({ error: null })) => {
  const lignes: Record<string, unknown>[] = []
  const client = {
    from: (table: string) => ({
      insert: (ligne: Record<string, unknown>) => {
        expect(table).toBe('analytics_events')
        lignes.push(ligne)
        return reponse()
      },
    }),
  }
  return { client: client as never, lignes }
}

describe('le consentement', () => {
  it('mesure par défaut, sans réglage posé', () => {
    expect(mesureAcceptee()).toBe(true)
  })

  it('n’émet plus rien après un refus, et efface l’identifiant', async () => {
    const { client, lignes } = clientEspion()
    await emettre(client, 'partner_accepted', { locale: 'fr' })
    const identifiantAvant = localStorage.getItem('agapeplay-tandem-mesure-id')
    expect(identifiantAvant).not.toBeNull()

    poserConsentementLocal(false)

    await emettre(client, 'partner_accepted', { locale: 'fr' })
    expect(lignes).toHaveLength(1)
    expect(localStorage.getItem('agapeplay-tandem-mesure-id')).toBeNull()
  })

  it('respecte un refus venu du compte, même si cet appareil disait oui', async () => {
    // Le cas qui donne son sens au critère « respecté partout » : le refus a
    // été posé depuis un autre appareil, celui-ci n'en sait rien jusqu'à
    // l'ouverture de session.
    poserConsentementLocal(true)
    appliquerConsentementDuCompte(false)

    const { client, lignes } = clientEspion()
    await emettre(client, 'partner_accepted', { locale: 'fr' })

    expect({ accepte: mesureAcceptee(), lignes: lignes.length }).toEqual({ accepte: false, lignes: 0 })
    appliquerConsentementDuCompte(true)
  })

  it('ne réactive pas la mesure sur un appareil qui l’a refusée', async () => {
    // La symétrie serait une erreur : l'accord du compte est un défaut, le
    // refus local est un choix posé ici, sur cet écran-là.
    poserConsentementLocal(false)
    appliquerConsentementDuCompte(true)
    expect(mesureAcceptee()).toBe(false)
  })
})

describe('l’identifiant d’appareil', () => {
  it('est un tirage, et ne ressemble à aucun identifiant de compte', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    await emettre(client, 'partner_accepted', { locale: 'fr' })

    const stocke = JSON.parse(localStorage.getItem('agapeplay-tandem-mesure-id') ?? '{}')
    expect(lignes[0].anonymous_id).toBe(stocke.id)
    expect(stocke.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('repart à neuf après une suppression, sans renouer avec l’ancien', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    await emettre(client, 'partner_accepted', { locale: 'fr' })
    oublierIdentifiantDeMesure()
    await emettre(client, 'partner_accepted', { locale: 'fr' })

    expect(lignes[0].anonymous_id).not.toBe(lignes[1].anonymous_id)
  })

  it('rend son jalon au premier passage seulement, et l’oublie avec l’identifiant', () => {
    expect(premiereFois('parcours:repartir-avec-jesus')).toBe(true)
    expect(premiereFois('parcours:repartir-avec-jesus')).toBe(false)
    oublierIdentifiantDeMesure()
    expect(premiereFois('parcours:repartir-avec-jesus')).toBe(true)
  })
})

describe('l’envoi ne fait jamais de mal', () => {
  it('avale une erreur de base sans lever', async () => {
    poserConsentementLocal(true)
    const { client } = clientEspion(async () => { throw new Error('réseau coupé') })
    // Si cette promesse rejetait, elle rejetterait au milieu d'une séance
    // terminée ou d'un signalement envoyé.
    await expect(emettre(client, 'partner_accepted', { locale: 'fr' })).resolves.toBeUndefined()
  })

  it('n’écrit rien hors session : la politique d’insertion n’ouvre plus à anon', async () => {
    poserConsentementLocal(true)
    await expect(emettre(null, 'partner_accepted', { locale: 'fr' })).resolves.toBeUndefined()
  })

  it('n’envoie pas un événement que la base refuserait', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    // `duration_bucket` n'est pas une propriété de `partner_invited` : le
    // domaine rend `null`, et rien ne part. Aucun avertissement non plus — un
    // message de console porterait la valeur fautive.
    await emettre(client, 'partner_invited', { locale: 'fr', proprietes: { duration_bucket: '5-10min' } })
    expect(lignes).toEqual([])
  })

  it('ajoute la plateforme là où le doc 08 la prévoit, et nulle part ailleurs', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    await emettre(client, 'account_created', { locale: 'fr' })
    await emettre(client, 'share_created', { locale: 'en', journeyId: 'repartir-avec-jesus', proprietes: { share_type: 'journal_entry' } })

    expect(lignes[0].metadata).toEqual({ platform: 'web' })
    expect(lignes[1]).toMatchObject({ locale: 'en', journey_id: 'repartir-avec-jesus', metadata: { share_type: 'journal_entry' } })
  })
})

describe('ce qui ne doit jamais partir', () => {
  it('ne laisse passer aucun texte de journal, même sous une clé permise', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    const confidence = 'je n’arrive plus à dormir depuis que mes parents se séparent'

    await emettre(client, 'report_created', { locale: 'fr', proprietes: { category: confidence } })
    await emettre(client, 'session_completed', { locale: 'fr', proprietes: { duration_bucket: confidence } })

    expect(lignes).toEqual([])
  })

  it('n’écrit aucune colonne qui désignerait le compte', async () => {
    poserConsentementLocal(true)
    const { client, lignes } = clientEspion()
    await emettre(client, 'session_completed', { locale: 'fr', journeyId: 'repartir-avec-jesus', proprietes: { day: 2, duration_bucket: '5-10min' } })

    // La garde est sur le jeu de clés lui-même : un `user_id` ajouté un jour à
    // l'émission ferait de la table un journal d'activité nominatif, et le
    // reste du dispositif — la suppression comprise — deviendrait faux.
    expect(Object.keys(lignes[0]).sort()).toEqual(['anonymous_id', 'event_name', 'journey_id', 'locale', 'metadata'])
  })
})

afterEach(() => {
  // Le refus du compte vit dans une variable de module, que `beforeEach` du
  // socle ne remet pas à zéro : sans cela, un test contaminerait le suivant.
  appliquerConsentementDuCompte(true)
  vi.restoreAllMocks()
})
