/**
 * Ce que ces tests épinglent : les trois décisions du chantier #18, et le seul
 * calcul du dépôt qui se trompe en silence.
 *
 * La numérotation ISO est le genre de code qu'on relit sans y voir de faute :
 * elle rend un nombre plausible toute l'année, et se trompe une semaine sur
 * cinquante-deux. Les cas de bord ci-dessous ne sont pas de la coquetterie —
 * une clé fausse au 1er janvier, c'est un bilan rangé dans la mauvaise semaine
 * et une ligne en double l'année suivante.
 */
import { describe, expect, it } from 'vitest'
import {
  ABSENCE_SEUIL_JOURS,
  ETATS_DE_SEMAINE,
  cleDeSemaine,
  invitationDouce,
  repriseApresAbsence,
  semaineDuBilan,
} from './bilan'

/**
 * Une date locale à midi.
 *
 * Midi et pas minuit : `jourCivil` lit les composantes locales, et un test
 * écrit à minuit passerait ou non selon le fuseau de la machine qui l'exécute.
 * À midi, aucun décalage de fuseau habité ne fait changer la date de jour.
 */
const le = (annee: number, mois: number, jour: number) => new Date(annee, mois - 1, jour, 12, 0, 0)

describe('la clé de semaine ISO', () => {
  it('range un jour ordinaire dans sa semaine', () => {
    // Le 25 août 2026 est un mardi ; sa semaine ISO est la 35e.
    expect(cleDeSemaine(le(2026, 8, 25))).toBe('2026-W35')
    // Les sept jours de la même semaine portent la même clé, dimanche compris —
    // c'est la définition même de la semaine ISO, et la source de la faute la
    // plus fréquente : `getDay()` rend 0 le dimanche, ce qui le rejetterait
    // dans la semaine suivante.
    expect(cleDeSemaine(le(2026, 8, 24))).toBe('2026-W35')
    expect(cleDeSemaine(le(2026, 8, 30))).toBe('2026-W35')
    expect(cleDeSemaine(le(2026, 8, 31))).toBe('2026-W36')
  })

  it('donne à la Saint-Sylvestre l’année de son jeudi', () => {
    // Le 1er janvier 2027 est un vendredi : il appartient à la 53e semaine de
    // 2026. Une implémentation qui lirait l'année de la date rendrait
    // « 2027-W01 » — et rangerait le bilan de quelqu'un un an trop loin.
    expect(cleDeSemaine(le(2027, 1, 1))).toBe('2026-W53')
    expect(cleDeSemaine(le(2026, 12, 31))).toBe('2026-W53')
    // Le miroir : le 29 décembre 2025 est un lundi, et sa semaine appartient
    // déjà à 2026.
    expect(cleDeSemaine(le(2025, 12, 29))).toBe('2026-W01')
  })

  it('numérote sur deux chiffres, pour que le tri textuel dise l’ordre', () => {
    // `2026-W9` se rangerait après `2026-W10` dans un tri de chaînes, et la
    // colonne `week_key` est du texte : le remplissage n'est pas cosmétique.
    expect(cleDeSemaine(le(2026, 2, 24))).toBe('2026-W09')
  })
})

describe('la semaine dont le bilan est ouvert', () => {
  // Le 29 août 2026 est un samedi.
  const samedi = le(2026, 8, 29)
  const dimanche = le(2026, 8, 30)
  const lundi = le(2026, 8, 31)
  const vendrediSuivant = le(2026, 9, 4)
  const samediSuivant = le(2026, 9, 5)

  it('s’ouvre le samedi sur la semaine qui s’achève', () => {
    expect(semaineDuBilan(samedi)).toBe('2026-W35')
    expect(semaineDuBilan(dimanche)).toBe('2026-W35')
  })

  it('reste ouvert toute la semaine suivante, jusqu’au vendredi soir', () => {
    expect(semaineDuBilan(lundi)).toBe('2026-W35')
    expect(semaineDuBilan(vendrediSuivant)).toBe('2026-W35')
  })

  it('bascule le samedi suivant, et la semaine passée s’en va', () => {
    // C'est la propriété qui fait tout le reste : il n'y a jamais deux bilans
    // ouverts, donc jamais d'arriéré à rattraper. W35 n'est plus proposable, et
    // rien ne la rappellera.
    expect(semaineDuBilan(samediSuivant)).toBe('2026-W36')
  })

  it('traverse le changement d’année sans inventer de semaine zéro', () => {
    // Le 4 janvier 2027 est un lundi : le bilan ouvert est celui de la semaine
    // précédente, `2026-W53`. Un calcul qui retrancherait 1 au numéro rendrait
    // « 2027-W00 », qui n'existe pas.
    expect(semaineDuBilan(le(2027, 1, 4))).toBe('2026-W53')
  })
})

