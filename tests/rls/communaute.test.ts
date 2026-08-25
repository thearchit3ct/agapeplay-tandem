/**
 * Communautés, groupes, cohortes et rôles — issue #17.
 *
 * Ce fichier ouvre le premier chemin d'écriture du dépôt qui ne soit pas
 * « own only » : jusqu'ici, toute politique d'écriture se lisait
 * `auth.uid() = user_id`. Ici quelqu'un écrit **sur la ligne d'un autre** parce
 * qu'il porte un rôle. Trois modes d'échec en découlent, et ce sont ceux que ce
 * fichier mesure plutôt que de les supposer :
 *
 *   1. **un refus par `using` ne lève rien.** Un responsable d'une autre église
 *      qui clôture une cohorte qui n'est pas la sienne touche zéro ligne, sans
 *      exception. On compte donc `rowCount`, jamais l'absence d'erreur ;
 *   2. **la lecture est un prérequis de l'écriture.** Sans
 *      `groups_church_member_read`, le responsable ne lit pas le groupe qu'il
 *      vient de créer : `insert … returning` rend un corps vide et l'UPDATE de
 *      clôture ne trouve rien. Les tests exigent donc la ligne rendue, pas
 *      seulement l'absence d'erreur (leçon de la PR #49) ;
 *   3. **l'étanchéité entre deux communautés** ne se voit pas depuis une seule.
 *      Tout le décor porte donc deux églises complètes, et chaque pouvoir du
 *      responsable de la première est retenté par le responsable de la seconde.
 *
 * Ces tests ont trouvé, à leur première exécution, un cycle de politiques réel
 * — `church_groups` → `group_members` → `church_groups`, « infinite recursion
 * detected in policy » sur un simple `insert … returning`. La migration porte
 * la correction et son récit ; c'est le meilleur argument pour la façon dont
 * cette suite est écrite : la mutation d'abord, le raisonnement ensuite.
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif dans le
 * même décor : sans lui, zéro ligne pourrait vouloir dire « la politique a
 * discriminé » aussi bien que « le décor était vide ».
 */
import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  commeAuthentifieSansIdentite,
  commeService,
  commeUtilisateur,
  creerUtilisateur,
  type Utilisateur,
} from './harnais'

type Decor = {
  /** Responsable de Bethel, l'église active. */
  pauline: Utilisateur
  /** Mentor de Bethel : rôle `mentor`, membre actif. */
  marc: Utilisateur
  /** Participante de Bethel. */
  lea: Utilisateur
  /** Membre de Bethel, promis au retrait. */
  youssef: Utilisateur
  /** Membre révoqué de Bethel : celui qui a le plus de raisons de croire qu'un lien le ferait revenir. */
  sortie: Utilisateur
  /** Responsable d'Emmaüs — la seconde église, celle qui mesure l'étanchéité. */
  bruno: Utilisateur
  /** Responsable d'une église restée `pending` : tous les droits, aucun des deux actes liants. */
  chantal: Utilisateur
  /** Personne sans aucune communauté : celle qui rejoint. */
  ines: Utilisateur

  bethel: string
  emmaus: string
  enAttente: string

  /** Cohorte ouverte, sans date de fin. */
  cohorteOuverte: string
  /** Cohorte dont `ends_on` est passé : ouverte au sens du statut, fermée au sens du droit. */
  cohorteTerminee: string
  /** Cohorte explicitement close. */
  cohorteClose: string

  /** Lien vers Bethel, sans cohorte. */
  jetonBethel: string
  /** Lien vers la cohorte terminée. */
  jetonTerminee: string
  /** Lien vers la cohorte close. */
  jetonClose: string
  /** Lien vers l'église restée en attente. */
  jetonEnAttente: string
  /** Lien révoqué. */
  jetonRevoque: string
}

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Éprouver un refus **sans perdre la transaction**.
 *
 * PostgreSQL abandonne une transaction dès qu'une commande y échoue : tout ce
 * qui suit rend « current transaction is aborted ». Un test qui enchaînerait un
 * refus attendu et son témoin positif verrait donc le second échouer pour une
 * raison qui n'a rien à voir avec les politiques — et, dans l'autre sens, un
 * témoin écrit avant le refus laisserait croire que le refus est bien celui
 * qu'on visait. Le point de reprise résout les deux : la tentative est isolée,
 * annulée, et la transaction continue intacte.
 *
 * La fonction rend le message plutôt que de l'affirmer elle-même : c'est au
 * test de dire quel refus il attendait. Et si la base **accepte** ce qu'elle
 * devait refuser, on lève ici — un refus qui n'a pas eu lieu ne doit jamais
 * ressembler à un test qui passe.
 */
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

