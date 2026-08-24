/**
 * Le partage explicite du journal — issue #11, et la porte qui vient d'être
 * ouverte.
 *
 * `journal-prive.test.ts` prouve qu'aucune politique n'ouvre `journal_entries`
 * à autrui. Cette phrase reste vraie mot pour mot après
 * `20260825160000_partage_du_journal.sql` — c'est la raison même pour laquelle
 * le destinataire lit par une fonction `security definer` et non par une
 * seconde politique SELECT. Mais la surface d'attaque, elle, a changé de
 * nature : elle n'est plus dans un `using`, elle est dans le `where` de
 * `journal_partage_avec_moi()`. Les tests doivent suivre le déplacement, sinon
 * « le mentor n'a aucune porte » resterait vrai sur une affirmation qui ne
 * couvre plus tout ce qu'il y a à couvrir.
 *
 * Ce fichier mesure donc les deux chemins à la fois, et sur le même décor :
 * ce que la fonction rend, et ce que la table continue de refuser.
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif dans le
 * même décor — sans quoi zéro ligne ne veut rien dire — et l'on mesure des
 * faits, jamais la seule absence d'erreur : un DELETE refusé par un `using` ne
 * lève pas, il ne touche aucune ligne.
 */
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  commeAnonyme,
  commeAuthentifieSansIdentite,
  commeService,
  commeUtilisateur,
  creerUtilisateur,
  type Utilisateur,
} from './harnais'

type Decor = {
  /** L'autrice du journal. */
  claire: Utilisateur
  /** Son binôme, destinataire du partage. */
  elodie: Utilisateur
  /** Mentor de Claire : rattaché, vérifié, affectation active. */
  mentor: Utilisateur
  /** Aucun lien avec personne : témoin que rien ne déborde. */
  inconnu: Utilisateur
  tandemId: string
  /** L'entrée partagée à Élodie. */
  entreePartagee: string
  /** Une entrée que Claire garde pour elle. */
  entreeGardee: string
}

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Deux comptes appariés, une entrée partagée, une entrée gardée — et un mentor
 * réellement rattaché à Claire.
 *
 * Le mentor n'est pas décoratif : tester l'isolement sans lui reviendrait à
 * vérifier qu'un inconnu ne lit pas, pas qu'un mentor légitime ne lit pas.
 * C'est le décor de `journal-prive.test.ts`, augmenté d'un partage.
 *
 * Posé hors transaction (`commeService`) pour survivre aux transactions —
 * annulées — des appels qui suivent.
 */
const monterDecor = async (statutTandem = 'active'): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const claire = await creerUtilisateur(client, `claire-${suffixe}@test.local`)
    const elodie = await creerUtilisateur(client, `elodie-${suffixe}@test.local`)
    const mentor = await creerUtilisateur(client, `mentor-${suffixe}@test.local`)
    const inconnu = await creerUtilisateur(client, `inconnu-${suffixe}@test.local`)

    // Un tandem bloqué doit dire qui a bloqué, sinon il est « gelé » et ce
    // n'est pas le cas qu'on veut mesurer ici. C'est Élodie qui bloque : le
    // partage de Claire se referme donc pour la personne qui a posé le
    // blocage, ce qui est précisément le contraste avec les messages.
    const tandem = await client.query<{ id: string }>(
      `insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by)
       values ($1, $2, $3, case when $3 = 'blocked' then $2::uuid else null end)
       returning id`,
      [claire.id, elodie.id, statutTandem],
    )
    const tandemId = tandem.rows[0].id

    const entrees = await client.query<{ id: string }>(
      `insert into public.journal_entries (user_id, text) values
         ($1, 'Ce que je choisis de lui dire.'),
         ($1, 'Ce que je n’ai dit à personne.')
       returning id`,
      [claire.id],
    )
    const [entreePartagee, entreeGardee] = entrees.rows.map((r) => r.id)

    // Posé hors RLS : sur un tandem bloqué ou terminé, la politique
    // d'insertion refuserait — et c'est bien la lecture qu'on veut mesurer là,
    // pas l'octroi.
    await client.query(
      'insert into public.journal_shares (entry_id, tandem_id, shared_by) values ($1, $2, $3)',
      [entreePartagee, tandemId, claire.id],
    )

    // Le mentor de Claire, dans les mêmes conditions que
    // `journal-prive.test.ts` : celui qui aurait le plus de raisons de croire
    // qu'il a le droit de lire.
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

    return { claire, elodie, mentor, inconnu, tandemId, entreePartagee, entreeGardee }
  })
}

