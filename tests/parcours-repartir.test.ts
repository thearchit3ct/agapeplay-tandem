/**
 * La complétude du parcours « Repartir avec Jésus », vérifiée sans base.
 *
 * Le contenu est réparti sur deux migrations — les trois premières séances
 * datent du 04/08, les vingt-sept autres du 26/08 — et rien, jusqu'ici, ne
 * disait qu'elles formaient un tout. Un jour manquant ne casse aucune
 * contrainte SQL : `content_sessions` n'exige que l'unicité de (parcours,
 * jour). Le parcours s'arrêterait simplement au milieu, en production, sans
 * qu'une seule requête échoue.
 *
 * Ce fichier lit donc les migrations plutôt que la base : il tourne sur
 * `npm test`, sans Docker, et il échoue avant qu'on ait poussé quoi que ce
 * soit. Il ne vérifie pas l'exactitude des citations — cela se fait aux
 * sources, hors ligne, et la migration du 26/08 documente la passe.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations')

const CHAMPS = [
  'id', 'journey_id', 'day', 'title_fr', 'title_en', 'theme_fr', 'theme_en',
  'duration', 'verse_fr', 'verse_en', 'prompt_fr', 'prompt_en', 'action_fr', 'action_en',
] as const

type Seance = Record<(typeof CHAMPS)[number], string>

/** Découpe une liste de valeurs SQL en respectant les chaînes et les `''`. */
function valeurs(ligne: string): string[] {
  const sortie: string[] = []
  let courant = ''
  let dansChaine = false
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i]
    if (dansChaine) {
      if (c === "'" && ligne[i + 1] === "'") { courant += "'"; i += 1 }
      else if (c === "'") dansChaine = false
      else courant += c
    } else if (c === "'") dansChaine = true
    else if (c === ',') { sortie.push(courant.trim()); courant = '' }
    else courant += c
  }
  sortie.push(courant.trim())
  return sortie
}

const sql = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith('.sql'))
  .sort()
  .map((nom) => readFileSync(join(DOSSIER, nom), 'utf8'))
  .join('\n')

// Les lignes de commentaire ne sont pas des données : la migration du 26/08 en
// porte soixante-dix, dont des citations entre guillemets.
const donnees = sql
  .split('\n')
  .filter((ligne) => !ligne.trimStart().startsWith('--'))
  .join('\n')

const seances: Seance[] = []
for (const brut of donnees.matchAll(/\('repartir-\d+',\s*'repartir-avec-jesus',([\s\S]*?)\)(?=,\n|\n*on conflict)/g)) {
  const ligne = brut[0].slice(1, -1)
  const parts = valeurs(ligne)
  expect(parts, `séance mal formée : ${parts[0]}`).toHaveLength(CHAMPS.length)
  seances.push(Object.fromEntries(CHAMPS.map((champ, i) => [champ, parts[i]])) as Seance)
}

// Les retouches `update ... set verse_en` s'appliquent par-dessus : le test
// doit voir l'état final, pas l'état inséré en août.
for (const [, texte, id] of donnees.matchAll(
  /update public\.content_sessions\s+set verse_en = '((?:[^']|'')*)'\s+where id = '([^']+)'/g,
)) {
  const cible = seances.find((s) => s.id === id)
  if (cible) cible.verse_en = texte.replace(/''/g, "'")
}

const semaine = (jour: number) => Math.ceil(jour / 5)

describe('parcours « Repartir avec Jésus »', () => {
  it('porte trente séances, une par jour de 1 à 30', () => {
    const jours = seances.map((s) => Number(s.day)).sort((a, b) => a - b)
    expect(jours, 'un jour manquant coupe le parcours en silence')
      .toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
  })

  it('les range en six semaines de cinq séances', () => {
    const parSemaine = new Map<number, number>()
    for (const s of seances) {
      const n = semaine(Number(s.day))
      parSemaine.set(n, (parSemaine.get(n) ?? 0) + 1)
    }
    expect([...parSemaine.entries()].sort((a, b) => a[0] - b[0]))
      .toEqual([[1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5]])
  })

  it('ne laisse aucun champ vide', () => {
    const trous: string[] = []
    for (const s of seances) {
      for (const champ of CHAMPS) {
        if (!s[champ] || s[champ].trim() === '') trous.push(`${s.id}.${champ}`)
      }
    }
    expect(trous, 'la colonne est `not null`, mais une chaîne vide passe').toEqual([])
  })

  it('tient chaque séance entre cinq et quinze minutes', () => {
    // Le doc 07 promet « 10 min par jour » sur la page du parcours ; une séance
    // de vingt minutes rendrait la promesse fausse sans rien casser.
    const hors = seances
      .map((s) => ({ id: s.id, duree: Number(s.duration) }))
      .filter(({ duree }) => !Number.isInteger(duree) || duree < 5 || duree > 15)
    expect(hors).toEqual([])
  })

  it('donne une référence complète à chaque citation, dans les deux langues', () => {
    // « Livre chiffre:chiffre » — sans elle, personne ne peut vérifier le texte,
    // et c'est la première chose que fera un relecteur biblique.
    const reference = /\p{L}\s\d+:\d+/u
    const sansReference: string[] = []
    for (const s of seances) {
      if (!reference.test(s.verse_fr)) sansReference.push(`${s.id}.verse_fr`)
      if (!reference.test(s.verse_en)) sansReference.push(`${s.id}.verse_en`)
    }
    expect(sansReference).toEqual([])
  })

  it('fait de la cinquième séance de chaque semaine la discussion du binôme', () => {
    // Le doc 07 demande une discussion hebdomadaire ; c'est sa place dans le
    // schéma à trente jours, et l'action de ces séances envoie vers la
    // conversation du tandem.
    const discussions = seances
      .filter((s) => s.theme_fr === 'La discussion de la semaine')
      .map((s) => Number(s.day))
      .sort((a, b) => a - b)
    expect(discussions).toEqual([5, 10, 15, 20, 25, 30])
  })

  it('ne garde aucune citation anglaise hors du domaine public', () => {
    // Deux `verse_en` de la migration du 04/08 reprenaient la New International
    // Version mot pour mot. Elles sont retouchées vers la World English Bible ;
    // ce test empêche qu'elles reviennent par un copier-coller.
    const niv = [
      'all you who are weary and burdened',
      'Carry each other’s burdens',
    ]
    const fautives = seances.filter((s) => niv.some((extrait) => s.verse_en.includes(extrait)))
    expect(fautives.map((s) => s.id)).toEqual([])
  })
})
