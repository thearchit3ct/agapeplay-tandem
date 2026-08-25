/**
 * Le bilan de fin de semaine — issue #18, et la table la plus simple du dépôt.
 *
 * Simple, donc facile à croire correcte sans l'avoir mesurée. Trois choses
 * cassent en silence sur une table own-only, et ce sont les trois que ce
 * fichier mesure :
 *
 *   1. **un UPDATE ou un DELETE refusé par un `using` ne lève rien.** Il touche
 *      zéro ligne, et une application qui ne lirait que l'erreur annoncerait
 *      « c'est noté » sur une réponse qui n'a pas bougé. On compte donc les
 *      lignes réellement touchées, jamais l'absence d'exception ;
 *   2. **une ligne peut être déplacée dans le compte de quelqu'un d'autre** par
 *      un `update … set user_id = …`, et le bilan atterrit alors chez un tiers
 *      qui ne l'a pas écrit et ne peut plus l'effacer. Le conjonct qui
 *      l'interdit est `(select auth.uid()) = user_id`, écrit deux fois : dans
 *      le `with check` de l'UPDATE, et — moins évident — dans le `using` du
 *      SELECT, que PostgreSQL applique aussi à la **nouvelle** ligne d'un
 *      UPDATE. C'est ce dernier qui tient aujourd'hui : la mutation qui casse
 *      le seul `with check` ne fait rougir aucun test, celle qui ouvre le
 *      SELECT en fait rougir quatre. Voir la migration pour le détail et pour
 *      la raison de garder les deux ;
 *   3. **la cascade vers `auth.users` ne se déclenche jamais.**
 *      `supprimer_mon_compte()` ne supprime pas la ligne `auth.users`, elle la
 *      neutralise. Le `delete` explicite ajouté à la fonction est donc le seul
 *      chemin par lequel ces lignes s'en vont, et « c'est cascadé » serait ici
 *      une croyance, pas un mécanisme.
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif dans le
 * même décor : sans lui, zéro ligne pourrait vouloir dire « la politique a
 * discriminé » aussi bien que « le décor était vide ».
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
  /** Celle dont on suit les bilans. */
  claire: Utilisateur
  /** Son binôme : la personne la plus proche, et qui ne lit rien non plus. */
  elodie: Utilisateur
  /** Mentor de Claire, rattaché et vérifié : celui qui aurait le plus de raisons de croire qu'il a le droit. */
  mentor: Utilisateur
  tandemId: string
}

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Deux comptes appariés, un mentor réellement affecté, et un bilan chacune.
 *
 * Posé hors RLS (`commeService`) pour survivre aux transactions — annulées —
 * des appels qui suivent.
 */
const monterDecor = async (): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const claire = await creerUtilisateur(client, `claire-${suffixe}@test.local`)
    const elodie = await creerUtilisateur(client, `elodie-${suffixe}@test.local`)
    const mentor = await creerUtilisateur(client, `mentor-${suffixe}@test.local`)

    const tandem = await client.query<{ id: string }>(
      `insert into public.tandems (participant_a_id, participant_b_id, status)
       values ($1, $2, 'active') returning id`,
      [claire.id, elodie.id],
    )

    await client.query(
      `insert into public.weekly_checkins (user_id, week_key, state) values
         ($1, '2026-W35', 'rude'),
         ($2, '2026-W35', 'paisible')`,
      [claire.id, elodie.id],
    )

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

    return { claire, elodie, mentor, tandemId: tandem.rows[0].id }
  })
}

type LigneBilan = { user_id: string; week_key: string; state: string }

const mesBilans = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query<LigneBilan>('select user_id, week_key, state from public.weekly_checkins')
    return rows
  })

/** L'état d'un bilan lu hors RLS : la vérité, indépendante de ce qu'un compte voit. */
const etatReel = (personne: Utilisateur, semaine = '2026-W35') =>
  commeService(async (client: Client) => {
    const { rows } = await client.query<LigneBilan>(
      'select user_id, week_key, state from public.weekly_checkins where user_id = $1 and week_key = $2',
      [personne.id, semaine],
    )
    return rows
  })

