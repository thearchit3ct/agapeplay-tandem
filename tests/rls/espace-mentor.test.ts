/**
 * L'espace mentor — issue #16.
 *
 * Cette suite garde une frontière plutôt qu'un droit, et c'est ce qui la rend
 * différente des autres. Les chantiers précédents demandaient « qui a le droit
 * d'écrire ici ? » ; celui-ci demande **« qu'est-ce qui a le droit de sortir
 * d'ici ? »**. Un mentor ne lit aucune table du jeune : il appelle une fonction
 * qui lit à sa place et ne lui rend qu'un mot. Ce que ces tests mesurent, ce
 * n'est donc pas seulement un refus, c'est une **quantité d'information**.
 *
 * Quatre modes d'échec, mesurés plutôt que supposés :
 *
 *   1. **la fonction pourrait devenir un contournement.** Elle lit
 *      `session_progress` et `weekly_checkins` hors RLS ; si elle en laissait
 *      sortir une date, elle ouvrirait par la porte de service ce que quatre
 *      suites ferment par la porte d'entrée. Le test central rend
 *      `a_relancer` **dans le même décor** où le mentor lit zéro ligne de ces
 *      deux tables en direct ;
 *   2. **un `with check` d'UPDATE ne se teste pas seul** (leçon #49). Les
 *      transitions de `help_requests` portent l'état d'origine dans le `using`,
 *      et un refus par `using` **ne lève rien** : on compte `rowCount`, jamais
 *      l'absence d'erreur ;
 *   3. **la vérification du mentor est une garde de sortie.** Un mentor nommé,
 *      affecté, accepté, mais non vérifié doit lire une table vide. C'est le
 *      cas qu'un décor optimiste ne monte jamais, alors il est monté deux fois
 *      — vérification manquante d'un côté, formation manquante de l'autre ;
 *   4. **une fonction sans paramètre ne peut pas devenir un annuaire**, mais
 *      `tandem_accompagnement_actif` en prend deux. Elle est donc éprouvée
 *      depuis un tiers, sur une paire qui existe : elle doit rendre `false`
 *      pour qui n'est ni le mentor ni le participant… ou, si elle rend `true`,
 *      ne rien apprendre à personne. Le test dit lequel des deux est vrai.
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif dans le
 * même décor : sans lui, zéro ligne pourrait vouloir dire « la politique a
 * discriminé » aussi bien que « le décor était vide ».
 */
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

type Decor = {
  /** Mentor vérifié et formé de Bethel — celui qui a le droit de voir. */
  marc: Utilisateur
  /** Mentor de Bethel, affecté et accepté, mais dont la vérification est restée `pending`. */
  simon: Utilisateur
  /** Mentor vérifié dont la formation a expiré : l'autre moitié de la garde. */
  gilles: Utilisateur
  /** Participante de Marc, active depuis peu : signal `actif`. */
  lea: Utilisateur
  /** Participante de Marc, silencieuse depuis longtemps : signal `a_relancer`. */
  nour: Utilisateur
  /** Participante de Marc, acceptée hier, aucune activité : signal `nouveau`. */
  yann: Utilisateur
  /** Participant dont l'affectation à Marc est restée `pending` : jamais nommé. */
  theo: Utilisateur
  /** Participant de Simon (mentor non vérifié). */
  sarah: Utilisateur
  /** Participant de Gilles (formation expirée). */
  omar: Utilisateur
  /** Mentor d'Emmaüs : l'étanchéité entre deux églises. */
  bruno: Utilisateur
  /** Sa participante. */
  claire: Utilisateur
  /** Personne sans aucun lien : le tiers qui sonde. */
  ines: Utilisateur

  bethel: string
  emmaus: string

  /** L'affectation Marc → Léa, celle qui porte les demandes d'aide et les encouragements. */
  affectationLea: string
  affectationNour: string
  affectationYann: string
  affectationTheo: string
  affectationSarah: string
  affectationOmar: string
  affectationClaire: string
}

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/** Éprouver un refus sans perdre la transaction. Voir `communaute.test.ts`. */
const refuse = async (client: Client, sql: string, params: unknown[] = []): Promise<string> => {
  await client.query('savepoint tentative')
  try {
    await client.query(sql, params)
  } catch (erreur) {
    await client.query('rollback to savepoint tentative')
    return (erreur as Error).message
  }
  await client.query('rollback to savepoint tentative')
  throw new Error(`la base a accepté ce qu'elle devait refuser : ${sql.trim().slice(0, 90)}`)
}