/**
 * Constater l'effet d'une écriture depuis l'intérieur de la transaction.
 *
 * Le harnais annule chaque transaction, ce qui est ce qui rend la suite
 * réutilisable — mais interdit d'aller relire après coup une ligne écrite par
 * une RPC. Et certaines de ces lignes ne sont **pas lisibles par celui qui vient
 * de les écrire** : `church_invitations.uses` est réservé au responsable, et
 * c'est justement celui qui rejoint qui l'incrémente.
 *
 * On redevient donc `postgres` le temps de l'observation, dans la même
 * transaction. Ce n'est pas un contournement : l'écriture, elle, a bien eu lieu
 * sous `authenticated` et sous RLS — c'est le constat qui change de rôle, pas
 * le geste. Le rôle est immédiatement rendu, pour qu'un test qui continue
 * n'écrive jamais hors RLS par inadvertance.
 */
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
 * Deux églises complètes, une troisième en attente, trois cohortes aux trois
 * états, et cinq liens. Posé hors RLS (`commeService`) pour survivre aux
 * transactions — annulées — des appels qui suivent.
 */
const monterDecor = async (): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const nouveau = (prenom: string) => creerUtilisateur(client, `${prenom}-${suffixe}@test.local`)
    const pauline = await nouveau('pauline')
    const marc = await nouveau('marc')
    const lea = await nouveau('lea')
    const youssef = await nouveau('youssef')
    const sortie = await nouveau('sortie')
    const bruno = await nouveau('bruno')
    const chantal = await nouveau('chantal')
    const ines = await nouveau('ines')

    const eglise = async (nom: string, statut: string) => {
      const { rows } = await client.query<{ id: string }>(
        'insert into public.churches (name, status) values ($1, $2) returning id',
        [`${nom} ${suffixe}`, statut],
      )
      return rows[0].id
    }
    const bethel = await eglise('Bethel', 'active')
    const emmaus = await eglise('Emmaüs', 'active')
    const enAttente = await eglise('En attente', 'pending')

    await client.query(
      `insert into public.church_members (church_id, user_id, role, status) values
         ($1, $2, 'leader', 'active'),
         ($1, $3, 'mentor', 'active'),
         ($1, $4, 'member', 'active'),
         ($1, $5, 'member', 'active'),
         ($1, $6, 'member', 'revoked'),
         ($7, $8, 'leader', 'active'),
         ($9, $10, 'leader', 'active')`,
      [bethel, pauline.id, marc.id, lea.id, youssef.id, sortie.id, emmaus, bruno.id, enAttente, chantal.id],
    )

    const groupe = async (eglise: string, nom: string, statut: string, fin: string | null) => {
      const { rows } = await client.query<{ id: string }>(
        'insert into public.church_groups (church_id, name, status, ends_on) values ($1, $2, $3, $4) returning id',
        [eglise, nom, statut, fin],
      )
      return rows[0].id
    }
    const cohorteOuverte = await groupe(bethel, 'Cohorte ouverte', 'active', null)
    const cohorteTerminee = await groupe(bethel, 'Cohorte terminée', 'active', '2026-06-30')
    const cohorteClose = await groupe(bethel, 'Cohorte close', 'closed', null)

    const lien = async (eglise: string, groupeId: string | null, emetteur: string, statut: string) => {
      const { rows } = await client.query<{ token: string }>(
        `insert into public.church_invitations (church_id, group_id, created_by, status)
         values ($1, $2, $3, $4) returning token`,
        [eglise, groupeId, emetteur, statut],
      )
      return rows[0].token
    }
    const jetonBethel = await lien(bethel, null, pauline.id, 'pending')
    const jetonTerminee = await lien(bethel, cohorteTerminee, pauline.id, 'pending')
    const jetonClose = await lien(bethel, cohorteClose, pauline.id, 'pending')
    const jetonEnAttente = await lien(enAttente, null, chantal.id, 'pending')
    const jetonRevoque = await lien(bethel, null, pauline.id, 'revoked')

    return {
      pauline, marc, lea, youssef, sortie, bruno, chantal, ines,
      bethel, emmaus, enAttente,
      cohorteOuverte, cohorteTerminee, cohorteClose,
      jetonBethel, jetonTerminee, jetonClose, jetonEnAttente, jetonRevoque,
    }
  })
}