type LignePartagee = { entree_id: string; texte: string; humeur: string }

const cequonMaPartage = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query<LignePartagee>('select * from public.journal_partage_avec_moi()')
    return rows
  })

const lireJournalDe = (lecteur: Utilisateur, auteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query('select id, text from public.journal_entries where user_id = $1', [auteur.id])
    return rows
  })

describe('ce que le destinataire lit', () => {
  it('TÉMOIN — le binôme lit l’entrée qu’on lui a explicitement partagée', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    const lignes = await cequonMaPartage(elodie)

    expect(lignes).toHaveLength(1)
    expect(lignes[0].entree_id).toBe(entreePartagee)
    expect(lignes[0].texte).toBe('Ce que je choisis de lui dire.')
    // Sans ce témoin, tous les négatifs ci-dessous seraient ininterprétables :
    // zéro ligne pourrait signifier « la garde a discriminé » aussi bien que
    // « la fonction ne rend jamais rien ».
    expect(await cequonMaPartage(claire)).toEqual([])
  })

  it('ne rend que l’entrée partagée, jamais le reste du journal', async () => {
    const { elodie, entreeGardee } = await monterDecor()

    const lignes = await cequonMaPartage(elodie)

    expect(lignes.map((l) => l.entree_id)).not.toContain(entreeGardee)
    expect(lignes.map((l) => l.texte)).not.toContain('Ce que je n’ai dit à personne.')
  })

  it('laisse `journal_entries` fermée : le binôme lit le partage, pas la table', async () => {
    const { claire, elodie } = await monterDecor()

    // La distinction est tout le chantier. Le partage passe par la fonction ;
    // la table, elle, n'a pas bougé d'un pouce et n'a gagné aucune politique.
    expect(await cequonMaPartage(elodie)).toHaveLength(1)
    expect(await lireJournalDe(elodie, claire)).toEqual([])
    expect(await lireJournalDe(claire, claire)).toHaveLength(2)
  })

  it('le mentor, pourtant affecté et vérifié, ne tire rien de la fonction', async () => {
    const { claire, mentor } = await monterDecor()

    // Le « mentor compris » de l'ADR-002, sur la porte nouvellement ouverte.
    // Il n'a pas de tandem avec Claire, et le partage vise un tandem : il n'y a
    // aucune valeur de `tandem_id` qui puisse le désigner.
    expect(await cequonMaPartage(mentor)).toEqual([])
    expect(await lireJournalDe(mentor, claire)).toEqual([])
  })

  it('un compte sans lien ne tire rien non plus', async () => {
    const { inconnu } = await monterDecor()

    expect(await cequonMaPartage(inconnu)).toEqual([])
  })

  it('l’autrice ne se voit pas rendre ses propres entrées comme si on les lui avait partagées', async () => {
    const { claire } = await monterDecor()

    // Claire est participante de son propre tandem : sans le conjonct
    // `s.shared_by <> auth.uid()`, la fonction lui rendrait ses mots, et le
    // panneau « ce que ton binôme t’a partagé » les lui montrerait comme
    // venant d'Élodie. Un écran qui ment, pas une fuite — le dépôt refuse les
    // deux.
    expect(await cequonMaPartage(claire)).toEqual([])
  })

  it('sans identité, la fonction ne rend rien — et un visiteur ne peut pas l’appeler', async () => {
    await monterDecor()

    const sansIdentite = await commeAuthentifieSansIdentite(async (client) => {
      const { rows } = await client.query('select * from public.journal_partage_avec_moi()')
      return rows
    })
    expect(sansIdentite).toEqual([])

    await expect(
      commeAnonyme((client) => client.query('select * from public.journal_partage_avec_moi()')),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('le partage meurt avec la relation', () => {
  it('un tandem bloqué referme le partage — pour celle qui a bloqué aussi', async () => {
    const { claire, elodie, tandemId } = await monterDecor('blocked')

    // C'est la décision de conception du chantier, et elle est l'inverse de
    // `messages_select_member` : le témoin ci-dessous mesure les deux dans le
    // même décor, sur la même personne. Élodie a bloqué, elle garde la
    // conversation — elle en a besoin pour signaler — et perd le journal.
    await commeService(async (client) => {
      await client.query(
        "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'Un message d’avant le blocage.')",
        [tandemId, claire.id],
      )
    })

    const messages = await commeUtilisateur(elodie, async (client) => {
      const { rows } = await client.query('select id from public.tandem_messages where tandem_id = $1', [tandemId])
      return rows
    })

    expect(messages).toHaveLength(1)
    expect(await cequonMaPartage(elodie)).toEqual([])
  })

  it('une relation terminée referme le partage', async () => {
    const { elodie } = await monterDecor('ended')

    expect(await cequonMaPartage(elodie)).toEqual([])
  })

  it('mais la ligne de partage survit au blocage : un blocage se lève', async () => {
    const { claire, tandemId } = await monterDecor('blocked')

    // Effacer les partages au blocage détruirait en silence les choix de
    // l'autrice sur un changement de statut réversible. La ligne reste, la
    // lecture se referme, et l'écran le dit avec des mots.
    const lignes = await commeUtilisateur(claire, async (client) => {
      const { rows } = await client.query('select entry_id from public.journal_shares where tandem_id = $1', [tandemId])
      return rows
    })

    expect(lignes).toHaveLength(1)
  })
})

describe('qui peut poser un partage', () => {
  const partager = (qui: Utilisateur, entree: string, tandem: string, auNomDe = qui) =>
    commeUtilisateur(qui, (client) =>
      client.query('insert into public.journal_shares (entry_id, tandem_id, shared_by) values ($1, $2, $3)', [
        entree,
        tandem,
        auNomDe.id,
      ]),
    )

  it('TÉMOIN — l’autrice partage sa propre entrée sur son tandem vivant', async () => {
    const { claire, elodie, tandemId, entreeGardee } = await monterDecor()

    await partager(claire, entreeGardee, tandemId)

    // La transaction du témoin est annulée au retour ; on relit donc dans une
    // transaction où le partage n'existe plus. Le fait à mesurer ici est que
    // l'insertion n'a pas levé — et le témoin de lecture, lui, est plus haut.
    expect(await cequonMaPartage(elodie)).toHaveLength(1)
  })

  it('personne ne partage l’entrée d’un autre', async () => {
    const { elodie, tandemId, entreeGardee } = await monterDecor()

    // `entry_id` seul ne dit rien de la propriété : un identifiant d'entrée
    // circule, il figure dans l'export de son autrice. C'est le `exists` sur
    // `journal_entries` qui refuse, doublé par la RLS de cette table qui rend
    // la ligne invisible à Élodie.
    await expect(partager(elodie, entreeGardee, tandemId)).rejects.toThrow(/row-level security/i)
  })

  it('personne ne partage au nom d’un autre', async () => {
    const { claire, elodie, tandemId, entreeGardee } = await monterDecor()

    await expect(partager(elodie, entreeGardee, tandemId, claire)).rejects.toThrow(/row-level security/i)
  })

  it('on ne partage pas sur le tandem de quelqu’un d’autre', async () => {
    const { claire, entreeGardee } = await monterDecor()
    const autre = await monterDecor()

    await expect(partager(claire, entreeGardee, autre.tandemId)).rejects.toThrow(/row-level security/i)
  })

  it('on ne partage pas sur une relation bloquée ni terminée', async () => {
    const bloque = await monterDecor('blocked')
    const termine = await monterDecor('ended')

    await expect(partager(bloque.claire, bloque.entreeGardee, bloque.tandemId)).rejects.toThrow(/row-level security/i)
    await expect(partager(termine.claire, termine.entreeGardee, termine.tandemId)).rejects.toThrow(/row-level security/i)
  })

  it('le destinataire ne lit pas la table des partages', async () => {
    const { claire, elodie, tandemId } = await monterDecor()

    // Un SELECT ouvert au tandem lui livrerait les `entry_id` de partages
    // refermés par un blocage : la liste de ce qu'on lui a repris. Il n'a
    // besoin que de ce que la fonction rend.
    const vuParElodie = await commeUtilisateur(elodie, async (client) => {
      const { rows } = await client.query('select entry_id from public.journal_shares where tandem_id = $1', [tandemId])
      return rows
    })
    const vuParClaire = await commeUtilisateur(claire, async (client) => {
      const { rows } = await client.query('select entry_id from public.journal_shares where tandem_id = $1', [tandemId])
      return rows
    })

    expect(vuParElodie).toEqual([])
    expect(vuParClaire).toHaveLength(1)
  })
})

describe('retirer un partage, effacer une entrée', () => {
  it('l’autrice retire son partage, et le binôme cesse de lire', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    const { effacees, resteALire } = await commeUtilisateur(claire, async (client) => {
      const retrait = await client.query('delete from public.journal_shares where entry_id = $1', [entreePartagee])
      // Dans la même transaction, sous l'identité d'Élodie : c'est le seul
      // moyen de mesurer l'effet du retrait, puisque la transaction sera
      // annulée et qu'il n'y a pas d'« après ».
      const claims = JSON.stringify({ sub: elodie.id, email: elodie.email, role: 'authenticated' })
      await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
      const { rows } = await client.query('select * from public.journal_partage_avec_moi()')
      return { effacees: retrait.rowCount, resteALire: rows }
    })

    expect(effacees).toBe(1)
    expect(resteALire).toEqual([])
  })

  it('le destinataire ne retire pas le partage — et rien ne le lui dit', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    const effacees = await commeUtilisateur(elodie, async (client) => {
      const retrait = await client.query('delete from public.journal_shares where entry_id = $1', [entreePartagee])
      return retrait.rowCount
    })

    // Zéro ligne, aucune erreur : `journal_shares_select_author` masque la
    // ligne au DELETE. C'est ce silence-là que l'écran doit lire, et c'est la
    // raison pour laquelle le web compte les lignes rendues.
    expect(effacees).toBe(0)
    expect(await cequonMaPartage(elodie)).toHaveLength(1)
    expect(await lireJournalDe(claire, claire)).toHaveLength(2)
  })

  it('effacer une entrée emporte son partage', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    const { effacees, resteALire, partagesRestants } = await commeUtilisateur(claire, async (client) => {
      const suppression = await client.query('delete from public.journal_entries where id = $1', [entreePartagee])
      const partages = await client.query('select entry_id from public.journal_shares where entry_id = $1', [entreePartagee])
      const claims = JSON.stringify({ sub: elodie.id, email: elodie.email, role: 'authenticated' })
      await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
      const { rows } = await client.query('select * from public.journal_partage_avec_moi()')
      return { effacees: suppression.rowCount, resteALire: rows, partagesRestants: partages.rows }
    })

    expect(effacees).toBe(1)
    expect(partagesRestants).toEqual([])
    expect(resteALire).toEqual([])
  })

  it('personne n’efface l’entrée d’un autre, partagée ou non', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    const effacees = await commeUtilisateur(elodie, async (client) => {
      const suppression = await client.query('delete from public.journal_entries where id = $1', [entreePartagee])
      return suppression.rowCount
    })

    // Un partage donne à lire, jamais à effacer. `journal_delete_own` n'a pas
    // bougé, et `journal_select_own` masque la ligne à l'ordre de suppression.
    expect(effacees).toBe(0)
    expect(await lireJournalDe(claire, claire)).toHaveLength(2)
  })
})

