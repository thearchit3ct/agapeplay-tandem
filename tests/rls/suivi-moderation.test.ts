/**
 * Le suivi d'un signalement : qui peut le faire avancer, et ce qu'il en reste.
 *
 * `moderation.test.ts` s'arrête à la lecture, et note l'écart : « la colonne
 * `status` reste inatteignable par l'API ». Ce fichier-ci mesure son ouverture,
 * et elle ne se mesure pas d'une seule façon — c'est tout l'intérêt :
 *
 * - un modérateur qui vise une **autre colonne** se heurte au grant, qui porte
 *   sur `status` seul → **exception** ;
 * - un non-modérateur qui vise `status` a bien le droit sur la colonne, mais
 *   aucune ligne ne satisfait le `using` → **zéro ligne, sans exception**.
 *
 * Confondre les deux est le piège le plus coûteux de cette suite : un UPDATE
 * refusé par un `using` ne lève rien. Un test qui attendrait une erreur passerait
 * au vert sans avoir rien mesuré. Chaque assertion négative compte donc
 * explicitement `rowCount`, ou attend explicitement une exception — jamais l'un
 * pour l'autre.
 *
 * Sur le journal d'audit, le test qui compte est « il enregistre le bon
 * modérateur ». Le trigger est `security definer` — obligatoirement, car
 * `authenticated` n'a aucun droit d'écriture sur le journal — et dans une
 * fonction `security definer` `current_user` désigne le **propriétaire**. Un
 * journal alimenté par `current_user` enregistrerait `postgres` à chaque ligne
 * et serait inutile, sans jamais échouer. Ce test est ce qui distingue une trace
 * d'un compteur.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { Client } from 'pg'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

let moderateur: Utilisateur
let signalante: Utilisateur
let visee: Utilisateur
let ordinaire: Utilisateur
let tandemActif: string
let tandemBloque: string
let tandemSansSignalement: string
let signalementActif: string
let signalementSansMessage: string

/**
 * Agir comme un utilisateur authentifié **en validant** la transaction.
 *
 * `commeUtilisateur` annule tout à la fin, ce qui est exactement ce qu'on veut
 * partout ailleurs. Mais deux tests ici ont besoin qu'une écriture survive à la
 * connexion : celui qui vérifie qu'une ligne d'audit résiste à la suppression du
 * compte concerné, et ceux qui relisent l'audit depuis une autre session. D'où
 * ce jumeau, qui reprend la garde d'identité du harnais — sans elle, `auth.uid()`
 * vaudrait NULL et le journal enregistrerait consciencieusement personne.
 */
const commeUtilisateurDurable = async <T>(
  utilisateur: Utilisateur,
  action: (client: Client) => Promise<T>,
): Promise<T> => {
  const client = new Client({
    connectionString: process.env.RLS_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  })
  await client.connect()
  try {
    const claims = JSON.stringify({ sub: utilisateur.id, email: utilisateur.email, role: 'authenticated' })
    await client.query('select set_config($1, $2, false)', ['request.jwt.claims', claims])
    await client.query('set role authenticated')

    const controle = await client.query<{ role: string; uid: string | null }>(
      'select current_user as role, auth.uid()::text as uid',
    )
    if (controle.rows[0].role !== 'authenticated') {
      throw new Error(`harnais cassé : rôle « ${controle.rows[0].role} », RLS contournée`)
    }
    if (controle.rows[0].uid !== utilisateur.id) {
      throw new Error(`harnais cassé : auth.uid() = ${controle.rows[0].uid}, attendu ${utilisateur.id}`)
    }

    return await action(client)
  } finally {
    await client.end()
  }
}