describe('Fonder une communauté', () => {
  it('crée une église « pending » et son premier responsable, d’un seul geste', async () => {
    const suffixe = marque()
    const fondateur = await commeService((client) => creerUtilisateur(client, `fondateur-${suffixe}@test.local`))

    await commeUtilisateur(fondateur, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        'select public.creer_ma_communaute($1) as id',
        ['Église de la Trinité'],
      )
      const id = rows[0].id
      expect(id).toBeTruthy()

      // Les deux lignes naissent ensemble : une église sans responsable au
      // premier instant serait une église que personne ne peut plus piloter.
      const eglise = await constater<{ status: string; name: string }>(
        client, 'select status, name from public.churches where id = $1', [id],
      )
      expect(eglise).toEqual([{ status: 'pending', name: 'Église de la Trinité' }])

      const membre = await constater<{ role: string; status: string }>(
        client, 'select role, status from public.church_members where church_id = $1', [id],
      )
      expect(membre).toEqual([{ role: 'leader', status: 'active' }])
    })
  })

  it('refuse une seconde communauté à qui appartient déjà à une', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.youssef, async (client) => {
      expect(await refuse(client, 'select public.creer_ma_communaute($1)', ['Une seconde']))
        .toMatch(/deja_dans_une_communaute/)
    })
    // Témoin : la même RPC, la même seconde, une personne sans communauté.
    await commeUtilisateur(decor.ines, async (client) => {
      const { rows } = await client.query<{ id: string }>('select public.creer_ma_communaute($1) as id', ['Ailleurs'])
      expect(rows[0].id).toBeTruthy()
    })
  })

  it('refuse un nom vide, et refuse de fonder sans identité', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      expect(await refuse(client, 'select public.creer_ma_communaute($1)', ['  '])).toMatch(/nom_invalide/)
    })
    await commeAuthentifieSansIdentite(async (client) => {
      expect(await refuse(client, 'select public.creer_ma_communaute($1)', ['Sans personne']))
        .toMatch(/identite_absente/)
    })
  })

  it('n’ouvre aucun chemin vers `churches` : le responsable ne peut pas activer sa propre église', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.chantal, async (client) => {
      // Ni politique ni `grant` : la base refuse au niveau des droits, avant
      // même la RLS. C'est la protection, pas un oubli — l'activation est un
      // geste SQL sanctionné (voir la migration).
      expect(await refuse(client, 'update public.churches set status = $1 where id = $2', ['active', decor.enAttente]))
        .toMatch(/permission denied/)
      expect(await refuse(client, 'insert into public.churches (name) values ($1)', ['Par la porte de service']))
        .toMatch(/permission denied/)
      // Témoin : elle lit bien son église. Le refus porte sur l'écriture seule.
      const lue = await client.query('select status from public.churches where id = $1', [decor.enAttente])
      expect(lue.rowCount).toBe(1)
    })
  })
})

