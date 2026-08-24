/**
 * Ce que ces tests protègent : qu'un export incomplet ne parte jamais pour un
 * export complet.
 *
 * Quelqu'un qui télécharge ses données le fait en général une seule fois, au
 * moment de partir. Un fichier amputé de sa section « journal » est un fichier
 * bien formé, plus court de quelques lignes, et rien ne le distingue à l'œil.
 * C'est le mode d'échec qu'on éprouve ici — pas le chemin heureux, qui ne
 * risque rien.
 */
import { describe, expect, it } from 'vitest'
import { SECTIONS, nomDuFichierExport, rassemblerExport, type Reponse, type SectionExport } from './export'

const COMPTE = { id: 'compte-a', email: 'anne@test.local' }
const LE_JOUR = new Date('2026-08-24T10:00:00.000Z')

/** Un lecteur qui rend une réponse par section, vide par défaut. */
const lecteur = (reponses: Record<string, Reponse> = {}) => {
  const vus: string[] = []
  const lire = async (section: SectionExport) => {
    vus.push(`${section.clef}:${section.colonne}`)
    return reponses[`${section.clef}:${section.colonne}`] ?? reponses[section.clef] ?? { data: [], error: null }
  }
  return { lire, vus }
}

describe('assemblage de l’export', () => {
  it('rend une section par lecture déclarée, et nomme le compte', async () => {
    const { lire, vus } = lecteur({ journal: { data: [{ id: 'j1', text: 'Ce que j’ai gardé.' }], error: null } })

    const resultat = await rassemblerExport(lire, COMPTE, LE_JOUR)

    expect(Object.keys(resultat.donnees).sort()).toEqual([...new Set(SECTIONS.map((s) => s.clef))].sort())
    expect(resultat.donnees.journal).toEqual([{ id: 'j1', text: 'Ce que j’ai gardé.' }])
    expect(resultat.compte).toEqual(COMPTE)
    expect(resultat.genere_le).toBe('2026-08-24T10:00:00.000Z')
    // Les deux côtés du tandem sont lus : sans la seconde lecture, la moitié
    // des relations manquerait selon la place occupée dans la ligne.
    expect(vus).toContain('tandems:participant_a_id')
    expect(vus).toContain('tandems:participant_b_id')
  })

  it('réunit les tandems des deux colonnes dans une seule section', async () => {
    const { lire } = lecteur({
      'tandems:participant_a_id': { data: [{ id: 't1' }], error: null },
      'tandems:participant_b_id': { data: [{ id: 't2' }], error: null },
    })

    const resultat = await rassemblerExport(lire, COMPTE, LE_JOUR)
    expect(resultat.donnees.tandems).toEqual([{ id: 't1' }, { id: 't2' }])
  })

  it('n’exporte que les messages envoyés, jamais la conversation entière', async () => {
    // La section est filtrée sur `sender_id` : les mots du binôme ne sont pas
    // les données personnelles de la personne qui exporte.
    const section = SECTIONS.find((s) => s.clef === 'messages_envoyes')
    expect(section?.colonne).toBe('sender_id')
  })
})

describe('ce qui doit interrompre l’export', () => {
  it('lève quand une lecture échoue, plutôt que de rendre un fichier amputé', async () => {
    const { lire } = lecteur({ journal: { data: null, error: { message: 'réseau indisponible' } } })

    await expect(rassemblerExport(lire, COMPTE, LE_JOUR)).rejects.toThrow(/journal/)
  })

  it('lève quand une lecture rend « rien », pas même une liste vide', async () => {
    // `data: null` sans erreur n'arrive pas en fonctionnement normal. Le
    // traiter comme une section vide est précisément la façon dont un export
    // se vide en silence.
    const { lire } = lecteur({ progression: { data: null, error: null } })

    await expect(rassemblerExport(lire, COMPTE, LE_JOUR)).rejects.toThrow(/progression/)
  })

  it('TÉMOIN — les mêmes sections vides, mais rendues normalement, passent', async () => {
    // Sans ce témoin, les deux tests ci-dessus seraient ininterprétables : une
    // fonction qui lèverait toujours les passerait aussi.
    const { lire } = lecteur()
    await expect(rassemblerExport(lire, COMPTE, LE_JOUR)).resolves.toMatchObject({ donnees: { journal: [] } })
  })
})

describe('ce que l’export dit de ses propres trous', () => {
  it('signale les messages devenus illisibles après un blocage subi', async () => {
    const { lire } = lecteur({
      'tandems:participant_a_id': { data: [{ id: 't1', status: 'blocked', blocked_by: 'quelqu-un-d-autre' }], error: null },
    })

    const resultat = await rassemblerExport(lire, COMPTE, LE_JOUR)
    expect(resultat.limites).toHaveLength(1)
    expect(resultat.limites[0]).toMatch(/bloquée/)
  })

  it('compte la relation gelée sans affirmer que quelqu’un a bloqué', async () => {
    // `blocked_by` NULL est le cas des lignes antérieures à la migration
    // `20260806012728`, où le schéma dit ne pas savoir qui a bloqué. Les
    // messages sont bien illisibles — la limite est réelle — mais la phrase
    // n'a personne à mettre derrière.
    const { lire } = lecteur({
      'tandems:participant_a_id': { data: [{ id: 't1', status: 'blocked', blocked_by: null }], error: null },
    })

    const resultat = await rassemblerExport(lire, COMPTE, LE_JOUR)
    expect(resultat.limites).toHaveLength(1)
    expect(resultat.limites[0]).not.toMatch(/quelqu/)
  })

  it('ne signale rien quand c’est soi qui a bloqué — la lecture reste ouverte', async () => {
    // `messages_select_member` garde l'historique lisible pour celui qui a
    // bloqué : il n'y a alors aucun trou à annoncer, et l'annoncer serait une
    // inquiétude inventée.
    const { lire } = lecteur({
      'tandems:participant_a_id': { data: [{ id: 't1', status: 'blocked', blocked_by: COMPTE.id }], error: null },
    })

    const resultat = await rassemblerExport(lire, COMPTE, LE_JOUR)
    expect(resultat.limites).toEqual([])
  })
})

describe('nom du fichier', () => {
  it('porte la date du jour', () => {
    expect(nomDuFichierExport(LE_JOUR)).toBe('agapeplay-tandem-mes-donnees-2026-08-24.json')
  })
})