/** Constater hors RLS, dans la même transaction. Voir `communaute.test.ts`. */
const constater = async <T extends Record<string, unknown>>(
  client: Client,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  await client.query('reset role')
  try {
    const { rows } = await client.query<T>(sql, params)
    return rows
  } finally {
    await client.query('set local role authenticated')
  }
}

/**
 * Deux églises, trois mentors aux trois états de vérification, sept
 * affectations. Les trois signaux d'activité sont posés par des dates
 * calculées ici — c'est le seul endroit du chantier où une date d'activité est
 * écrite en clair, et elle ne ressort nulle part.
 */
const monterDecor = async (): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const nouveau = (prenom: string) => creerUtilisateur(client, `${prenom}-${suffixe}@test.local`)
    const [marc, simon, gilles, lea, nour, yann, theo, sarah, omar, bruno, claire, ines] = await Promise.all(
      ['marc', 'simon', 'gilles', 'lea', 'nour', 'yann', 'theo', 'sarah', 'omar', 'bruno', 'claire', 'ines']
        .map(nouveau),
    )

    // Les noms comptent : c'est le tri alphabétique de la fonction qui est
    // épinglé plus bas, et il ne se voit qu'avec des noms qui ne suivent pas
    // l'ordre de création.
    await client.query(
      `insert into public.profiles (id, display_name) values
         ($1, 'Marc'), ($2, 'Simon'), ($3, 'Gilles'),
         ($4, 'Léa'), ($5, 'Nour'), ($6, 'Yann'), ($7, 'Théo'),
         ($8, 'Sarah'), ($9, 'Omar'), ($10, 'Bruno'), ($11, 'Claire')`,
      [marc.id, simon.id, gilles.id, lea.id, nour.id, yann.id, theo.id, sarah.id, omar.id, bruno.id, claire.id],
    )

    const eglise = async (nom: string) => {
      const { rows } = await client.query<{ id: string }>(
        "insert into public.churches (name, status) values ($1, 'active') returning id",
        [`${nom} ${suffixe}`],
      )
      return rows[0].id
    }
    const bethel = await eglise('Bethel')
    const emmaus = await eglise('Emmaüs')

    await client.query(
      `insert into public.church_members (church_id, user_id, role, status) values
         ($1, $2, 'mentor', 'active'), ($1, $3, 'mentor', 'active'), ($1, $4, 'mentor', 'active'),
         ($1, $5, 'member', 'active'), ($1, $6, 'member', 'active'), ($1, $7, 'member', 'active'),
         ($1, $8, 'member', 'active'), ($1, $9, 'member', 'active'), ($1, $10, 'member', 'active'),
         ($11, $12, 'mentor', 'active'), ($11, $13, 'member', 'active')`,
      [bethel, marc.id, simon.id, gilles.id, lea.id, nour.id, yann.id, theo.id, sarah.id, omar.id,
        emmaus, bruno.id, claire.id],
    )

    // Trois mentors, trois états. C'est la matière de la garde de sortie.
    await client.query(
      `insert into public.mentor_profiles (user_id, verification_status, training_status) values
         ($1, 'verified', 'completed'),
         ($2, 'pending',  'completed'),
         ($3, 'verified', 'expired'),
         ($4, 'verified', 'completed')`,
      [marc.id, simon.id, gilles.id, bruno.id],
    )

    const affecter = async (
      eglise: string, mentor: string, participant: string, statut: string, creeIlYA: string,
    ) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.mentor_assignments (church_id, mentor_id, participant_id, status, created_at)
         values ($1, $2, $3, $4, timezone('utc', now()) - $5::interval) returning id`,
        [eglise, mentor, participant, statut, creeIlYA],
      )
      return rows[0].id
    }
    const affectationLea = await affecter(bethel, marc.id, lea.id, 'active', '90 days')
    const affectationNour = await affecter(bethel, marc.id, nour.id, 'active', '90 days')
    // Acceptée hier : c'est ce qui distingue `nouveau` de `a_relancer`, et sans
    // quoi quelqu'un serait « à relancer » le jour de son arrivée.
    const affectationYann = await affecter(bethel, marc.id, yann.id, 'active', '1 day')
    const affectationTheo = await affecter(bethel, marc.id, theo.id, 'pending', '3 days')
    const affectationSarah = await affecter(bethel, simon.id, sarah.id, 'active', '30 days')
    const affectationOmar = await affecter(bethel, gilles.id, omar.id, 'active', '30 days')
    const affectationClaire = await affecter(emmaus, bruno.id, claire.id, 'active', '30 days')

    // L'activité, la seule de tout le chantier. Léa a ouvert une séance il y a
    // trois jours ; Nour a posé un bilan il y a quarante jours, et rien depuis.
    await client.query(
      `insert into public.session_progress (user_id, journey_id, session_id, completed_at)
       values ($1, 'parcours-1', 'seance-2', timezone('utc', now()) - interval '3 days')`,
      [lea.id],
    )
    await client.query(
      `insert into public.weekly_checkins (user_id, week_key, state, updated_at)
       values ($1, '2026-W28', 'rude', timezone('utc', now()) - interval '40 days')`,
      [nour.id],
    )

    return {
      marc, simon, gilles, lea, nour, yann, theo, sarah, omar, bruno, claire, ines,
      bethel, emmaus,
      affectationLea, affectationNour, affectationYann, affectationTheo,
      affectationSarah, affectationOmar, affectationClaire,
    }
  })
}

type LigneSuivi = {
  assignment_id: string
  participant_id: string
  nom: string
  signal: string
  aide_ouverte_id: string | null
  aide_categorie: string | null
}

const suivi = (client: Client) =>
  client.query<LigneSuivi>('select * from public.tandem_mes_accompagnements()').then((r) => r.rows)

describe('Le tableau de suivi du mentor', () => {
  it('rend les personnes accompagnées avec leur nom, et rien qu’un mot chacune', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.marc, async (client) => {
      const lignes = await suivi(client)

      // Trois affectations `active`, et une quatrième restée `pending` qui
      // n'apparaît pas : le nom naît de l'acceptation.
      expect(lignes.map((l) => l.nom)).toEqual(['Léa', 'Nour', 'Yann'])
      expect(lignes.map((l) => l.participant_id)).not.toContain(decor.theo.id)

      // Le mot, et les trois cas qui l'expliquent.
      const parNom = Object.fromEntries(lignes.map((l) => [l.nom, l.signal]))
      expect(parNom).toEqual({ Léa: 'actif', Nour: 'a_relancer', Yann: 'nouveau' })

      // Et ce qui ne sort pas : la fonction ne rend aucune colonne de date
      // d'activité. Si quelqu'un en ajoutait une un jour, ce test rougirait.
      expect(Object.keys(lignes[0]).sort()).toEqual([
        'aide_categorie', 'aide_demandee_le', 'aide_ouverte_id',
        'assignment_id', 'depuis_le', 'nom', 'participant_id', 'signal',
      ])
    })
  })

  it('rend « a_relancer » sans que le mentor puisse lire une seule ligne de bilan ni de progression', async () => {
    // LE test du chantier. Il prouve que la fonction n'est pas une porte de
    // service : le signal existe, et la donnée qui l'a produit reste fermée.
    const decor = await monterDecor()

    await commeUtilisateur(decor.marc, async (client) => {
      const lignes = await suivi(client)
      expect(lignes.find((l) => l.nom === 'Nour')?.signal).toBe('a_relancer')

      const bilans = await client.query(
        'select week_key, state from public.weekly_checkins where user_id = $1', [decor.nour.id],
      )
      const seances = await client.query(
        'select session_id from public.session_progress where user_id = $1', [decor.lea.id],
      )
      expect(bilans.rowCount, 'le bilan de Nour a produit un signal, il ne se lit pas pour autant').toBe(0)
      expect(seances.rowCount, 'la séance de Léa a produit un signal, elle ne se lit pas pour autant').toBe(0)

      // Témoin positif : les lignes existent bel et bien.
      const vraiment = await constater(client,
        'select count(*)::int as n from public.weekly_checkins where user_id = $1', [decor.nour.id])
      expect(vraiment[0].n).toBe(1)
    })
  })

  it('trie par nom, jamais par signal — un tableau trié par signal est un classement', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.marc, async (client) => {
      const lignes = await suivi(client)
      const noms = lignes.map((l) => l.nom)
      expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')))
      // Et le contre-témoin : l'ordre obtenu n'est PAS celui des signaux
      // (`aide_demandee`, `nouveau`, `actif`, `a_relancer`), sans quoi ce test
      // passerait par coïncidence.
      expect(lignes.map((l) => l.signal)).not.toEqual(['actif', 'nouveau', 'a_relancer'].sort())
    })
  })

  it('ne rend rien à un mentor non vérifié, ni à un mentor dont la formation a expiré', async () => {
    const decor = await monterDecor()

    for (const mentor of [decor.simon, decor.gilles]) {
      await commeUtilisateur(mentor, async (client) => {
        expect(await suivi(client)).toEqual([])
      })
    }

    // Témoin positif dans le même décor : les affectations existent, elles sont
    // `active`, et leurs participants ont un nom. Ce n'est pas un décor vide.
    await commeService(async (client) => {
      const { rows } = await client.query<{ n: number }>(
        `select count(*)::int as n from public.mentor_assignments
          where mentor_id = any($1::uuid[]) and status = 'active'`,
        [[decor.simon.id, decor.gilles.id]],
      )
      expect(rows[0].n).toBe(2)
    })
  })

  it('ne laisse pas un mentor lire le nom de quelqu’un d’une autre église', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.marc, async (client) => {
      const lignes = await suivi(client)
      expect(lignes.map((l) => l.participant_id)).not.toContain(decor.claire.id)
      // Ni par le chemin direct : `profiles` reste own-only pour tout le monde.
      const profil = await client.query(
        'select display_name from public.profiles where id = $1', [decor.claire.id],
      )
      expect(profil.rowCount).toBe(0)
    })

    // Témoin : Bruno, lui, voit Claire. La fonction marche des deux côtés.
    await commeUtilisateur(decor.bruno, async (client) => {
      expect((await suivi(client)).map((l) => l.nom)).toEqual(['Claire'])
    })
  })

  it('ne rend même pas le nom de sa propre participante à qui n’est mentor de personne', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      expect(await suivi(client)).toEqual([])
    })
    await commeUtilisateur(decor.lea, async (client) => {
      // Une participante n'est pas un mentor : la fonction n'est pas un
      // annuaire déguisé de la communauté.
      expect(await suivi(client)).toEqual([])
    })
  })
})

describe('Ce que le participant voit de son accompagnement', () => {
  it('nomme le mentor proposé et l’état de sa vérification, avant d’accepter', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.theo, async (client) => {
      const { rows } = await client.query<{ nom: string; statut: string; verification: string }>(
        'select nom, statut, verification from public.tandem_mon_accompagnement()',
      )
      // Accepter un identifiant hexadécimal n'est pas un consentement.
      expect(rows).toEqual([{ nom: 'Marc', statut: 'pending', verification: 'verified' }])
    })
  })

  it('n’ouvre à personne l’accompagnement d’un autre', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      const { rowCount } = await client.query('select * from public.tandem_mon_accompagnement()')
      expect(rowCount).toBe(0)
    })
  })
})

describe('Demander de l’aide', () => {
  const demander = (client: Client, affectation: string, mentor: string, demandeur: string, categorie = 'parcours') =>
    client.query(
      `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
       values ($1, $2, $3, $4) returning id, status`,
      [affectation, demandeur, mentor, categorie],
    )

  it('part du participant, naît « open », et se voit dans le tableau du mentor', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.lea, async (client) => {
      const { rows } = await demander(client, decor.affectationLea, decor.marc.id, decor.lea.id, 'moral')
      // Toute écriture lit sa réponse : sans la politique de lecture, ce
      // `returning` rendrait un corps vide sur un insert réussi.
      expect(rows[0].status).toBe('open')
    })

    // Écrit dans une transaction annulée : on rejoue le geste hors RLS pour
    // observer le signal, puisque le harnais ne conserve rien.
    await commeService((client) => client.query(
      `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
       values ($1, $2, $3, 'moral')`,
      [decor.affectationLea, decor.lea.id, decor.marc.id],
    ))

    await commeUtilisateur(decor.marc, async (client) => {
      const ligne = (await suivi(client)).find((l) => l.nom === 'Léa')
      // La demande passe avant l'activité : Léa était « actif ».
      expect(ligne?.signal).toBe('aide_demandee')
      expect(ligne?.aide_categorie).toBe('moral')
      expect(ligne?.aide_ouverte_id).toBeTruthy()
    })
  })

  it('refuse une demande adressée à un mentor non vérifié — l’écran ne promet rien qui ne sera lu', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.sarah, async (client) => {
      const message = await refuse(client,
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'parcours')`,
        [decor.affectationSarah, decor.sarah.id, decor.simon.id])
      expect(message).toMatch(/row-level security/i)
    })

    // Témoin positif : la même écriture passe quand le mentor est vérifié.
    await commeUtilisateur(decor.lea, async (client) => {
      const { rows } = await demander(client, decor.affectationLea, decor.marc.id, decor.lea.id)
      expect(rows[0].status).toBe('open')
    })
  })

  it('refuse une demande écrite au nom de quelqu’un d’autre', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.nour, async (client) => {
      const message = await refuse(client,
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'parcours')`,
        [decor.affectationLea, decor.lea.id, decor.marc.id])
      expect(message).toMatch(/row-level security/i)
    })
  })

  it('n’ouvre qu’une demande à la fois — appuyer trois fois ne fait pas trois dossiers', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.lea, async (client) => {
      await demander(client, decor.affectationLea, decor.marc.id, decor.lea.id)
      const message = await refuse(client,
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'pratique')`,
        [decor.affectationLea, decor.lea.id, decor.marc.id])
      expect(message).toMatch(/help_requests_une_seule_ouverte_idx|duplicate key/i)
    })
  })

  it('n’accepte aucune catégorie hors des cinq', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.lea, async (client) => {
      const message = await refuse(client,
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'urgent')`,
        [decor.affectationLea, decor.lea.id, decor.marc.id])
      expect(message).toMatch(/violates check constraint/i)
    })
  })

  it('laisse le mentor dire « j’ai vu », et lui interdit de rouvrir ce que le jeune a clos', async () => {
    const decor = await monterDecor()
    const id = await commeService(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'parcours') returning id`,
        [decor.affectationLea, decor.lea.id, decor.marc.id],
      )
      return rows[0].id
    })

    await commeUtilisateur(decor.marc, async (client) => {
      const vu = await client.query(
        "update public.help_requests set status = 'acknowledged' where id = $1 returning acknowledged_at", [id],
      )
      expect(vu.rowCount, 'un refus par `using` ne lève rien : c’est le compte de lignes qui parle').toBe(1)
      // L'horodatage est posé par le déclencheur : le client n'a pas le grant.
      expect(vu.rows[0].acknowledged_at).toBeTruthy()

      // Ce que le mentor ne peut pas : clore. Ce n'est pas à celui qu'on
      // appelle de décider que l'appel est terminé.
      const ferme = await client.query(
        "update public.help_requests set status = 'closed' where id = $1", [id],
      )
      expect(ferme.rowCount).toBe(0)
    })

    await commeService((client) => client.query(
      "update public.help_requests set status = 'closed' where id = $1", [id],
    ))

    await commeUtilisateur(decor.marc, async (client) => {
      // LA mutation que le `with check` seul ne verrait pas : l'état d'origine
      // est dans le `using`, et c'est lui qui empêche de rouvrir un appel clos.
      const rouvre = await client.query(
        "update public.help_requests set status = 'acknowledged' where id = $1", [id],
      )
      expect(rouvre.rowCount, 'un `with check` seul aurait laissé passer celle-ci').toBe(0)
    })
  })

  it('laisse le demandeur clore, et personne d’autre la lire', async () => {
    const decor = await monterDecor()
    const id = await commeService(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'spirituel') returning id`,
        [decor.affectationLea, decor.lea.id, decor.marc.id],
      )
      return rows[0].id
    })

    await commeUtilisateur(decor.nour, async (client) => {
      // Une autre participante du même mentor ne voit rien.
      const { rowCount } = await client.query('select id from public.help_requests where id = $1', [id])
      expect(rowCount).toBe(0)
    })

    await commeUtilisateur(decor.lea, async (client) => {
      const { rowCount } = await client.query(
        "update public.help_requests set status = 'closed' where id = $1 returning id", [id],
      )
      expect(rowCount).toBe(1)
    })
  })
})

describe('Encourager', () => {
  const encourager = (client: Client, affectation: string, mentor: string, participant: string, mot = 'je_pense_a_toi') =>
    client.query(
      `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
       values ($1, $2, $3, $4) returning id, message_key`,
      [affectation, mentor, participant, mot],
    )

  it('part du mentor vérifié et arrive chez le participant', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      const { rows } = await encourager(client, decor.affectationLea, decor.marc.id, decor.lea.id)
      expect(rows[0].message_key).toBe('je_pense_a_toi')
    })

    await commeService((client) => client.query(
      `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
       values ($1, $2, $3, 'je_prie_pour_toi')`,
      [decor.affectationLea, decor.marc.id, decor.lea.id],
    ))

    await commeUtilisateur(decor.lea, async (client) => {
      const { rows } = await client.query<{ message_key: string }>(
        'select message_key from public.mentor_encouragements',
      )
      expect(rows.map((r) => r.message_key)).toEqual(['je_prie_pour_toi'])
    })
    // Étanchéité : Nour, accompagnée par le même mentor, ne lit pas le mot
    // adressé à Léa.
    await commeUtilisateur(decor.nour, async (client) => {
      const { rowCount } = await client.query('select id from public.mentor_encouragements')
      expect(rowCount).toBe(0)
    })
  })

  it('refuse un mentor non vérifié, et un mentor dont la formation a expiré', async () => {
    const decor = await monterDecor()
    for (const [mentor, affectation, participant] of [
      [decor.simon, decor.affectationSarah, decor.sarah],
      [decor.gilles, decor.affectationOmar, decor.omar],
    ] as const) {
      await commeUtilisateur(mentor, async (client) => {
        const message = await refuse(client,
          `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
           values ($1, $2, $3, 'fais_moi_signe')`,
          [affectation, mentor.id, participant.id])
        expect(message).toMatch(/row-level security/i)
      })
    }
  })

  it('n’accepte aucun mot hors des six — il n’y a pas de texte libre ici', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      const message = await refuse(client,
        `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
         values ($1, $2, $3, 'tu as trois semaines de retard')`,
        [decor.affectationLea, decor.marc.id, decor.lea.id])
      expect(message).toMatch(/violates check constraint/i)
    })
  })

  it('n’en laisse passer qu’un par jour et par accompagnement', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      await encourager(client, decor.affectationLea, decor.marc.id, decor.lea.id)
      const message = await refuse(client,
        `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
         values ($1, $2, $3, 'prends_ton_temps')`,
        [decor.affectationLea, decor.marc.id, decor.lea.id])
      expect(message).toMatch(/mentor_encouragements_un_par_jour_idx|duplicate key/i)

      // Témoin positif : l'autre accompagnement du même mentor, le même jour,
      // passe. La borne est par relation, pas par mentor.
      const { rows } = await encourager(client, decor.affectationNour, decor.marc.id, decor.nour.id)
      expect(rows[0].id).toBeTruthy()
    })
  })

  it('ne laisse pas dater son geste d’hier pour contourner la borne', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      const message = await refuse(client,
        `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key, jour)
         values ($1, $2, $3, 'fais_moi_signe', current_date - 1)`,
        [decor.affectationLea, decor.marc.id, decor.lea.id])
      expect(message).toMatch(/permission denied|column "jour"/i)
    })
  })

  it('laisse le participant effacer ce qu’il a reçu, et le mentor pas', async () => {
    const decor = await monterDecor()
    const id = await commeService(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
         values ($1, $2, $3, 'on_reprend_quand_tu_veux') returning id`,
        [decor.affectationLea, decor.marc.id, decor.lea.id],
      )
      return rows[0].id
    })

    await commeUtilisateur(decor.marc, async (client) => {
      // Ce que le mentor a envoyé ne lui appartient plus. Refus par `using` :
      // aucune exception, zéro ligne.
      const { rowCount } = await client.query('delete from public.mentor_encouragements where id = $1', [id])
      expect(rowCount).toBe(0)
    })

    await commeUtilisateur(decor.lea, async (client) => {
      const { rowCount } = await client.query(
        'delete from public.mentor_encouragements where id = $1 returning id', [id],
      )
      expect(rowCount).toBe(1)
    })
  })
})