describe('Le pouvoir du responsable — et son étanchéité', () => {
  it('crée un groupe, et le relit : sans la lecture, l’écriture ne rendrait rien', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const { rows, rowCount } = await client.query<{ id: string; name: string }>(
        `insert into public.church_groups (church_id, name, starts_on, ends_on)
         values ($1, 'Cohorte de rentrée', '2026-09-01', '2026-12-20')
         returning id, name`,
        [decor.bethel],
      )
      expect(rowCount).toBe(1)
      // `returning` passe par le SELECT : une ligne rendue prouve que le
      // responsable lit ce qu'il vient d'écrire.
      expect(rows[0].name).toBe('Cohorte de rentrée')

      const relu = await client.query('select id from public.church_groups where id = $1', [rows[0].id])
      expect(relu.rowCount).toBe(1)
    })
  })

  it('refuse la création de groupe à un membre, à un mentor, et au responsable d’une autre église', async () => {
    const decor = await monterDecor()
    for (const intrus of [decor.youssef, decor.marc, decor.bruno]) {
      await commeUtilisateur(intrus, async (client) => {
        expect(await refuse(
          client,
          'insert into public.church_groups (church_id, name) values ($1, $2)',
          [decor.bethel, 'Groupe pris de force'],
        )).toMatch(/row-level security/)
      })
    }
  })

  it('clôture une cohorte — et la clôture par une autre église ne touche rien, sans rien lever', async () => {
    const decor = await monterDecor()

    // Le refus silencieux, mesuré en premier : c'est celui qu'une application
    // qui ne lirait que l'erreur prendrait pour un succès.
    await commeUtilisateur(decor.bruno, async (client) => {
      const { rowCount } = await client.query(
        `update public.church_groups set status = 'closed' where id = $1`,
        [decor.cohorteOuverte],
      )
      expect(rowCount).toBe(0)
    })

    await commeUtilisateur(decor.pauline, async (client) => {
      const { rowCount } = await client.query(
        `update public.church_groups set status = 'closed' where id = $1`,
        [decor.cohorteOuverte],
      )
      expect(rowCount).toBe(1)
    })
  })

  it('ne peut pas déplacer une cohorte vers une autre église', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      // `church_id` n'est pas dans le `grant update` : le refus vient des
      // droits, et il est donc total — pas seulement pour les églises d'autrui.
      expect(await refuse(
        client,
        'update public.church_groups set church_id = $1 where id = $2',
        [decor.emmaus, decor.cohorteOuverte],
      )).toMatch(/permission denied/)

      // Témoin : la date, elle, se corrige.
      const { rowCount } = await client.query(
        `update public.church_groups set ends_on = '2027-01-31' where id = $1`,
        [decor.cohorteOuverte],
      )
      expect(rowCount).toBe(1)
    })
  })

  it('lit tous les membres de son église, et aucun de l’église voisine', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.pauline, async (client) => {
      const bethel = await client.query('select user_id from public.church_members where church_id = $1', [decor.bethel])
      expect(bethel.rowCount).toBe(5)
      const emmaus = await client.query('select user_id from public.church_members where church_id = $1', [decor.emmaus])
      expect(emmaus.rowCount).toBe(0)
    })

    // Témoin inverse : Bruno voit les siens, pas ceux de Pauline.
    await commeUtilisateur(decor.bruno, async (client) => {
      const bethel = await client.query('select user_id from public.church_members where church_id = $1', [decor.bethel])
      expect(bethel.rowCount).toBe(0)
      const emmaus = await client.query('select user_id from public.church_members where church_id = $1', [decor.emmaus])
      expect(emmaus.rowCount).toBe(1)
    })

    // Et un membre ordinaire ne lit que sa propre ligne : la lecture du
    // responsable n'a pas déteint sur l'église entière.
    await commeUtilisateur(decor.youssef, async (client) => {
      const { rows } = await client.query<{ user_id: string }>(
        'select user_id from public.church_members where church_id = $1', [decor.bethel],
      )
      expect(rows).toEqual([{ user_id: decor.youssef.id }])
    })
  })

  it('nomme un mentor — mais ne peut pas écrire `admin`', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const promu = await client.query(
        `update public.church_members set role = 'mentor' where church_id = $1 and user_id = $2`,
        [decor.bethel, decor.youssef.id],
      )
      expect(promu.rowCount).toBe(1)

      // `admin` reste dans la contrainte `check` de la table, et aucun chemin
      // de ce dépôt ne peut l'écrire. C'est l'ADR-007 : l'autorité de
      // plateforme est `tandem_moderators`, pas un rôle d'église.
      expect(await refuse(
        client,
        `update public.church_members set role = 'admin' where church_id = $1 and user_id = $2`,
        [decor.bethel, decor.youssef.id],
      )).toMatch(/row-level security/)
    })

    // Et le responsable de l'autre église ne promeut personne ici : refus
    // silencieux, cette fois, parce qu'il vient du `using`.
    await commeUtilisateur(decor.bruno, async (client) => {
      const { rowCount } = await client.query(
        `update public.church_members set role = 'mentor' where church_id = $1 and user_id = $2`,
        [decor.bethel, decor.youssef.id],
      )
      expect(rowCount).toBe(0)
    })
  })

  it('retire une adhésion, mais ne touche pas à sa propre ligne', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const retire = await client.query(
        `update public.church_members set status = 'revoked' where church_id = $1 and user_id = $2`,
        [decor.bethel, decor.youssef.id],
      )
      expect(retire.rowCount).toBe(1)

      // Se rétrograder ferait une église sans pilote, réparable seulement par
      // SQL sanctionné. Refus silencieux : c'est le `using` qui l'écarte.
      const soi = await client.query(
        `update public.church_members set role = 'member' where church_id = $1 and user_id = $2`,
        [decor.bethel, decor.pauline.id],
      )
      expect(soi.rowCount).toBe(0)
    })
  })

  it('range un membre dans une cohorte — jamais un étranger, jamais dans une cohorte fermée', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const range = await client.query(
        'insert into public.group_members (group_id, user_id) values ($1, $2)',
        [decor.cohorteOuverte, decor.lea.id],
      )
      expect(range.rowCount).toBe(1)

      const refus: [string, string][] = [
        [decor.cohorteOuverte, decor.bruno.id],
        [decor.cohorteTerminee, decor.lea.id],
        [decor.cohorteClose, decor.lea.id],
      ]
      for (const [groupe, personne] of refus) {
        expect(await refuse(
          client,
          'insert into public.group_members (group_id, user_id) values ($1, $2)',
          [groupe, personne],
        )).toMatch(/row-level security/)
      }
    })
  })

  it('laisse partir : on quitte une cohorte sans demander la permission', async () => {
    const decor = await monterDecor()
    await commeService(async (client) => {
      await client.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [decor.cohorteOuverte, decor.lea.id])
    })

    await commeUtilisateur(decor.youssef, async (client) => {
      // Celui qui n'est ni le membre ni le responsable ne retire personne.
      const { rowCount } = await client.query(
        'delete from public.group_members where group_id = $1 and user_id = $2',
        [decor.cohorteOuverte, decor.lea.id],
      )
      expect(rowCount).toBe(0)
    })

    await commeUtilisateur(decor.lea, async (client) => {
      const { rowCount } = await client.query(
        'delete from public.group_members where group_id = $1 and user_id = $2',
        [decor.cohorteOuverte, decor.lea.id],
      )
      expect(rowCount).toBe(1)
    })
  })
})