describe('la reprise après absence', () => {
  const maintenant = le(2026, 8, 25)

  it('se tait tant que le seuil n’est pas franchi', () => {
    const veille = new Date(maintenant.getTime() - (ABSENCE_SEUIL_JOURS - 1) * 86_400_000)
    expect(repriseApresAbsence(veille, maintenant)).toBe(false)
  })

  it('parle au-delà du seuil', () => {
    const loin = new Date(maintenant.getTime() - (ABSENCE_SEUIL_JOURS + 3) * 86_400_000)
    expect(repriseApresAbsence(loin, maintenant)).toBe(true)
  })

  it('ne prend pas un compte tout neuf pour un retour', () => {
    // Sans activité connue, il n'y a personne à accueillir — et c'est aussi
    // l'état d'une application qui n'a pas encore lu la base. Affirmer une
    // absence y serait affirmer plus qu'on ne sait.
    expect(repriseApresAbsence(null, maintenant)).toBe(false)
  })

  it('ne prend pas une horloge en avance pour une absence', () => {
    const demain = new Date(maintenant.getTime() + 86_400_000)
    expect(repriseApresAbsence(demain, maintenant)).toBe(false)
  })
})

describe('ce que l’écran propose', () => {
  // Un lundi : le bilan de `2026-W35` est ouvert.
  const maintenant = le(2026, 8, 31)
  const hier = new Date(maintenant.getTime() - 86_400_000)
  const loin = new Date(maintenant.getTime() - 30 * 86_400_000)

  const contexte = {
    maintenant,
    derniereActivite: hier,
    semainesFaites: [] as string[],
    rappelBilan: true,
    rappelAbsence: true,
  }

  it('propose le bilan de la semaine ouverte', () => {
    expect(invitationDouce(contexte)).toEqual({ forme: 'bilan', semaine: '2026-W35' })
  })

  it('ne repose pas une question déjà répondue', () => {
    expect(invitationDouce({ ...contexte, semainesFaites: ['2026-W35'] })).toEqual({ forme: 'aucune' })
    // Un bilan posé pour une AUTRE semaine ne dispense pas de celui-ci.
    expect(invitationDouce({ ...contexte, semainesFaites: ['2026-W34'] })).toEqual({ forme: 'bilan', semaine: '2026-W35' })
  })

  it('accueille avant de demander quoi que ce soit', () => {
    // La collision : après un mois d'absence, les deux conditions sont vraies
    // en même temps. Deux messages empilés au retour, c'est le moment précis où
    // « aucune urgence fabriquée » se briserait — le bilan cède.
    expect(invitationDouce({ ...contexte, derniereActivite: loin })).toEqual({ forme: 'reprise' })
  })

  it('respecte les deux interrupteurs, séparément', () => {
    // Le rappel de bilan éteint ne coupe pas le mot d'accueil, et l'inverse est
    // vrai aussi : ce sont deux préférences, pas deux noms pour la même.
    expect(invitationDouce({ ...contexte, derniereActivite: loin, rappelAbsence: false }))
      .toEqual({ forme: 'bilan', semaine: '2026-W35' })
    expect(invitationDouce({ ...contexte, rappelBilan: false })).toEqual({ forme: 'aucune' })
    expect(invitationDouce({ ...contexte, derniereActivite: loin, rappelBilan: false }))
      .toEqual({ forme: 'reprise' })
    expect(invitationDouce({ ...contexte, derniereActivite: loin, rappelBilan: false, rappelAbsence: false }))
      .toEqual({ forme: 'aucune' })
  })
})

describe('le vocabulaire', () => {
  it('n’est pas une échelle : cinq réponses closes, aucun compteur', () => {
    expect([...ETATS_DE_SEMAINE]).toEqual(['paisible', 'dense', 'rude', 'ailleurs', 'incertain'])
  })

  it('n’expose aucune fonction qui compte des semaines', async () => {
    // La garde contre « tu as manqué 3 semaines » n'est pas une relecture de
    // texte, c'est l'absence du nombre : si personne ne sait le calculer,
    // aucun écran ne peut l'afficher. Ce test rougit le jour où quelqu'un
    // ajoute une série, un compteur ou un écart en jours à ce module.
    const module = await import('./bilan')
    expect(Object.keys(module).sort()).toEqual([
      'ABSENCE_SEUIL_JOURS',
      'ETATS_DE_SEMAINE',
      'cleDeSemaine',
      'invitationDouce',
      'repriseApresAbsence',
      'semaineDuBilan',
    ])
  })
})
