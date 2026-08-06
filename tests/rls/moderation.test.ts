/**
 * La modération : ce qu'elle voit, et surtout ce qu'elle ne voit pas.
 *
 * L'ADR-002 promet des signalements « visibles de la modération ». Rien ne
 * portait cette promesse : la seule politique SELECT de `tandem_reports` était
 * `reports_select_reporter`, et un signalement partait donc dans une table que
 * personne ne lisait — voir `signalement.test.ts`, qui constatait l'écart.
 *
 * Le périmètre retenu est étroit, et chaque borne est testée ici plutôt que
 * commentée :
 *
 * - les modérateurs lisent **tous** les signalements ;
 * - ils lisent le message signalé, **et lui seul** — pas la conversation ;
 * - ils ne lisent **jamais** le journal ;
 * - ils n'effacent rien ;
 * - la liste des modérateurs n'est lisible par personne, pas même par eux.
 *
 * Le test qui compte le plus est « un message non signalé de la même
 * conversation reste fermé ». C'est lui qui distingue une politique juste d'une
 * politique qui rouvrirait la messagerie privée sous couvert de modération. Les
 * politiques SELECT permissives s'additionnent : sans ce test, une formulation
 * trop large passerait pour un succès.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

let claire: Utilisateur
let auteur: Utilisateur
let moderateur: Utilisateur
let ordinaire: Utilisateur
let tandemId: string
let messageSignale: string
let messageOrdinaire: string
let messageSansSignalement: string
let journalId: string

beforeAll(async () => {
  await commeService(async (client) => {
    const suffixe = marque()
    claire = await creerUtilisateur(client, `claire-${suffixe}@test.local`)
    auteur = await creerUtilisateur(client, `auteur-${suffixe}@test.local`)
    moderateur = await creerUtilisateur(client, `moderateur-${suffixe}@test.local`)
    ordinaire = await creerUtilisateur(client, `ordinaire-${suffixe}@test.local`)

    // La nomination se fait ici comme en production : une écriture directe,
    // hors RLS, depuis l'éditeur SQL. Aucune interface ne la propose.
    await client.query('insert into public.tandem_moderators (user_id) values ($1)', [moderateur.id])

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [claire.id, auteur.id],
    )
    tandemId = tandem.rows[0].id

    const messages = await client.query<{ id: string }>(
      `insert into public.tandem_messages (tandem_id, sender_id, body) values
         ($1, $2, 'le message qui a motivé le signalement'),
         ($1, $2, 'un message ordinaire de la même conversation')
       returning id`,
      [tandemId, auteur.id],
    )
    messageSignale = messages.rows[0].id
    messageOrdinaire = messages.rows[1].id

    await client.query(
      "insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason) values ($1, $2, $3, 'Propos déplacés.')",
      [tandemId, claire.id, messageSignale],
    )

    // Un second tandem où le signalement ne désigne aucun message : c'est un
    // cas réel — `message_id` est nullable, et `signalement.test.ts` en insère
    // un ainsi. Il ne doit ouvrir aucune conversation.
    const autre = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [claire.id, ordinaire.id],
    )
    const sansMessage = await client.query<{ id: string }>(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'conversation jamais signalée au message près') returning id",
      [autre.rows[0].id, ordinaire.id],
    )
    messageSansSignalement = sansMessage.rows[0].id
    await client.query(
      "insert into public.tandem_reports (tandem_id, reporter_id, reason) values ($1, $2, 'Gêne diffuse, sans message précis.')",
      [autre.rows[0].id, claire.id],
    )

    const journal = await client.query<{ id: string }>(
      "insert into public.journal_entries (user_id, text) values ($1, 'ce que je n’ai dit à personne') returning id",
      [claire.id],
    )
    journalId = journal.rows[0].id
  })
})

const lireLesSignalements = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query<{ reason: string }>('select reason from public.tandem_reports order by reason')
    return rows.map((ligne) => ligne.reason)
  })

const lireLeMessage = (lecteur: Utilisateur, id: string) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query<{ body: string }>('select body from public.tandem_messages where id = $1', [id])
    return rows.map((ligne) => ligne.body)
  })

describe('ce que la modération voit', () => {
  it('TÉMOIN — la signalante retrouve son propre signalement', async () => {
    // Le témoin de tout le fichier : si lui tombe, c'est le harnais qui a lâché
    // et non les politiques.
    expect(await lireLesSignalements(claire)).toContain('Propos déplacés.')
  })

  it('le modérateur lit un signalement qu’il n’a pas émis', async () => {
    // La promesse de l'ADR-002, enfin portée par le schéma.
    expect(await lireLesSignalements(moderateur)).toContain('Propos déplacés.')
  })

  it('… là où un utilisateur ordinaire ne voit rien', async () => {
    // La discrimination mesurée : `ordinaire` est participant du second tandem,
    // il pourrait croire au droit de savoir. Il n'a signalé personne, il ne lit
    // aucun signalement.
    expect(await lireLesSignalements(ordinaire)).toEqual([])
  })

  it('le modérateur lit le message signalé', async () => {
    // Sans le message, la modération ne peut rien juger : c'est la moitié utile
    // de l'ouverture.
    expect(await lireLeMessage(moderateur, messageSignale)).toEqual([
      'le message qui a motivé le signalement',
    ])
  })
})

describe('ce que la modération ne voit pas', () => {
  it('un utilisateur quelconque ne lit pas un message signalé', async () => {
    // La borne côté lecteur : le signalement ne publie pas le message qu'il
    // dénonce. `ordinaire` est le bon cas — participant d'un *autre* tandem,
    // donc parfaitement légitime dans le produit, et étranger à celui-ci.
    expect(await lireLeMessage(ordinaire, messageSignale)).toEqual([])
  })

  it('signaler ne rouvre pas la conversation à qui en a été écarté', async () => {
    // Ce test tient un conjonct précis, et il a fallu le chercher : retirer
    // `tandem_est_moderateur()` de la politique des messages ne faisait rougir
    // aucun autre test. La raison est que la sous-requête sur
    // `public.tandem_reports` est elle-même soumise à la RLS de cette table —
    // un compte étranger n'y voit aucun signalement, donc l'`exists` est faux
    // pour lui de toute façon.
    //
    // Le conjonct n'est donc pas décoratif, mais ce qu'il retient est étroit :
    // la personne qui a signalé, elle, voit son signalement. Sans lui, la
    // politique de modération lui rouvrirait le message signalé alors même que
    // `messages_select_member` s'est refermée sur elle — ici parce que l'autre
    // participant l'a bloquée. Un signalement deviendrait une clé pour
    // reprendre pied dans une conversation dont on a été écarté.
    const decor = await commeService(async (client) => {
      const suffixe = marque()
      const signalante = await creerUtilisateur(client, `signalante-${suffixe}@test.local`)
      const bloqueur = await creerUtilisateur(client, `bloqueur-${suffixe}@test.local`)

      const tandem = await client.query<{ id: string }>(
        "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $2) returning id",
        [signalante.id, bloqueur.id],
      )
      const message = await client.query<{ id: string }>(
        "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'le message qu’elle a signalé') returning id",
        [tandem.rows[0].id, bloqueur.id],
      )
      await client.query(
        "insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason) values ($1, $2, $3, 'Signalé avant d’être bloquée.')",
        [tandem.rows[0].id, signalante.id, message.rows[0].id],
      )
      return { signalante, messageId: message.rows[0].id }
    })

    // TÉMOIN dans le test : elle voit bien son signalement. C'est ce qui rend
    // l'assertion suivante concluante — l'`exists` de la politique serait vrai
    // pour elle, seul le conjonct de modération l'arrête.
    expect(await lireLesSignalements(decor.signalante)).toContain('Signalé avant d’être bloquée.')

    expect(await lireLeMessage(decor.signalante, decor.messageId)).toEqual([])
  })


  it('⭐ le modérateur ne lit PAS un message non signalé de la même conversation', async () => {
    // Le test décisif. Avec la conversation entière, on rouvrirait exactement
    // ce que l'ADR-002 protège : un signalement deviendrait un mandat de
    // perquisition sur une relation privée. `tandem_reports.message_id` désigne
    // un message précis, et l'ouverture s'arrête à lui.
    expect(await lireLeMessage(moderateur, messageOrdinaire)).toEqual([])
  })

  it('un signalement sans message précis n’ouvre aucun message', async () => {
    // `message_id` est nullable. Une politique écrite sur le tandem plutôt que
    // sur le message rendrait ce signalement-là bien plus ouvert que l'autre —
    // l'inverse de l'intention.
    expect(await lireLeMessage(moderateur, messageSansSignalement)).toEqual([])
  })

  it('le modérateur ne lit jamais le journal', async () => {
    // GARDE, pas découverte : `journal_select_own` n'a jamais ouvert le journal
    // à quiconque d'autre que son auteur. Ce test existe pour que l'ajout d'une
    // branche modérateur, un jour, rougisse au lieu de passer.
    const vu = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query('select text from public.journal_entries where id = $1', [journalId])
      return rows
    })

    expect(vu).toEqual([])
  })

  it('le modérateur ne lit pas le tandem lui-même', async () => {
    // Conséquence assumée du périmètre « le message signalé, et lui seul » :
    // `tandems_select_member` ne s'ouvre pas à la modération. Le signalement
    // porte un `tandem_id`, la ligne reste fermée.
    const vu = await commeUtilisateur(moderateur, async (client) => {
      const { rows } = await client.query('select status from public.tandems where id = $1', [tandemId])
      return rows
    })

    expect(vu).toEqual([])
  })
})

describe('ce que la modération ne peut pas faire', () => {
  it('le modérateur n’efface aucun signalement', async () => {
    // La protection tient ici plus haut qu'une politique : aucun `grant delete`
    // n'est accordé sur `tandem_reports`, le refus tombe avant la RLS. Un
    // signalement, une fois posé, ne disparaît pas.
    await expect(
      commeUtilisateur(moderateur, (client) => client.query('delete from public.tandem_reports')),
    ).rejects.toThrow(/permission denied/i)

    expect(await lireLesSignalements(moderateur)).toContain('Propos déplacés.')
  })

  it('le modérateur ne modifie pas un signalement', async () => {
    // Corollaire : `grant select, insert` seulement. La colonne `status`
    // (`open` / `reviewing` / `resolved`) reste donc inatteignable par l'API —
    // écart connu, à trancher à part.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set status = 'resolved'"),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('personne ne lit la liste des modérateurs — pas même un modérateur', async () => {
    // La table ne porte ni politique ni `grant` : elle est invisible de la Data
    // API. Savoir qui modère, c'est savoir qui cibler.
    for (const utilisateur of [moderateur, claire, ordinaire]) {
      await expect(
        commeUtilisateur(utilisateur, (client) => client.query('select user_id from public.tandem_moderators')),
      ).rejects.toThrow(/permission denied/i)
    }
  })

  it('personne ne se nomme modérateur', async () => {
    // La nomination est un geste humain, hors RLS, depuis l'éditeur SQL. Aucune
    // écriture n'est ouverte, donc aucune escalade de privilège n'est
    // atteignable depuis un compte.
    await expect(
      commeUtilisateur(ordinaire, (client) =>
        client.query('insert into public.tandem_moderators (user_id) values ($1)', [ordinaire.id]),
      ),
    ).rejects.toThrow(/permission denied/i)
  })

  it('un modérateur radié ne lit plus rien', async () => {
    // La lecture est évaluée à chaque requête, pas figée à la nomination :
    // retirer une ligne suffit à refermer, sans redéploiement ni migration.
    const ancien = await commeService(async (client) => {
      const utilisateur = await creerUtilisateur(client, `ancien-${marque()}@test.local`)
      await client.query('insert into public.tandem_moderators (user_id) values ($1)', [utilisateur.id])
      return utilisateur
    })

    expect(await lireLesSignalements(ancien)).toContain('Propos déplacés.')

    await commeService((client) =>
      client.query('delete from public.tandem_moderators where user_id = $1', [ancien.id]),
    )

    expect(await lireLesSignalements(ancien)).toEqual([])
  })
})