describe('Le lien d’invitation', () => {
  it('s’émet depuis une église active, et pas depuis une église en attente', async () => {
    const decor = await monterDecor()

    await commeUtilisateur(decor.pauline, async (client) => {
      const { rows, rowCount } = await client.query<{ token: string; max_uses: number }>(
        `insert into public.church_invitations (church_id, created_by) values ($1, $2)
         returning token, max_uses`,
        [decor.bethel, decor.pauline.id],
      )
      expect(rowCount).toBe(1)
      expect(rows[0].token).toHaveLength(48)
      expect(rows[0].max_uses).toBe(50)
    })

    // Le premier des deux actes liants : une église en attente prépare, elle
    // n'invite pas. Chantal est pourtant pleinement responsable de la sienne.
    await commeUtilisateur(decor.chantal, async (client) => {
      expect(await refuse(
        client,
        'insert into public.church_invitations (church_id, created_by) values ($1, $2)',
        [decor.enAttente, decor.chantal.id],
      )).toMatch(/row-level security/)

      // Témoin : elle peut, elle, créer un groupe. « Préparer est libre. »
      const groupe = await client.query(
        'insert into public.church_groups (church_id, name) values ($1, $2)',
        [decor.enAttente, 'Cohorte préparée'],
      )
      expect(groupe.rowCount).toBe(1)
    })
  })

  it('n’est pas émis par un membre, ni au nom de quelqu’un d’autre', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.marc, async (client) => {
      expect(await refuse(
        client,
        'insert into public.church_invitations (church_id, created_by) values ($1, $2)',
        [decor.bethel, decor.marc.id],
      )).toMatch(/row-level security/)
    })
    await commeUtilisateur(decor.pauline, async (client) => {
      expect(await refuse(
        client,
        'insert into public.church_invitations (church_id, created_by) values ($1, $2)',
        [decor.bethel, decor.bruno.id],
      )).toMatch(/row-level security/)
    })
  })

  it('ne vise pas la cohorte d’une autre église, ni une cohorte fermée', async () => {
    const decor = await monterDecor()
    const cohorteEmmaus = await commeService(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.church_groups (church_id, name) values ($1, 'Chez Bruno') returning id`,
        [decor.emmaus],
      )
      return rows[0].id
    })
    await commeUtilisateur(decor.pauline, async (client) => {
      for (const groupe of [cohorteEmmaus, decor.cohorteTerminee, decor.cohorteClose]) {
        expect(await refuse(
          client,
          'insert into public.church_invitations (church_id, group_id, created_by) values ($1, $2, $3)',
          [decor.bethel, groupe, decor.pauline.id],
        )).toMatch(/row-level security/)
      }
      // Témoin : la cohorte ouverte de sa propre église.
      const { rowCount } = await client.query(
        'insert into public.church_invitations (church_id, group_id, created_by) values ($1, $2, $3)',
        [decor.bethel, decor.cohorteOuverte, decor.pauline.id],
      )
      expect(rowCount).toBe(1)
    })
  })

  it('ne se prolonge pas : la péremption est plafonnée à 90 jours par la base', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      expect(await refuse(
        client,
        `insert into public.church_invitations (church_id, created_by, expires_at)
         values ($1, $2, timezone('utc', now()) + interval '2 years')`,
        [decor.bethel, decor.pauline.id],
      )).toMatch(/church_invitations_peremption/)

      // Témoin : 60 jours passent.
      const { rowCount } = await client.query(
        `insert into public.church_invitations (church_id, created_by, expires_at)
         values ($1, $2, timezone('utc', now()) + interval '60 days')`,
        [decor.bethel, decor.pauline.id],
      )
      expect(rowCount).toBe(1)
    })
  })

  it('garde son jeton : personne d’autre que le responsable de l’église ne le lit', async () => {
    const decor = await monterDecor()
    for (const curieux of [decor.marc, decor.youssef, decor.bruno]) {
      await commeUtilisateur(curieux, async (client) => {
        const { rowCount } = await client.query('select token from public.church_invitations where church_id = $1', [decor.bethel])
        expect(rowCount).toBe(0)
      })
    }
    await commeUtilisateur(decor.pauline, async (client) => {
      const { rowCount } = await client.query('select token from public.church_invitations where church_id = $1', [decor.bethel])
      expect(rowCount).toBe(4)
    })
  })

  it('se révoque, et ne se réécrit pas', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const { rowCount } = await client.query(
        `update public.church_invitations set status = 'revoked' where church_id = $1`,
        [decor.bethel],
      )
      expect(rowCount).toBe(4)

      expect(await refuse(client, `update public.church_invitations set max_uses = 500 where church_id = $1`, [decor.bethel]))
        .toMatch(/permission denied/)
      expect(await refuse(client, `update public.church_invitations set token = 'choisi' where church_id = $1`, [decor.bethel]))
        .toMatch(/permission denied/)
    })

    await commeUtilisateur(decor.bruno, async (client) => {
      const { rowCount } = await client.query(
        `update public.church_invitations set status = 'revoked' where church_id = $1`,
        [decor.bethel],
      )
      expect(rowCount).toBe(0)
    })
  })
})

describe('Rejoindre une communauté', () => {
  it('fait entrer comme `member`, et consomme une place', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        'select public.rejoindre_une_communaute($1) as id', [decor.jetonBethel],
      )
      expect(rows[0].id).toBe(decor.bethel)

      const membre = await constater<{ role: string; status: string }>(
        client,
        'select role, status from public.church_members where church_id = $1 and user_id = $2',
        [decor.bethel, decor.ines.id],
      )
      // Jamais `mentor`, jamais `leader` : un lien qui circule ne fabrique pas
      // d'adulte référent.
      expect(membre).toEqual([{ role: 'member', status: 'active' }])

      const lien = await constater<{ uses: number }>(
        client, 'select uses from public.church_invitations where token = $1', [decor.jetonBethel],
      )
      expect(lien[0].uses).toBe(1)
    })
  })

  it('est idempotente : rejoindre deux fois n’use qu’une place', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.ines, async (client) => {
      await client.query('select public.rejoindre_une_communaute($1)', [decor.jetonBethel])
      const { rows } = await client.query<{ id: string }>(
        'select public.rejoindre_une_communaute($1) as id', [decor.jetonBethel],
      )
      expect(rows[0].id).toBe(decor.bethel)

      const lien = await constater<{ uses: number }>(
        client, 'select uses from public.church_invitations where token = $1', [decor.jetonBethel],
      )
      // Un compteur qui compterait les clics au lieu des personnes épuiserait
      // un lien avec une seule assemblée.
      expect(lien[0].uses).toBe(1)
    })
  })

  it('range dans la cohorte quand le lien en désigne une', async () => {
    const decor = await monterDecor()
    const jetonCohorte = await commeService(async (client) => {
      const { rows } = await client.query<{ token: string }>(
        `insert into public.church_invitations (church_id, group_id, created_by)
         values ($1, $2, $3) returning token`,
        [decor.bethel, decor.cohorteOuverte, decor.pauline.id],
      )
      return rows[0].token
    })

    await commeUtilisateur(decor.ines, async (client) => {
      await client.query('select public.rejoindre_une_communaute($1)', [jetonCohorte])
      const dansLaCohorte = await constater(
        client,
        'select user_id from public.group_members where group_id = $1 and user_id = $2',
        [decor.cohorteOuverte, decor.ines.id],
      )
      expect(dansLaCohorte).toHaveLength(1)
    })
  })

  it('refuse une cohorte terminée, une cohorte close, une église non active, un lien révoqué', async () => {
    const decor = await monterDecor()
    const refus: [string, RegExp][] = [
      [decor.jetonTerminee, /cohorte_terminee/],
      [decor.jetonClose, /cohorte_close/],
      [decor.jetonEnAttente, /communaute_inactive/],
      [decor.jetonRevoque, /invitation_introuvable/],
      ['jeton-qui-n-existe-pas', /invitation_introuvable/],
    ]
    await commeUtilisateur(decor.ines, async (client) => {
      for (const [jeton, motif] of refus) {
        expect(await refuse(client, 'select public.rejoindre_une_communaute($1)', [jeton])).toMatch(motif)
      }
      // Témoin dans la même transaction : le lien sain, lui, passe.
      const { rows } = await client.query<{ id: string }>('select public.rejoindre_une_communaute($1) as id', [decor.jetonBethel])
      expect(rows[0].id).toBe(decor.bethel)
    })
  })

  it('refuse une adhésion révoquée : on ne revient pas par un lien qui circule', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.sortie, async (client) => {
      expect(await refuse(client, 'select public.rejoindre_une_communaute($1)', [decor.jetonBethel]))
        .toMatch(/adhesion_revoquee/)
    })
  })

  it('refuse une seconde communauté, et refuse sans identité', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.bruno, async (client) => {
      expect(await refuse(client, 'select public.rejoindre_une_communaute($1)', [decor.jetonBethel]))
        .toMatch(/deja_dans_une_communaute/)
    })
    await commeAuthentifieSansIdentite(async (client) => {
      expect(await refuse(client, 'select public.rejoindre_une_communaute($1)', [decor.jetonBethel]))
        .toMatch(/identite_absente/)
    })
  })

  it('épuise le lien au plafond', async () => {
    const decor = await monterDecor()
    const jetonUnique = await commeService(async (client) => {
      const { rows } = await client.query<{ token: string }>(
        `insert into public.church_invitations (church_id, created_by, max_uses, uses)
         values ($1, $2, 1, 1) returning token`,
        [decor.bethel, decor.pauline.id],
      )
      return rows[0].token
    })
    await commeUtilisateur(decor.ines, async (client) => {
      expect(await refuse(client, 'select public.rejoindre_une_communaute($1)', [jetonUnique]))
        .toMatch(/invitation_epuisee/)
    })
  })
})

describe('Les affectations de mentor', () => {
  it('naît « pending » — le responsable propose, il n’accepte pas', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const { rows, rowCount } = await client.query<{ id: string; status: string }>(
        `insert into public.mentor_assignments (church_id, group_id, mentor_id, participant_id)
         values ($1, $2, $3, $4) returning id, status`,
        [decor.bethel, decor.cohorteOuverte, decor.marc.id, decor.lea.id],
      )
      expect(rowCount).toBe(1)
      expect(rows[0].status).toBe('pending')
      const affectation = rows[0].id

      // Le doc 06 : « mentor proposé par l'église et accepté par le jeune ».
      // C'est la politique qui le tient, pas l'écran.
      expect(await refuse(
        client, `update public.mentor_assignments set status = 'active' where id = $1`, [affectation],
      )).toMatch(/row-level security/)

      // Témoin : ce que le responsable PEUT faire de cette même ligne.
      const suspendu = await client.query(
        `update public.mentor_assignments set status = 'paused' where id = $1`, [affectation],
      )
      expect(suspendu.rowCount).toBe(1)
    })
  })

  it('n’accepte que le participant, et le mentor ne peut que mettre fin', async () => {
    const decor = await monterDecor()
    const affectation = await commeService(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.mentor_assignments (church_id, mentor_id, participant_id)
         values ($1, $2, $3) returning id`,
        [decor.bethel, decor.marc.id, decor.lea.id],
      )
      return rows[0].id
    })

    await commeUtilisateur(decor.marc, async (client) => {
      expect(await refuse(
        client, `update public.mentor_assignments set status = 'active' where id = $1`, [affectation],
      )).toMatch(/row-level security/)
      const fin = await client.query(`update public.mentor_assignments set status = 'ended' where id = $1`, [affectation])
      expect(fin.rowCount).toBe(1)
    })

    await commeUtilisateur(decor.lea, async (client) => {
      const acceptee = await client.query(`update public.mentor_assignments set status = 'active' where id = $1`, [affectation])
      expect(acceptee.rowCount).toBe(1)
    })

    // Un tiers de la même église n'y touche pas, et ne la lit même pas.
    await commeUtilisateur(decor.youssef, async (client) => {
      const { rowCount } = await client.query(
        `update public.mentor_assignments set status = 'ended' where id = $1`, [affectation],
      )
      expect(rowCount).toBe(0)
      const lue = await client.query('select 1 from public.mentor_assignments where id = $1', [affectation])
      expect(lue.rowCount).toBe(0)
    })
  })

  it('exige un mentor de cette église, un participant de cette église, et une cohorte ouverte', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      // Youssef est membre, pas mentor.
      expect(await refuse(
        client,
        'insert into public.mentor_assignments (church_id, mentor_id, participant_id) values ($1, $2, $3)',
        [decor.bethel, decor.youssef.id, decor.lea.id],
      )).toMatch(/row-level security/)

      // Bruno est responsable ailleurs : étranger ici, des deux côtés.
      expect(await refuse(
        client,
        'insert into public.mentor_assignments (church_id, mentor_id, participant_id) values ($1, $2, $3)',
        [decor.bethel, decor.marc.id, decor.bruno.id],
      )).toMatch(/row-level security/)

      // Une cohorte terminée ne reçoit plus d'affectation.
      expect(await refuse(
        client,
        'insert into public.mentor_assignments (church_id, group_id, mentor_id, participant_id) values ($1, $2, $3, $4)',
        [decor.bethel, decor.cohorteTerminee, decor.marc.id, decor.lea.id],
      )).toMatch(/row-level security/)

      // Témoin : la même affectation, sans cohorte, passe.
      const { rowCount } = await client.query(
        'insert into public.mentor_assignments (church_id, mentor_id, participant_id) values ($1, $2, $3)',
        [decor.bethel, decor.marc.id, decor.lea.id],
      )
      expect(rowCount).toBe(1)
    })
  })

  it('n’affecte personne dans une église qui n’a pas été activée', async () => {
    const decor = await monterDecor()
    // Le troisième acte liant : mettre un adulte en face d'un mineur n'attend
    // pas moins qu'une église regardée par un humain.
    await commeService(async (client) => {
      await client.query(
        `insert into public.church_members (church_id, user_id, role, status) values
           ($1, $2, 'mentor', 'active'), ($1, $3, 'member', 'active')`,
        [decor.enAttente, decor.marc.id, decor.ines.id],
      )
    })
    await commeUtilisateur(decor.chantal, async (client) => {
      expect(await refuse(
        client,
        'insert into public.mentor_assignments (church_id, mentor_id, participant_id) values ($1, $2, $3)',
        [decor.enAttente, decor.marc.id, decor.ines.id],
      )).toMatch(/row-level security/)
    })
  })
})