beforeAll(async () => {
  await commeService(async (client) => {
    const suffixe = marque()
    moderateur = await creerUtilisateur(client, `mod-suivi-${suffixe}@test.local`)
    signalante = await creerUtilisateur(client, `signalante-suivi-${suffixe}@test.local`)
    visee = await creerUtilisateur(client, `visee-suivi-${suffixe}@test.local`)
    ordinaire = await creerUtilisateur(client, `ordinaire-suivi-${suffixe}@test.local`)

    await client.query('insert into public.tandem_moderators (user_id) values ($1)', [moderateur.id])

    const actif = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [signalante.id, visee.id],
    )
    tandemActif = actif.rows[0].id

    const message = await client.query<{ id: string }>(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'le message signalé') returning id",
      [tandemActif, visee.id],
    )
    const rapport = await client.query<{ id: string }>(
      "insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason) values ($1, $2, $3, 'À traiter.') returning id",
      [tandemActif, signalante.id, message.rows[0].id],
    )
    signalementActif = rapport.rows[0].id

    // Un tandem déjà bloqué, inséré directement en `blocked` : c'est le cas qui
    // exige un trigger `before insert` et pas seulement `before update`.
    const bloque = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $1) returning id",
      [signalante.id, ordinaire.id],
    )
    tandemBloque = bloque.rows[0].id
    const sansMessage = await client.query<{ id: string }>(
      "insert into public.tandem_reports (tandem_id, reporter_id, reason) values ($1, $2, 'Gêne diffuse, relation déjà bloquée.') returning id",
      [tandemBloque, signalante.id],
    )
    signalementSansMessage = sansMessage.rows[0].id

    // Le cas négatif de la vue : un tandem que personne n'a signalé. Sans lui,
    // une vue qui rendrait *tous* les tandems passerait tous les autres tests.
    const jamais = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [visee.id, ordinaire.id],
    )
    tandemSansSignalement = jamais.rows[0].id
  })
})

const statutDe = (id: string) =>
  commeService(async (client) => {
    const { rows } = await client.query<{ status: string; resolved_at: string | null }>(
      'select status, resolved_at from public.tandem_reports where id = $1',
      [id],
    )
    return rows[0]
  })

describe('faire avancer un signalement', () => {
  it('TÉMOIN — le modérateur lit bien les signalements', async () => {
    // Si ce témoin tombe, c'est le harnais ou la migration précédente qui a
    // lâché, et rien de ce qui suit n'est concluant.
    const vus = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query('select id from public.tandem_reports where id = $1', [signalementActif])
      return rows
    })
    expect(vus).toHaveLength(1)
  })

  it('le modérateur fait passer un signalement à « reviewing »', async () => {
    // La promesse du lot : deux modérateurs ne traitent plus le même
    // signalement sans le savoir.
    const lignes = await commeUtilisateur(moderateur, async (client) => {
      const res = await client.query("update public.tandem_reports set status = 'reviewing' where id = $1", [
        signalementActif,
      ])
      const { rows } = await client.query<{ status: string }>(
        'select status from public.tandem_reports where id = $1',
        [signalementActif],
      )
      return { touchees: res.rowCount, statut: rows[0].status }
    })

    expect(lignes).toEqual({ touchees: 1, statut: 'reviewing' })
  })

  it('… et clore un signalement horodate la clôture sans qu’il l’écrive', async () => {
    // `resolved_at` n'est accordé à personne en écriture : le trigger le pose.
    // Une date de clôture qu'on peut écrire à la main est une déclaration, pas
    // une date.
    const vu = await commeUtilisateur(moderateur, async (client) => {
      await client.query("update public.tandem_reports set status = 'resolved' where id = $1", [signalementActif])
      const { rows } = await client.query<{ status: string; resolved_at: string | null; ecart: number | null }>(
        "select status, resolved_at, extract(epoch from (timezone('utc', now()) - resolved_at)) as ecart from public.tandem_reports where id = $1",
        [signalementActif],
      )
      return rows[0]
    })

    expect(vu.status).toBe('resolved')
    // La non-nullité d'abord, et ce n'est pas du zèle : la vérification par
    // mutation a montré que sans elle ce test restait vert alors que le trigger
    // ne posait plus rien. `resolved_at` NULL rend un écart NULL, que
    // `Number(null)` transforme en 0 — donc « moins de 60 secondes ».
    expect(vu.resolved_at).not.toBeNull()
    expect(Number(vu.ecart)).toBeLessThan(60)
  })

  it('⭐ le modérateur ne modifie PAS le motif du signalement', async () => {
    // Le test le plus important du lot côté écriture. Une politique restreint
    // des lignes, jamais des colonnes : `grant update` sur la table aurait
    // laissé un modérateur réécrire le témoignage de la personne qui a signalé,
    // et aucune politique n'aurait pu l'en empêcher. Le refus vient du grant,
    // donc il **lève** — et le message parle de « table », mesuré, pas supposé.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set reason = 'motif réécrit' where id = $1", [signalementActif]),
      ),
    ).rejects.toThrow(/permission denied/i)

    expect((await statutDe(signalementActif)).status).not.toBe('motif réécrit')
  })

  it('… ni le message qu’il désigne', async () => {
    // Deuxième colonne, et ce n'est pas de la redondance : avec une seule, un
    // refus accidentel (une colonne oubliée, une contrainte) se confondrait
    // avec la borne cherchée. Déplacer `message_id` reviendrait à faire porter
    // un signalement sur un autre message que celui dénoncé.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query('update public.tandem_reports set message_id = null where id = $1', [signalementActif]),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('… ni glisser une colonne fermée à côté du statut', async () => {
    // La tentative mixte : celle qui espère qu'un droit accordé sur une colonne
    // couvre la ligne entière.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set status = 'open', reason = 'X' where id = $1", [
          signalementActif,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('un utilisateur ordinaire ne fait avancer aucun signalement — zéro ligne, sans erreur', async () => {
    // Ici le grant sur la colonne `status` est bien accordé à `authenticated` :
    // c'est la politique, et elle seule, qui discrimine. Elle ne lève donc rien.
    // Compter les lignes est la seule mesure valide.
    const touchees = await commeUtilisateur(ordinaire, async (client) => {
      const res = await client.query("update public.tandem_reports set status = 'resolved'")
      return res.rowCount
    })

    expect(touchees).toBe(0)
  })

  it('⭐ l’auteur du signalement ne clôt pas le sien non plus', async () => {
    // Le cas qui distingue « modérateur » de « concerné ». Elle **lit** son
    // signalement (`reports_select_reporter`), donc l'UPDATE trouve bien la
    // ligne : seul le `using` de `reports_update_moderator` l'arrête. Sans le
    // témoin de lecture qui suit, le zéro ne prouverait rien.
    const mesure = await commeUtilisateur(signalante, async (client) => {
      const lues = await client.query('select id from public.tandem_reports where id = $1', [signalementActif])
      const res = await client.query("update public.tandem_reports set status = 'open' where id = $1", [
        signalementActif,
      ])
      return { lues: lues.rowCount, touchees: res.rowCount }
    })

    expect(mesure.lues).toBe(1) // TÉMOIN : la ligne lui est bien visible.
    expect(mesure.touchees).toBe(0)
  })
})

