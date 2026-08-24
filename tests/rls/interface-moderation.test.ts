/**
 * Ce que l'écran de modération demande à la base, mot pour mot.
 *
 * `moderation.test.ts` et `suivi-moderation.test.ts` mesurent les politiques —
 * ce que la base accorde et ce qu'elle refuse — et ils restent l'autorité.
 * Ce fichier-ci mesure autre chose, et une seule chose : que les quatre
 * requêtes réellement écrites dans `apps/web/src/moderation.ts` fonctionnent
 * telles qu'elles sont écrites. Deux d'entre elles ont une forme que rien
 * n'obligeait, et dont l'écran dépend entièrement :
 *
 * - **la décision lit sa propre réponse** : `update … set status = …
 *   returning id, status, resolved_at`. Le `returning` porte sur une colonne
 *   qui n'est accordée à personne en écriture — le trigger la pose. Rien ne
 *   garantissait qu'un `returning` sur une colonne fermée en écriture passe ;
 *   il passe parce que `select` est accordé sur la table entière, et c'est
 *   cette combinaison-là que le test tient. Si elle cédait, le client
 *   traiterait chaque décision réussie comme un échec.
 *
 * - **le faux succès** : la même requête, jouée par un compte qui n'est plus
 *   modérateur, doit rendre **zéro ligne sans erreur**. C'est le seul motif
 *   pour lequel `changerStatut` traite `data == null` comme un échec, et le
 *   scénario n'a rien d'abstrait — le retrait d'un modérateur est immédiat par
 *   conception, donc il peut tomber entre le chargement de la page et le clic.
 *
 * Les listes de colonnes sont recopiées à l'identique depuis le client : c'est
 * le seul moyen qu'une colonne ajoutée là-bas sans droit ici rougisse.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

let moderateur: Utilisateur
let signalante: Utilisateur
let visee: Utilisateur
let tandem: string
let messageSignale: string
let signalement: string

beforeAll(async () => {
  await commeService(async (client) => {
    const suffixe = marque()
    moderateur = await creerUtilisateur(client, `mod-ecran-${suffixe}@test.local`)
    signalante = await creerUtilisateur(client, `signalante-ecran-${suffixe}@test.local`)
    visee = await creerUtilisateur(client, `visee-ecran-${suffixe}@test.local`)

    await client.query('insert into public.tandem_moderators (user_id) values ($1)', [moderateur.id])

    const paire = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [signalante.id, visee.id],
    )
    tandem = paire.rows[0].id

    const message = await client.query<{ id: string }>(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'le message signalé') returning id",
      [tandem, visee.id],
    )
    messageSignale = message.rows[0].id

    const rapport = await client.query<{ id: string }>(
      "insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason) values ($1, $2, $3, 'À traiter.') returning id",
      [tandem, signalante.id, messageSignale],
    )
    signalement = rapport.rows[0].id
  })
})

describe('les lectures de l’écran', () => {
  it('rend les signalements avec exactement les colonnes demandées', async () => {
    const lignes = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query(
        'select id, tandem_id, message_id, reporter_id, reason, status, created_at, resolved_at from public.tandem_reports where id = $1',
        [signalement],
      )
      return rows
    })
    expect(lignes).toHaveLength(1)
    expect(lignes[0].status).toBe('open')
    expect(lignes[0].resolved_at).toBeNull()
  })

  it('rend le message signalé, son auteur compris', async () => {
    // `sender_id` est lu, et il ne s'affiche jamais : le client le compare à
    // `reporter_id` pour dire « écrit par la personne qui signale » ou « par
    // l'autre participant », puis le jette. Un dérivé, pas un identifiant —
    // c'est la même ligne que celle tenue par la vue de contexte, qui exclut
    // `blocked_by` au seul motif que c'est l'uuid d'un participant.
    const lignes = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query<{ sender_id: string; body: string }>(
        'select id, sender_id, body, created_at from public.tandem_messages where id = any($1::uuid[])',
        [[messageSignale]],
      )
      return rows
    })
    expect(lignes).toHaveLength(1)
    expect(lignes[0].sender_id).toBe(visee.id)
  })

  it('rend le contexte par la vue, là où la table ne rend rien', async () => {
    // Le piège que ce test fige : interroger `tandems` directement rend zéro
    // ligne **sans erreur** — `tandems_select_member` ne reconnaît pas le
    // modérateur. On chercherait longtemps un bug qui est la borne.
    const { parLaVue, parLaTable } = await commeUtilisateur(moderateur, async (client) => {
      const vue = await client.query(
        'select tandem_id, status, created_at, blocked_at, ended_at from public.tandem_contexte_signale where tandem_id = $1',
        [tandem],
      )
      const table = await client.query('select id from public.tandems where id = $1', [tandem])
      return { parLaVue: vue.rows, parLaTable: table.rows }
    })
    expect(parLaVue).toHaveLength(1)
    expect(parLaTable).toEqual([])
  })

  it('rend le journal des décisions avec les colonnes demandées', async () => {
    const lignes = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query(
        'select id, moderator_id, from_status, to_status, changed_at from public.tandem_report_audit where report_id = $1 order by changed_at desc',
        [signalement],
      )
      return rows
    })
    // Aucune décision encore prise : la liste vide est le résultat attendu, et
    // c'est l'absence d'erreur qui est mesurée ici.
    expect(lignes).toEqual([])
  })
})

describe('la décision, telle que le client l’écrit', () => {
  it('⭐ rend la ligne écrite, avec la date que le modérateur ne peut pas écrire', async () => {
    const rendu = await commeUtilisateur(moderateur, async (client) => {
      const { rows, rowCount } = await client.query<{ status: string; resolved_at: string | null }>(
        "update public.tandem_reports set status = 'resolved' where id = $1 returning id, status, resolved_at",
        [signalement],
      )
      return { rowCount, ligne: rows[0] }
    })

    expect(rendu.rowCount).toBe(1)
    expect(rendu.ligne.status).toBe('resolved')
    // La non-nullité est le cœur du test : c'est elle qui prouve que le
    // `returning` voit la valeur posée par le trigger `before update`, et non
    // la ligne telle qu'elle était avant lui. Sans elle, l'écran afficherait
    // une clôture sans date.
    expect(rendu.ligne.resolved_at).not.toBeNull()
  })

  it('⭐ ne rend AUCUNE ligne, et ne lève rien, pour qui n’est plus modérateur', async () => {
    // Le faux succès. `authenticated` a bien le grant sur la colonne `status` :
    // ce qui refuse est le `using` de `reports_update_moderator`, et un UPDATE
    // refusé par un `using` touche zéro ligne sans exception. PostgREST rend
    // alors `error: null` — d'où la garde `!data` côté client.
    const rendu = await commeUtilisateur(signalante, async (client) => {
      const { rows, rowCount } = await client.query(
        "update public.tandem_reports set status = 'reviewing' where id = $1 returning id, status, resolved_at",
        [signalement],
      )
      return { rowCount, lignes: rows }
    })

    expect(rendu.rowCount).toBe(0)
    expect(rendu.lignes).toEqual([])
  })
})