describe('Ce que ce chantier n’ouvre pas', () => {
  it('ne donne au responsable aucun accès au contenu spirituel de ses membres', async () => {
    const decor = await monterDecor()
    await commeService(async (client) => {
      await client.query(
        `insert into public.journal_entries (user_id, text) values ($1, 'ce que je n''ai dit à personne')`,
        [decor.lea.id],
      )
      await client.query(
        `insert into public.weekly_checkins (user_id, week_key, state) values ($1, '2026-W35', 'rude')`,
        [decor.lea.id],
      )
      await client.query(
        `insert into public.session_progress (user_id, journey_id, session_id)
         values ($1, 'repartir-avec-jesus', 'repartir-01')`,
        [decor.lea.id],
      )
    })
    const tables = ['journal_entries', 'weekly_checkins', 'session_progress']

    // Le responsable a le plus de raisons de croire qu'il a le droit : c'est
    // sa communauté, sa cohorte, et il lit déjà la liste de ses membres. Le
    // mentor non plus — l'issue #16 décidera de ce qu'il verra, et de rien
    // qu'on lui aurait donné sans le décider.
    for (const curieux of [decor.pauline, decor.marc]) {
      await commeUtilisateur(curieux, async (client) => {
        for (const table of tables) {
          const { rowCount } = await client.query(`select 1 from public.${table} where user_id = $1`, [decor.lea.id])
          expect(rowCount).toBe(0)
        }
      })
    }

    // Témoin : Léa, elle, lit bien les siens. Zéro ligne plus haut voulait donc
    // dire « la politique a discriminé », pas « le décor était vide ».
    await commeUtilisateur(decor.lea, async (client) => {
      for (const table of tables) {
        const { rowCount } = await client.query(`select 1 from public.${table} where user_id = $1`, [decor.lea.id])
        expect(rowCount).toBe(1)
      }
    })
  })
})