describe('le journal d’audit', () => {
  it('⭐ enregistre le modérateur qui a agi, pas le propriétaire du trigger', async () => {
    // Le piège nommé de ce projet : le trigger **doit** être `security definer`
    // (sinon aucun droit d'écrire), et dans une fonction `security definer`
    // `current_user` vaut le propriétaire. Un journal bâti dessus dirait
    // « postgres » à chaque ligne, sans jamais échouer.
    const trace = await commeUtilisateur(moderateur, async (client) => {
      await client.query("update public.tandem_reports set status = 'reviewing' where id = $1", [
        signalementSansMessage,
      ])
      const { rows } = await client.query<{
        moderator_id: string | null
        from_status: string
        to_status: string
        report_id: string
        ecart: number
      }>(
        `select moderator_id::text, from_status, to_status, report_id::text,
                extract(epoch from (timezone('utc', now()) - changed_at)) as ecart
           from public.tandem_report_audit where report_id = $1`,
        [signalementSansMessage],
      )
      return rows
    })

    expect(trace).toHaveLength(1)
    expect(trace[0].moderator_id).toBe(moderateur.id)
    expect(trace[0].from_status).toBe('open')
    expect(trace[0].to_status).toBe('reviewing')
    expect(trace[0].report_id).toBe(signalementSansMessage)
    expect(Number(trace[0].ecart)).toBeLessThan(60)
  })

  it('garde une ligne par changement, dans l’ordre', async () => {
    // Deux modérateurs successifs sur le même signalement : c'est le scénario
    // qui motive tout le lot, et l'audit doit le raconter en entier.
    const second = await commeService(async (client) => {
      const utilisateur = await creerUtilisateur(client, `mod2-${marque()}@test.local`)
      await client.query('insert into public.tandem_moderators (user_id) values ($1)', [utilisateur.id])
      return utilisateur
    })

    await commeUtilisateurDurable(moderateur, (client) =>
      client.query("update public.tandem_reports set status = 'reviewing' where id = $1", [signalementActif]),
    )
    await commeUtilisateurDurable(second, (client) =>
      client.query("update public.tandem_reports set status = 'resolved' where id = $1", [signalementActif]),
    )

    const trace = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query<{ moderator_id: string; from_status: string; to_status: string }>(
        'select moderator_id::text, from_status, to_status from public.tandem_report_audit where report_id = $1 order by changed_at',
        [signalementActif],
      )
      return rows
    })

    // `open` et non `resolved` en point de départ : les tests précédents ont
    // bien clos ce signalement, mais `commeUtilisateur` annule sa transaction.
    // Seules les écritures durables comptent ici — et c'est ce que le journal
    // enregistre, ce qui est la bonne définition d'une décision.
    expect(trace.length).toBeGreaterThanOrEqual(2)
    expect(trace.slice(-2)).toEqual([
      { moderator_id: moderateur.id, from_status: 'open', to_status: 'reviewing' },
      { moderator_id: second.id, from_status: 'reviewing', to_status: 'resolved' },
    ])
  })

  it('n’enregistre rien quand le statut ne bouge pas', async () => {
    // Un UPDATE qui repose la même valeur n'est pas une décision. Sans cette
    // borne, le journal se remplirait de bruit et la relecture d'un dossier
    // deviendrait illisible.
    const avantApres = await commeUtilisateurDurable(moderateur, async (client) => {
      const avant = await client.query('select count(*)::int as n from public.tandem_report_audit where report_id = $1', [
        signalementActif,
      ])
      await client.query("update public.tandem_reports set status = 'resolved' where id = $1", [signalementActif])
      const apres = await client.query('select count(*)::int as n from public.tandem_report_audit where report_id = $1', [
        signalementActif,
      ])
      return { avant: avant.rows[0].n, apres: apres.rows[0].n }
    })

    expect(avantApres.apres).toBe(avantApres.avant)
  })

  it('⭐ personne ne modifie ni n’efface une ligne d’audit — pas même un modérateur', async () => {
    // La protection primaire est l'absence de grant : la tentative n'est même
    // pas formulable depuis un compte.
    for (const requete of [
      "update public.tandem_report_audit set to_status = 'open'",
      'delete from public.tandem_report_audit',
    ]) {
      await expect(
        commeUtilisateur(moderateur, (client) => client.query(requete)),
      ).rejects.toThrow(/permission denied/i)
    }
  })

  it('… ni personne n’y écrit directement', async () => {
    // Une trace que l'application peut écrire est une trace qu'elle peut
    // inventer. Le trigger est le seul chemin d'entrée.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query(
          "insert into public.tandem_report_audit (report_id, moderator_id, from_status, to_status) values ($1, $1, 'open', 'resolved')",
          [signalementActif],
        ),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('⭐ la garde tient même hors RLS, où l’absence de grant ne protège plus', async () => {
    // Sans ce test, l'immuabilité mesurée plus haut n'est qu'un test de *grant*
    // : elle redeviendrait verte à tort le jour où un `grant update` serait
    // ajouté par mégarde. Ici la RLS et les grants sont hors jeu — c'est le
    // trigger, et lui seul, qui refuse.
    for (const requete of [
      "update public.tandem_report_audit set to_status = 'open'",
      'delete from public.tandem_report_audit',
    ]) {
      // Apostrophe droite : c'est celle que `raise exception` émet, l'apostrophe
      // typographique du reste du dépôt ne correspondrait à rien.
      await expect(commeService((client) => client.query(requete))).rejects.toThrow(
        /journal d'audit : ses lignes ne se modifient ni ne s'effacent/i,
      )
    }
  })

  it('un utilisateur ordinaire ne lit rien du journal, l’auteur du signalement non plus', async () => {
    // Le journal dit qui a modéré quoi. L'ouvrir à la personne qui a signalé
    // lui livrerait l'identité des modérateurs — exactement ce que
    // l'invisibilité de `tandem_moderators` protège.
    for (const utilisateur of [ordinaire, signalante]) {
      const vu = await commeUtilisateur(utilisateur, async (client) => {
        const { rows } = await client.query('select id from public.tandem_report_audit')
        return rows
      })
      expect(vu).toEqual([])
    }
  })

  it('⭐ survit à la suppression du compte concerné', async () => {
    // Ce test tient une décision de schéma : le journal n'a **aucune** clé
    // étrangère. `tandem_reports.reporter_id` cascade depuis `auth.users` ; une
    // FK cascade effacerait donc l'audit avec le compte, et une FK stricte
    // ferait échouer l'effacement RGPD. La mesure ci-dessous fait les deux
    // constats d'un coup : le signalement disparaît, la trace reste.
    const decor = await commeService(async (client) => {
      const suffixe = marque()
      const partant = await creerUtilisateur(client, `partant-${suffixe}@test.local`)
      const autre = await creerUtilisateur(client, `autre-${suffixe}@test.local`)
      const tandem = await client.query<{ id: string }>(
        "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
        [partant.id, autre.id],
      )
      const rapport = await client.query<{ id: string }>(
        "insert into public.tandem_reports (tandem_id, reporter_id, reason) values ($1, $2, 'Signalement d’un compte qui partira.') returning id",
        [tandem.rows[0].id, partant.id],
      )
      return { partant, rapportId: rapport.rows[0].id }
    })

    await commeUtilisateurDurable(moderateur, (client) =>
      client.query("update public.tandem_reports set status = 'reviewing' where id = $1", [decor.rapportId]),
    )

    // TÉMOIN : la trace existe avant la suppression, sinon l'assertion finale
    // vérifierait la survie d'une ligne qui n'a jamais existé.
    const avant = await commeService(async (client) => {
      const { rows } = await client.query('select id from public.tandem_report_audit where report_id = $1', [
        decor.rapportId,
      ])
      return rows.length
    })
    expect(avant).toBe(1)

    await commeService((client) => client.query('delete from auth.users where id = $1', [decor.partant.id]))

    const apres = await commeService(async (client) => {
      const rapport = await client.query('select id from public.tandem_reports where id = $1', [decor.rapportId])
      const audit = await client.query('select id from public.tandem_report_audit where report_id = $1', [
        decor.rapportId,
      ])
      return { signalements: rapport.rows.length, traces: audit.rows.length }
    })

    expect(apres.signalements).toBe(0) // la cascade a bien joué
    expect(apres.traces).toBe(1) // et le journal lui a survécu
  })
})