describe('la suppression de compte emporte les partages', () => {
  it('le journal part, les fenêtres qu’il avait ouvertes partent avec lui', async () => {
    const { claire, elodie, entreePartagee } = await monterDecor()

    // Témoin « avant » : sans lui, un décor cassé rendrait ce test vert sans
    // que la fonction ait rien fait.
    const avant = await commeService(async (client) => {
      const { rows } = await client.query<{ n: string }>('select count(*) as n from public.journal_shares where entry_id = $1', [entreePartagee])
      return Number(rows[0].n)
    })
    expect(avant).toBe(1)

    const mesures = await commeUtilisateur(claire, async (client: Client) => {
      await client.query('select public.supprimer_mon_compte()')
      // Hors RLS pour mesurer des faits : sous une identité, zéro ligne serait
      // indiscernable d'une ligne simplement masquée.
      await client.query('reset role')
      const partages = await client.query<{ n: string }>('select count(*) as n from public.journal_shares where entry_id = $1', [entreePartagee])
      const entrees = await client.query<{ n: string }>('select count(*) as n from public.journal_entries where user_id = $1', [claire.id])

      const claims = JSON.stringify({ sub: elodie.id, email: elodie.email, role: 'authenticated' })
      await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
      await client.query('set local role authenticated')
      const { rows } = await client.query('select * from public.journal_partage_avec_moi()')
      await client.query('reset role')

      return { partages: Number(partages.rows[0].n), entrees: Number(entrees.rows[0].n), lusParElodie: rows }
    })

    // La cascade `entry_id → journal_entries on delete cascade` est le
    // mécanisme ; ce test est ce qui en fait une promesse. Une clé étrangère
    // qu'on passerait un jour en `on delete set null` la romprait en silence.
    expect(mesures).toEqual({ partages: 0, entrees: 0, lusParElodie: [] })
  })
})