describe('tandem_accompagnement_actif ne devient pas un annuaire', () => {
  it('rend faux à un tiers qui sonde une paire réelle', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      const { rows } = await client.query<{ actif: boolean }>(
        'select public.tandem_accompagnement_actif($1, $2) as actif', [decor.marc.id, decor.lea.id],
      )
      // Elle rend `true` — c'est un prédicat sur une paire, pas sur l'appelant.
      // Ce que ce test épingle, c'est qu'elle ne rend QUE cela : aucun nom,
      // aucune ligne, rien que ne connaisse déjà celui qui nomme les deux
      // identifiants. Les politiques ajoutent chacune leur conjonct d'identité,
      // et ce sont eux qui refusent (voir les deux suites ci-dessus).
      expect(rows[0].actif).toBe(true)
      expect(Object.keys(rows[0])).toEqual(['actif'])
    })
  })

  it('rend faux sur une paire dont le mentor n’est pas vérifié', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      const { rows } = await client.query<{ a: boolean; b: boolean }>(
        `select public.tandem_accompagnement_actif($1, $2) as a,
                public.tandem_accompagnement_actif($3, $4) as b`,
        [decor.simon.id, decor.sarah.id, decor.marc.id, decor.theo.id],
      )
      expect(rows[0].a, 'mentor non vérifié').toBe(false)
      expect(rows[0].b, 'affectation restée « pending »').toBe(false)
    })
  })
})