describe('ce qu’un compte voit de ses semaines', () => {
  it('TÉMOIN — chacune lit la sienne, et rien de plus', async () => {
    const { claire, elodie } = await monterDecor()

    const vueDeClaire = await mesBilans(claire)
    expect(vueDeClaire).toHaveLength(1)
    expect(vueDeClaire[0]).toMatchObject({ user_id: claire.id, week_key: '2026-W35', state: 'rude' })

    // Le témoin miroir : les deux lignes existent, et chacune ne voit que la
    // sienne. Sans ce second appel, un `select` vide côté Élodie pourrait
    // signifier « le décor n'a rien inséré pour elle ».
    const vueDElodie = await mesBilans(elodie)
    expect(vueDElodie).toHaveLength(1)
    expect(vueDElodie[0].state).toBe('paisible')
  })

  it('le binôme ne lit pas la semaine de l’autre, alors qu’il partage tout le reste', async () => {
    const { claire, elodie } = await monterDecor()

    // La relation est active, la conversation est ouverte, le journal peut être
    // partagé sur décision — et ceci reste fermé. C'est la décision du
    // chantier : on partage des mots choisis, pas un état brut.
    expect((await mesBilans(elodie)).map((l) => l.user_id)).not.toContain(claire.id)
  })

  it('le mentor, pourtant affecté et vérifié, ne lit rien', async () => {
    const { claire, mentor } = await monterDecor()

    const vue = await mesBilans(mentor)
    expect(vue).toEqual([])
    expect((await etatReel(claire))).toHaveLength(1)
  })

  it('sans identité, aucune ligne — et un visiteur n’a même pas la table', async () => {
    await monterDecor()

    const sansIdentite = await commeAuthentifieSansIdentite(async (client) => {
      const { rows } = await client.query('select * from public.weekly_checkins')
      return rows
    })
    expect(sansIdentite).toEqual([])

    await expect(
      commeAnonyme((client) => client.query('select * from public.weekly_checkins')),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('ce qu’un compte a le droit d’écrire', () => {
  it('TÉMOIN — on pose et on corrige sa propre réponse', async () => {
    const { claire } = await monterDecor()

    const pose = await commeUtilisateur(claire, async (client) => {
      const insertion = await client.query(
        "insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W36', 'dense') returning state",
        [claire.id],
      )
      // Corriger, c'est bien un UPDATE qui touche une ligne — pas une absence
      // d'erreur. Sans le compte, un `using` qui aurait masqué la ligne
      // laisserait ce test vert.
      const correction = await client.query(
        "update public.weekly_checkins set state = 'incertain' where user_id = $1 and week_key = '2026-W36'",
        [claire.id],
      )
      return { insere: insertion.rows[0].state, corrigees: correction.rowCount }
    })

    expect(pose).toEqual({ insere: 'dense', corrigees: 1 })
  })

  it('on ne pose pas un bilan au nom de quelqu’un d’autre', async () => {
    const { claire, elodie } = await monterDecor()

    // Une violation de `with check` à l'INSERT, elle, lève : c'est le seul des
    // trois ordres dont l'échec se voit sans compter les lignes.
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query(
          "insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W40', 'rude')",
          [elodie.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('LE CONJONCT CENTRAL — un update ne déplace pas une ligne dans le compte d’un autre', async () => {
    const { claire, elodie } = await monterDecor()

    // Le conjonct est `(select auth.uid()) = user_id`, et il est écrit deux
    // fois : dans le `with check` de `weekly_checkins_update_own`, et dans le
    // `using` de `weekly_checkins_select_own` — que PostgreSQL applique aussi à
    // la nouvelle ligne d'un UPDATE (table « Policies Applied by Command Type »
    // de la doc de CREATE POLICY). Mesuré : casser le seul `with check` ne rend
    // ce test ni rouge ni vert autrement, c'est le SELECT qui tient. Casser les
    // deux le rend rouge — et c'est la mutation qui prouve vraiment cette
    // ligne-ci.
    //
    // Sans ce conjonct, le bilan atterrirait chez Élodie, qui ne l'a pas écrit
    // et ne pourrait plus l'effacer : sa propre politique de delete ne verrait
    // qu'une ligne dont elle est désormais propriétaire.
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query(
          "update public.weekly_checkins set user_id = $1 where user_id = $2 and week_key = '2026-W35'",
          [elodie.id, claire.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i)

    // Et la vérité hors RLS le confirme : la ligne est restée là où elle était.
    expect(await etatReel(claire)).toHaveLength(1)
    expect((await etatReel(elodie))[0].state).toBe('paisible')
  })

  it('un update sur la semaine d’un autre ne touche rien — en silence', async () => {
    const { claire, elodie } = await monterDecor()

    const touchees = await commeUtilisateur(elodie, async (client) => {
      const resultat = await client.query(
        "update public.weekly_checkins set state = 'paisible' where user_id = $1 and week_key = '2026-W35'",
        [claire.id],
      )
      return resultat.rowCount
    })

    // Zéro ligne, aucune exception : c'est exactement le silence contre lequel
    // « toute écriture lit sa réponse » a été écrit.
    expect(touchees).toBe(0)
    expect((await etatReel(claire))[0].state).toBe('rude')
  })

  it('un delete sur la semaine d’un autre ne touche rien non plus', async () => {
    const { claire, elodie } = await monterDecor()

    const supprimees = await commeUtilisateur(elodie, async (client) => {
      const resultat = await client.query('delete from public.weekly_checkins where user_id = $1', [claire.id])
      return resultat.rowCount
    })

    expect(supprimees).toBe(0)
    expect(await etatReel(claire)).toHaveLength(1)

    // Le témoin positif du même ordre : Élodie efface bien la sienne.
    const lasienne = await commeUtilisateur(elodie, async (client) => {
      const resultat = await client.query('delete from public.weekly_checkins where user_id = $1', [elodie.id])
      return resultat.rowCount
    })
    expect(lasienne).toBe(1)
  })
})

describe('ce que le schéma refuse tout court', () => {
  it('n’accepte pas une clé de semaine mal formée', async () => {
    const { claire } = await monterDecor()

    // `2026-W5` se rangerait après `2026-W10` dans un tri de chaînes, et
    // `week_key` est du texte. Une clé mal formée ne se voit pas : elle fait
    // mentir l'ordre des semaines, des mois plus tard.
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W5', 'rude')", [claire.id]),
      ),
    ).rejects.toThrow(/week_key_check|violates check constraint/i)
  })

  it('n’accepte aucun mot hors des cinq réponses', async () => {
    const { claire } = await monterDecor()

    // La liste close est la garde qui empêche cette colonne de devenir un
    // champ libre — c'est-à-dire un second journal, sans aucune des protections
    // du premier.
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W41', 'j’ai passé une semaine horrible à cause de mon père')", [claire.id]),
      ),
    ).rejects.toThrow(/violates check constraint/i)
  })

  it('ne garde qu’une réponse par semaine', async () => {
    const { claire } = await monterDecor()

    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W35', 'dense')", [claire.id]),
      ),
    ).rejects.toThrow(/duplicate key|weekly_checkins_pkey/i)
  })
})

describe('la suppression de compte emporte les bilans', () => {
  it('efface les siens — la cascade vers auth.users ne se déclenche jamais', async () => {
    const { claire, elodie } = await monterDecor()

    // Le témoin « avant » : les deux lignes sont là. Sans lui, un décor cassé
    // rendrait ce test vert sans que la fonction ait rien fait.
    expect(await etatReel(claire)).toHaveLength(1)
    expect(await etatReel(elodie)).toHaveLength(1)

    // La mesure se fait **dans la même transaction que l'appel**, et hors RLS
    // (`reset role` rend le rôle de session). Deux raisons, toutes deux
    // mesurées dans `suppression-compte.test.ts` avant nous : il n'y a pas
    // d'« après » qui survive au `rollback` du harnais, et sous l'identité de
    // celle qui vient de partir un `count(*) where user_id = <un tiers>` rendrait
    // zéro à cause de la politique, pas de la suppression. On lit des faits.
    const restes = await commeUtilisateur(claire, async (client) => {
      await client.query('select public.supprimer_mon_compte()')
      await client.query('reset role')
      const compter = async (id: string) => {
        const { rows } = await client.query<{ n: string }>(
          'select count(*) as n from public.weekly_checkins where user_id = $1',
          [id],
        )
        return Number(rows[0].n)
      }
      return { partie: await compter(claire.id), restante: await compter(elodie.id) }
    })

    // `weekly_checkins.user_id` référence `auth.users(id) on delete cascade`, et
    // ce n'est qu'un leurre : la fonction neutralise la ligne `auth.users`, elle
    // ne la supprime pas. Sans le `delete` explicite ajouté par
    // `20260825213000`, les bilans d'un mineur survivraient à son départ,
    // indéfiniment, sans qu'aucune erreur ne le signale.
    //
    // Et ceux d'Élodie, qui n'a rien demandé, sont intacts : une suppression
    // qui déborde est aussi grave qu'une suppression qui n'a pas lieu.
    expect(restes).toEqual({ partie: 0, restante: 1 })
  })
})