describe('La suppression de compte emporte la vie communautaire', () => {
  it('efface l’adhésion, les appartenances et les affectations', async () => {
    const decor = await monterDecor()
    await commeService(async (client) => {
      await client.query('insert into public.group_members (group_id, user_id) values ($1, $2)', [decor.cohorteOuverte, decor.lea.id])
      await client.query(
        'insert into public.mentor_assignments (church_id, mentor_id, participant_id) values ($1, $2, $3)',
        [decor.bethel, decor.marc.id, decor.lea.id],
      )
    })

    await commeUtilisateur(decor.lea, async (client) => {
      await client.query('select public.supprimer_mon_compte()')
      const restes = await constater<{ table_name: string; n: string }>(
        client,
        `select 'church_members' as table_name, count(*)::text as n from public.church_members where user_id = $1
         union all select 'group_members', count(*)::text from public.group_members where user_id = $1
         union all select 'mentor_assignments', count(*)::text from public.mentor_assignments where mentor_id = $1 or participant_id = $1`,
        [decor.lea.id],
      )
      expect(restes.map((r) => r.n)).toEqual(['0', '0', '0'])
    })
  })

  it('emporte les liens d’invitation émis : une URL vivante ne survit pas à son émetteur', async () => {
    const decor = await monterDecor()
    await commeUtilisateur(decor.pauline, async (client) => {
      const avant = await client.query('select 1 from public.church_invitations where created_by = $1', [decor.pauline.id])
      expect(avant.rowCount).toBe(4)

      await client.query('select public.supprimer_mon_compte()')

      // Plus personne ne pourrait ni la voir ni la révoquer : la lecture est
      // réservée aux responsables, et celui-ci n'est plus là.
      const apres = await constater(client, 'select 1 from public.church_invitations where created_by = $1', [decor.pauline.id])
      expect(apres).toHaveLength(0)
    })
  })
})