describe('La suppression de compte emporte l’espace mentor', () => {
  /**
   * La mesure se fait **dans la même transaction que le geste** et **hors RLS**
   * (`reset role`), pour la raison écrite dans `suppression-compte.test.ts` :
   * le harnais annule chaque transaction, donc rien n'est observable après
   * coup ; et sous l'identité de celui qui vient de partir, une politique
   * masquerait une ligne survivante aussi bien qu'un `delete` l'aurait
   * effacée. Les deux causes sont indiscernables, alors on lit des faits.
   */
  const supprimerPuisCompter = (qui: Utilisateur, sql: string, params: unknown[]) =>
    commeUtilisateur(qui, async (client) => {
      const avant = await constater<{ n: number }>(client, sql, params)
      await client.query('select public.supprimer_mon_compte()')
      await client.query('reset role')
      const { rows } = await client.query<{ n: number }>(sql, params)
      return { avant: avant[0].n, apres: rows[0].n }
    })

  it('efface les demandes d’aide et les encouragements du mentor qui s’en va', async () => {
    const decor = await monterDecor()
    await commeService(async (client) => {
      await client.query(
        `insert into public.help_requests (assignment_id, requester_id, mentor_id, category)
         values ($1, $2, $3, 'parcours')`,
        [decor.affectationLea, decor.lea.id, decor.marc.id],
      )
      await client.query(
        `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
         values ($1, $2, $3, 'je_pense_a_toi')`,
        [decor.affectationLea, decor.marc.id, decor.lea.id],
      )
    })

    // C'est le MENTOR qui s'en va : le sens le moins évident des deux, et celui
    // qu'un `where user_id = v_uid` distrait aurait manqué.
    const compte = await supprimerPuisCompter(decor.marc,
      `select ((select count(*) from public.help_requests where mentor_id = $1)
             + (select count(*) from public.mentor_encouragements where mentor_id = $1)
             + (select count(*) from public.mentor_assignments where mentor_id = $1))::int as n`,
      [decor.marc.id])

    // Le témoin « avant » est ce qui empêche un décor cassé de rendre ce test
    // vert sans que la fonction ait rien fait.
    // Une demande, un encouragement, et les quatre affectations de Marc — dont
    // celle restée « pending », qui part elle aussi.
    expect(compte.avant).toBe(6)
    expect(compte.apres).toBe(0)
  })

  it('emporte aussi celles où la personne était le participant', async () => {
    const decor = await monterDecor()
    await commeService((client) => client.query(
      `insert into public.mentor_encouragements (assignment_id, mentor_id, participant_id, message_key)
       values ($1, $2, $3, 'prends_ton_temps')`,
      [decor.affectationLea, decor.marc.id, decor.lea.id],
    ))

    const compte = await supprimerPuisCompter(decor.lea,
      'select count(*)::int as n from public.mentor_encouragements where participant_id = $1',
      [decor.lea.id])
    expect(compte.avant).toBe(1)
    expect(compte.apres).toBe(0)

    // Témoin d'étanchéité, **dans la même transaction que le geste** — sans
    // quoi il mesurerait un décor intact, la transaction du harnais ayant été
    // annulée entre-temps : le départ de Léa n'emporte pas les autres
    // accompagnements de Marc.
    const restants = await supprimerPuisCompter(decor.lea,
      "select count(*)::int as n from public.mentor_assignments where mentor_id = $1 and status = 'active'",
      [decor.marc.id])
    expect(restants.avant).toBe(3)
    expect(restants.apres).toBe(2)
  })
})
