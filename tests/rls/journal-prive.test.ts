/**
 * ADR-002, règle 1 : le journal est privé. Personne d'autre que son auteur ne
 * le lit — mentor compris.
 *
 * Ce que disent réellement les politiques (migration 001) : `journal_select_own`
 * n'autorise la lecture que si `auth.uid() = user_id`, et aucune autre
 * politique n'existe sur `journal_entries`. Le mentor n'a donc aucune porte —
 * non pas parce qu'on la lui ferme, mais parce qu'on ne lui en a jamais ouvert.
 * C'est ce qu'on vérifie ici, avec un mentor réellement rattaché.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeAnonyme, commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

let claire: Utilisateur
let elodie: Utilisateur
let mentor: Utilisateur

beforeAll(async () => {
  await commeService(async (client) => {
    claire = await creerUtilisateur(client, `claire-${Date.now()}@test.local`)
    elodie = await creerUtilisateur(client, `elodie-${Date.now()}@test.local`)
    mentor = await creerUtilisateur(client, `mentor-${Date.now()}@test.local`)

    await client.query(
      "insert into public.journal_entries (user_id, text, mood) values ($1, 'Ce que je n’ai dit à personne.', 'Présent')",
      [claire.id],
    )

    // Le mentor est réellement rattaché à Claire : une église, un groupe, une
    // affectation active. Tester l'isolement sans ce décor serait beaucoup plus
    // faible — on vérifierait qu'un inconnu ne lit pas, pas qu'un mentor
    // légitime ne lit pas.
    const eglise = await client.query<{ id: string }>(
      "insert into public.churches (name, status) values ('Église test', 'active') returning id",
    )
    await client.query(
      "insert into public.church_members (church_id, user_id, role, status) values ($1, $2, 'mentor', 'active'), ($1, $3, 'member', 'active')",
      [eglise.rows[0].id, mentor.id, claire.id],
    )
    await client.query(
      "insert into public.mentor_assignments (church_id, mentor_id, participant_id, status) values ($1, $2, $3, 'active')",
      [eglise.rows[0].id, mentor.id, claire.id],
    )
    await client.query(
      "insert into public.mentor_profiles (user_id, verification_status, training_status) values ($1, 'verified', 'completed')",
      [mentor.id],
    )
  })
})

const lireJournalDe = (lecteur: Utilisateur, auteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query('select id, text from public.journal_entries where user_id = $1', [auteur.id])
    return rows
  })

describe('le journal est privé', () => {
  it('TÉMOIN — son auteur lit bien son propre journal', async () => {
    // Sans ce témoin, tous les tests négatifs ci-dessous seraient
    // ininterprétables : zéro ligne pourrait signifier « la politique a
    // discriminé » aussi bien que « le harnais n'a authentifié personne ».
    const lignes = await lireJournalDe(claire, claire)

    expect(lignes).toHaveLength(1)
    expect(lignes[0].text).toBe('Ce que je n’ai dit à personne.')
  })

  it('son tandem ne le lit pas', async () => {
    expect(await lireJournalDe(elodie, claire)).toEqual([])
  })

  it('son mentor, pourtant affecté et vérifié, ne le lit pas', async () => {
    // C'est le « mentor compris » de l'ADR-002.
    expect(await lireJournalDe(mentor, claire)).toEqual([])
  })

  it('un visiteur non connecté ne le lit pas — il n’a même pas le droit sur la table', async () => {
    await expect(
      commeAnonyme((client) => client.query('select id from public.journal_entries')),
    ).rejects.toThrow(/permission denied/i)
  })

  it('personne ne peut écrire dans le journal d’un autre', async () => {
    await expect(
      commeUtilisateur(elodie, (client) =>
        client.query("insert into public.journal_entries (user_id, text) values ($1, 'écrit par quelqu’un d’autre')", [claire.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('personne ne peut effacer ni réécrire le journal d’un autre', async () => {
    const { effacees, modifiees } = await commeUtilisateur(elodie, async (client) => {
      const suppression = await client.query('delete from public.journal_entries where user_id = $1', [claire.id])
      const modification = await client.query("update public.journal_entries set text = 'réécrit' where user_id = $1", [claire.id])
      return { effacees: suppression.rowCount, modifiees: modification.rowCount }
    })

    // Une politique de lecture restrictive suffit à rendre ces ordres
    // inopérants : ils ne voient aucune ligne. Rien n'est levé, rien n'est
    // touché — c'est le silence qu'il faut vérifier.
    expect({ effacees, modifiees }).toEqual({ effacees: 0, modifiees: 0 })
    expect(await lireJournalDe(claire, claire)).toHaveLength(1)
  })
})