describe('le contexte de la relation signalée', () => {
  const lireContexte = (lecteur: Utilisateur) =>
    commeUtilisateur(lecteur, async (client) => {
      const { rows } = await client.query<{ tandem_id: string; status: string }>(
        'select tandem_id::text, status from public.tandem_contexte_signale',
      )
      return rows
    })

  it('le modérateur voit l’état d’un tandem signalé', async () => {
    const vus = await lireContexte(moderateur)
    expect(vus.find((ligne) => ligne.tandem_id === tandemActif)?.status).toBe('active')
  })

  it('… et distingue une relation déjà bloquée', async () => {
    // C'est la raison d'être de la vue : un signalement sur une relation déjà
    // bloquée n'appelle pas la même décision qu'un signalement sur une relation
    // active.
    const vus = await lireContexte(moderateur)
    expect(vus.find((ligne) => ligne.tandem_id === tandemBloque)?.status).toBe('blocked')
  })

  it('⭐ … et sait DEPUIS QUAND elle est bloquée', async () => {
    // `created_at` date la relation, pas le blocage : un tandem né en janvier et
    // bloqué hier rendrait « janvier », ce qui n'est pas faux mais pire —
    // plausible. La colonne `blocked_at` a dû être ajoutée pour ça, et le
    // trigger qui l'alimente couvre l'INSERT parce que ce tandem-ci est né
    // directement `blocked`.
    const vu = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query<{ blocked_at: string | null; ecart: number | null; naissance: number }>(
        `select blocked_at,
                extract(epoch from (timezone('utc', now()) - blocked_at)) as ecart,
                extract(epoch from (timezone('utc', now()) - created_at)) as naissance
           from public.tandem_contexte_signale where tandem_id = $1`,
        [tandemBloque],
      )
      return rows[0]
    })

    expect(vu.blocked_at).not.toBeNull()
    expect(Number(vu.ecart)).toBeLessThan(600)
  })

  it('le déblocage efface la date : elle dit la durée du blocage en cours', async () => {
    // Garder la vieille date sur un tandem redevenu actif ferait mentir la
    // colonne. Mesuré via le participant qui a bloqué — le seul à pouvoir lever.
    const decor = await commeService(async (client) => {
      const suffixe = marque()
      const a = await creerUtilisateur(client, `debloqueur-${suffixe}@test.local`)
      const b = await creerUtilisateur(client, `debloque-${suffixe}@test.local`)
      const tandem = await client.query<{ id: string }>(
        "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $1) returning id",
        [a.id, b.id],
      )
      return { a, tandemId: tandem.rows[0].id }
    })

    const mesure = await commeUtilisateur(decor.a, async (client) => {
      const avant = await client.query<{ blocked_at: string | null }>(
        'select blocked_at from public.tandems where id = $1',
        [decor.tandemId],
      )
      await client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [
        decor.tandemId,
      ])
      const apres = await client.query<{ blocked_at: string | null }>(
        'select blocked_at from public.tandems where id = $1',
        [decor.tandemId],
      )
      return { avant: avant.rows[0].blocked_at, apres: apres.rows[0].blocked_at }
    })

    expect(mesure.avant).not.toBeNull() // TÉMOIN : le trigger avait bien posé la date
    expect(mesure.apres).toBeNull()
  })

  it('un signalement sans message précis donne quand même le contexte', async () => {
    // `message_id` est nullable, et c'est un cas courant : « gêne diffuse ». La
    // vue porte sur le tandem signalé, pas sur le message, donc ce cas-là est
    // servi — c'est précisément l'inverse du choix fait pour les messages, où
    // l'ouverture s'arrête au message désigné.
    const vus = await lireContexte(moderateur)
    expect(vus.map((ligne) => ligne.tandem_id)).toContain(tandemBloque)
  })

  it('⭐ ne montre pas les tandems que personne n’a signalés', async () => {
    // Sans ce cas négatif, une vue qui rendrait toute la table `tandems`
    // passerait tous les autres tests de ce bloc.
    const vus = await lireContexte(moderateur)
    expect(vus.map((ligne) => ligne.tandem_id)).not.toContain(tandemSansSignalement)
  })

  it('⭐ ne révèle jamais les participants', async () => {
    // L'assertion porte sur l'**ensemble des colonnes**, pas sur le contenu des
    // lignes : un `select t.*` glissé dans la vue un jour ajouterait
    // `participant_a_id`, `participant_b_id` et `blocked_by` sans faire rougir
    // un test qui n'interroge que `status`. La modération ne devient pas un
    // annuaire des relations.
    const colonnes = await commeService(async (client) => {
      const { rows } = await client.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'tandem_contexte_signale' order by column_name",
      )
      return rows.map((ligne) => ligne.column_name)
    })

    expect(colonnes).toEqual(['blocked_at', 'created_at', 'ended_at', 'status', 'tandem_id'])
  })

  it('⭐ reste fermée à un utilisateur ordinaire et à l’auteur du signalement', async () => {
    // La vue s'exécute hors RLS (`security_invoker = off`) : sans sa garde
    // interne, elle publierait l'état de tous les tandems signalés à n'importe
    // quel compte authentifié. Ce test est ce qui tient cette garde.
    for (const utilisateur of [ordinaire, signalante]) {
      expect(await lireContexte(utilisateur)).toEqual([])
    }
  })

  it('… et un modérateur radié n’y lit plus rien', async () => {
    // La garde est évaluée à chaque requête, comme la lecture des signalements.
    const ancien = await commeService(async (client) => {
      const utilisateur = await creerUtilisateur(client, `ancien-vue-${marque()}@test.local`)
      await client.query('insert into public.tandem_moderators (user_id) values ($1)', [utilisateur.id])
      return utilisateur
    })

    expect((await lireContexte(ancien)).length).toBeGreaterThan(0) // TÉMOIN

    await commeService((client) =>
      client.query('delete from public.tandem_moderators where user_id = $1', [ancien.id]),
    )

    expect(await lireContexte(ancien)).toEqual([])
  })
})
