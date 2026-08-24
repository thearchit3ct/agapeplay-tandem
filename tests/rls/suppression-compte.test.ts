/**
 * La suppression de compte : ce qu'elle efface, et ce qu'elle refuse d'emporter.
 *
 * `supprimer_mon_compte()` (migration `20260825090000_suppression_de_compte`)
 * tranche un nœud que le schéma avait posé : quatre clés étrangères en
 * `on delete cascade` vers `auth.users` font qu'effacer la ligne d'un compte
 * détruit le tandem entier, la conversation du partenaire restant et les
 * signalements. La fonction n'efface donc pas cette ligne : elle efface la
 * personne et neutralise ses moyens de connexion.
 *
 * Ces tests mesurent les deux faces de cette ligne de conduite. Ce qui doit
 * disparaître, et ce qui doit survivre — le second groupe compte autant que le
 * premier : un utilisateur signalé qui se supprime ne doit pas emporter la
 * preuve.
 *
 * Comme partout dans cette suite, chaque négatif a son témoin positif dans le
 * même décor, et l'on mesure des faits — une ligne, une colonne, un compte —
 * jamais la seule absence d'erreur.
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
  /** Le compte qui se supprime. */
  a: Utilisateur
  /** Son binôme, qui reste. */
  b: Utilisateur
  /** Un compte sans aucun lien : témoin que rien ne déborde. */
  tiers: Utilisateur
  tandemId: string
  messageDeA: string
  messageDeB: string
  signalementId: string
}

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Un décor complet : deux comptes appariés qui se sont écrit, un signalement
 * de B sur un message de A, et tout ce qu'un compte accumule par ailleurs
 * (journal, progression, préférences, invitations émises et reçues, session
 * ouverte, identité de connexion).
 *
 * Posé hors transaction (`commeService`) pour survivre aux transactions —
 * annulées — des appels qui suivent. C'est cette annulation qui permet à
 * chaque test de partir d'un compte intact malgré une suppression réelle.
 */
const monterDecor = async (options: { statutTandem?: string } = {}): Promise<Decor> => {
  const suffixe = marque()
  return commeService(async (client) => {
    const a = await creerUtilisateur(client, `a-${suffixe}@test.local`)
    const b = await creerUtilisateur(client, `b-${suffixe}@test.local`)
    const tiers = await creerUtilisateur(client, `tiers-${suffixe}@test.local`)

    await client.query(
      "insert into public.profiles (id, display_name, age_confirmed_at) values ($1, $2, now()), ($3, $4, now()), ($5, $6, now())",
      [a.id, `Anne ${suffixe}`, b.id, `Benjamin ${suffixe}`, tiers.id, `Tiers ${suffixe}`],
    )

    // Ce qui n'est qu'à A.
    await client.query("insert into public.journal_entries (user_id, text) values ($1, 'Ce que je n’ai dit à personne.')", [a.id])
    await client.query("insert into public.session_progress (user_id, journey_id, session_id) values ($1, 'repartir-avec-jesus', 'repartir-01')", [a.id])
    await client.query('insert into public.notification_preferences (user_id) values ($1)', [a.id])

    // Le témoin qui rend la mutation « where user_id = v_uid → where true »
    // visible : sans lui, effacer trop ne ferait rougir aucun test.
    await client.query("insert into public.journal_entries (user_id, text) values ($1, 'Le journal d’un inconnu.')", [tiers.id])
    await client.query("insert into public.session_progress (user_id, journey_id, session_id) values ($1, 'repartir-avec-jesus', 'repartir-02')", [tiers.id])

    // Invitations dans les deux sens : une émise par A vers un tiers, une
    // reçue par A de la part du tiers.
    await client.query(
      "insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2), ($3, $4)",
      [a.id, `invite-${suffixe}@test.local`, tiers.id, a.email],
    )
    // Et une qui ne concerne pas A du tout : elle doit rester.
    await client.query(
      'insert into public.tandem_invitations (inviter_id, invitee_email) values ($1, $2)',
      [tiers.id, `ailleurs-${suffixe}@test.local`],
    )

    const statut = options.statutTandem ?? 'active'
    const { rows: tandems } = await client.query<{ id: string }>(
      `insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by)
       values ($1::uuid, $2::uuid, $3::text, case when $3::text = 'blocked' then $1::uuid end)
       returning id::text`,
      [a.id, b.id, statut],
    )
    const tandemId = tandems[0].id

    const { rows: messages } = await client.query<{ id: string }>(
      `insert into public.tandem_messages (tandem_id, sender_id, body) values
         ($1, $2, 'Ce que A a écrit à B.'),
         ($1, $3, 'Ce que B a écrit à A.')
       returning id::text`,
      [tandemId, a.id, b.id],
    )

    const { rows: signalements } = await client.query<{ id: string }>(
      `insert into public.tandem_reports (tandem_id, reporter_id, message_id, reason)
       values ($1, $2, $3, 'Message inapproprié.') returning id::text`,
      [tandemId, b.id, messages[0].id],
    )

    // Une session ouverte et une identité de connexion : c'est sur elles que
    // porte la révocation côté serveur.
    await client.query('insert into auth.sessions (id, user_id) values (gen_random_uuid(), $1)', [a.id])
    await client.query(
      `insert into auth.identities (provider_id, user_id, identity_data, provider)
       values ($1::text, $2::uuid, jsonb_build_object('sub', $1::text, 'email', $3::text), 'email')`,
      [a.id, a.id, a.email],
    )
    await client.query("update auth.users set raw_user_meta_data = jsonb_build_object('full_name', 'Anne Réelle') where id = $1", [a.id])

    return { a, b, tiers, tandemId, messageDeA: messages[0].id, messageDeB: messages[1].id, signalementId: signalements[0].id }
  })
}

type Sonde = {
  /** Compte des lignes. */
  compter: (sql: string, params?: unknown[]) => Promise<number>
  /** Rejoue une lecture sous l'identité de quelqu'un, RLS comprise. */
  sousIdentiteDe: <T>(qui: Utilisateur, action: (client: Client) => Promise<T>) => Promise<T>
}

/**
 * Supprime le compte, puis mesure la base **dans la même transaction**.
 *
 * Tout est annulé au retour : le décor suivant repart intact. C'est aussi la
 * raison pour laquelle les mesures ne peuvent pas être faites après coup — il
 * n'y a pas d'« après » qui survive à `rollback`.
 *
 * Deux détails qui décident de ce que ces tests prouvent :
 *
 * 1. **La mesure se fait hors RLS** (`reset role` rend le rôle de session,
 *    `postgres`). Mesurée en direct : sous l'identité de celui qui vient de
 *    supprimer, `select count(*) … where user_id = <un tiers>` rend zéro parce
 *    que `journal_select_own` masque la ligne — pas parce qu'elle a été
 *    effacée. Les deux causes sont indiscernables, et le test « n'efface que
 *    les siennes » aurait été vert avec une fonction qui efface tout. On lit
 *    donc des faits, pas ce que la politique laisse voir.
 * 2. `sousIdentiteDe` permet de revenir dans la RLS, sous n'importe quel
 *    compte, sans quitter la transaction — c'est ainsi qu'on vérifie ce que le
 *    binôme restant lit vraiment après le geste.
 */
const supprimerPuisMesurer = <T>(qui: Utilisateur, mesure: (sonde: Sonde) => Promise<T>) =>
  commeUtilisateur(qui, async (client) => {
    await client.query('select public.supprimer_mon_compte()')
    await client.query('reset role')

    const sonde: Sonde = {
      compter: async (sql, params = []) => {
        const { rows } = await client.query<{ n: string }>(sql, params)
        return Number(rows[0].n)
      },
      sousIdentiteDe: async (autre, action) => {
        const claims = JSON.stringify({ sub: autre.id, email: autre.email, role: 'authenticated' })
        await client.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
        await client.query('set local role authenticated')
        try {
          return await action(client)
        } finally {
          await client.query('reset role')
        }
      },
    }
    return mesure(sonde)
  })

/** Compte des lignes hors de toute suppression, pour les témoins « avant ». */
const compterEnBase = (sql: string, params: unknown[]) =>
  commeService(async (client) => {
    const { rows } = await client.query<{ n: string }>(sql, params)
    return Number(rows[0].n)
  })

describe('supprimer_mon_compte — ce qui disparaît', () => {
  it('efface le journal, la progression et les préférences de son auteur', async () => {
    const { a } = await monterDecor()

    // Témoin « avant » : sans lui, un décor cassé rendrait ce test vert sans
    // que la fonction ait rien fait.
    const avant = await compterEnBase('select count(*) as n from public.journal_entries where user_id = $1', [a.id])
    expect(avant).toBe(1)

    const restes = await supprimerPuisMesurer(a, async (sonde) => ({
      journal: await sonde.compter('select count(*) as n from public.journal_entries where user_id = $1', [a.id]),
      progression: await sonde.compter('select count(*) as n from public.session_progress where user_id = $1', [a.id]),
      preferences: await sonde.compter('select count(*) as n from public.notification_preferences where user_id = $1', [a.id]),
    }))

    expect(restes).toEqual({ journal: 0, progression: 0, preferences: 0 })
  })

  it('n’efface QUE les siennes — le journal d’un tiers reste intact', async () => {
    // C'est ce test que la mutation « where user_id = v_uid → where true »
    // fait rougir. Il porte à lui seul la garde d'identité de la fonction :
    // celle-ci n'ayant aucun paramètre, il n'y a pas d'autre endroit où
    // vérifier qu'elle ne déborde pas sur quelqu'un d'autre.
    const { a, tiers } = await monterDecor()

    const restes = await supprimerPuisMesurer(a, async (sonde) => ({
      journalDuTiers: await sonde.compter('select count(*) as n from public.journal_entries where user_id = $1', [tiers.id]),
      progressionDuTiers: await sonde.compter('select count(*) as n from public.session_progress where user_id = $1', [tiers.id]),
      profilDuTiers: await sonde.compter("select count(*) as n from public.profiles where id = $1 and account_status = 'active'", [tiers.id]),
    }))

    expect(restes).toEqual({ journalDuTiers: 1, progressionDuTiers: 1, profilDuTiers: 1 })
  })

  it('efface toute invitation qui porte son identifiant ou son adresse, dans les deux sens', async () => {
    const { a, tiers } = await monterDecor()

    const restes = await supprimerPuisMesurer(a, async (sonde) => ({
      emises: await sonde.compter('select count(*) as n from public.tandem_invitations where inviter_id = $1', [a.id]),
      recues: await sonde.compter('select count(*) as n from public.tandem_invitations where lower(invitee_email) = lower($1)', [a.email]),
      // Témoin : l'invitation du tiers vers quelqu'un d'autre n'a aucune
      // raison de partir, et si elle partait la clause serait trop large.
      etrangeres: await sonde.compter(
        'select count(*) as n from public.tandem_invitations where inviter_id = $1 and lower(invitee_email) <> lower($2)',
        [tiers.id, a.email],
      ),
    }))

    expect(restes).toEqual({ emises: 0, recues: 0, etrangeres: 1 })
  })

  it('laisse un profil vidé, daté, sans consentement — pas une ligne absente', async () => {
    // La ligne survit à dessein : `tandem_partenaire()` la lit en `left join`,
    // et un nom NULL y veut déjà dire « partenaire sans profil *encore* ».
    // L'effacer ferait dire à l'écran du binôme le contraire de ce qui s'est
    // passé.
    const { a } = await monterDecor()

    const profil = await supprimerPuisMesurer(a, (sonde) =>
      sonde.compter(
        `select count(*) as n from public.profiles
          where id = $1 and display_name = '' and account_status = 'deleted'
            and deleted_at is not null and deletion_requested_at is not null
            and age_confirmed_at is null and privacy_consent_at is null and terms_consent_at is null`,
        [a.id],
      ))

    expect(profil).toBe(1)
  })

  it('coupe les moyens de se connecter : plus d’adresse, plus de session, plus d’identité', async () => {
    const { a } = await monterDecor()

    const avant = await compterEnBase('select count(*) as n from auth.sessions where user_id = $1', [a.id])
    expect(avant).toBe(1)

    const apres = await supprimerPuisMesurer(a, async (sonde) => ({
      // L'adresse est le point qui décide : sans elle, aucun lien magique ne
      // peut plus atteindre ce compte — et l'adresse d'origine redevient libre
      // pour une inscription neuve, ce que l'écran annonce.
      neutralise: await sonde.compter(
        `select count(*) as n from auth.users
          where id = $1 and email is null and phone is null and encrypted_password is null
            and raw_user_meta_data::text = '{}' and deleted_at is not null and banned_until > now()`,
        [a.id],
      ),
      sessions: await sonde.compter('select count(*) as n from auth.sessions where user_id = $1', [a.id]),
      identites: await sonde.compter('select count(*) as n from auth.identities where user_id = $1', [a.id]),
    }))

    expect(apres).toEqual({ neutralise: 1, sessions: 0, identites: 0 })
  })
})

describe('supprimer_mon_compte — ce qui survit, et pourquoi', () => {
  it('laisse au binôme sa conversation, messages du parti compris', async () => {
    // Le droit à l'effacement porte sur les données personnelles de la
    // personne, pas sur la correspondance d'autrui. Le binôme garde ses
    // propres phrases — ce qu'une cascade lui aurait prises — et celles qu'on
    // lui a écrites.
    const { a, b, tandemId } = await monterDecor()

    const mesures = await supprimerPuisMesurer(a, async (sonde) => ({
      enBase: await sonde.compter('select count(*) as n from public.tandem_messages where tandem_id = $1', [tandemId]),
      // La mesure qui compte : ce que B lit vraiment, sous sa propre identité
      // et sous `messages_select_member`, après le geste.
      vuParB: await sonde.sousIdentiteDe(b, async (client) => {
        const { rows } = await client.query<{ n: string }>(
          'select count(*) as n from public.tandem_messages where tandem_id = $1',
          [tandemId],
        )
        return Number(rows[0].n)
      }),
    }))

    expect(mesures).toEqual({ enBase: 2, vuParB: 2 })
  })

  it('laisse le signalement et son dossier — se supprimer n’emporte pas la preuve', async () => {
    const { a, signalementId, messageDeA } = await monterDecor()

    const restes = await supprimerPuisMesurer(a, async (sonde) => ({
      signalement: await sonde.compter('select count(*) as n from public.tandem_reports where id = $1', [signalementId]),
      // Le message visé nommément par le signalement : c'est lui que la
      // modération lit, et lui seul.
      messageSignale: await sonde.compter('select count(*) as n from public.tandem_messages where id = $1', [messageDeA]),
      // Et le tandem qui le porte : `tandem_reports.tandem_id` cascade depuis
      // `tandems`, une suppression de la ligne emporterait le dossier entier.
      tandem: await sonde.compter('select count(*) as n from public.tandems where id in (select tandem_id from public.tandem_reports where id = $1)', [signalementId]),
    }))

    expect(restes).toEqual({ signalement: 1, messageSignale: 1, tandem: 1 })
  })

  it('ne débloque pas un tandem bloqué : le blocage survit à son auteur', async () => {
    // La garde la plus tranchante de la fonction. `messages_select_member`
    // referme l'historique sur la personne bloquée tant que
    // `status = 'blocked'` ; passer la ligne à `ended` la lui rouvrirait
    // entièrement, au moment précis où celui qui l'a bloquée s'en va.
    //
    // Ici A a bloqué B, puis A supprime son compte.
    const { a, b, tandemId } = await monterDecor({ statutTandem: 'blocked' })

    const mesures = await supprimerPuisMesurer(a, async (sonde) => ({
      encoreBloque: await sonde.compter("select count(*) as n from public.tandems where id = $1 and status = 'blocked'", [tandemId]),
      // La mesure qui compte vraiment : B, bloqué, ne lit toujours rien.
      vuParB: await sonde.sousIdentiteDe(b, async (client) => {
        const { rows } = await client.query<{ n: string }>(
          'select count(*) as n from public.tandem_messages where tandem_id = $1',
          [tandemId],
        )
        return Number(rows[0].n)
      }),
    }))

    expect(mesures).toEqual({ encoreBloque: 1, vuParB: 0 })
  })

  it('TÉMOIN — un tandem non bloqué, lui, se termine et libère le binôme', async () => {
    // Le pendant du test précédent : sans lui, une fonction qui ne toucherait
    // jamais au statut les passerait tous les deux. Et « terminé » n'est pas
    // « piégé » : `tandems_active_pair_idx` ne couvre que `active`/`paused`,
    // donc le binôme restant peut être ré-apparié aussitôt.
    const { a, b, tiers, tandemId } = await monterDecor()

    const etat = await supprimerPuisMesurer(a, async (sonde) => {
      const termine = await sonde.compter(
        "select count(*) as n from public.tandems where id = $1 and status = 'ended' and ended_at is not null",
        [tandemId],
      )
      const reapparie = await sonde.compter(
        `with nouveau as (
           insert into public.tandems (participant_a_id, participant_b_id) values ($1, $2) returning id
         ) select count(*) as n from nouveau`,
        [b.id, tiers.id],
      )
      return { termine, reapparie }
    })

    expect(etat).toEqual({ termine: 1, reapparie: 1 })
  })
})

describe('supprimer_mon_compte — qui peut l’appeler', () => {
  it('n’existe pas sous une forme qui nommerait quelqu’un d’autre', async () => {
    // La réponse structurelle à « un tiers ne peut pas supprimer autrui » :
    // il n'y a personne à nommer. Ce test tomberait le jour où l'on ajouterait
    // une variante à paramètre — et c'est bien son rôle, la sûreté d'une telle
    // variante ne tiendrait plus qu'à sa garde interne.
    const { a, b } = await monterDecor()

    await expect(
      commeUtilisateur(b, (client) => client.query('select public.supprimer_mon_compte($1)', [a.id])),
    ).rejects.toThrow(/does not exist/i)

    // Témoin : la forme sans paramètre, elle, existe bien pour ce même compte.
    const sansParametre = await commeUtilisateur(b, (client) => client.query('select public.supprimer_mon_compte()'))
    expect(sansParametre.rowCount).toBe(1)
  })

  it('lève sans rien effacer quand l’identité manque', async () => {
    // Rôle `authenticated` sans claims : le droit d'appeler est là, l'identité
    // non. C'est le seul endroit d'où le repli fermé de la fonction se mesure —
    // par `commeAnonyme`, le `grant` lèverait le premier et le test resterait
    // vert quoi qu'on fasse à la garde.
    const { a } = await monterDecor()

    await expect(
      commeAuthentifieSansIdentite((client) => client.query('select public.supprimer_mon_compte()')),
    ).rejects.toThrow(/identite_absente/)

    // Et rien n'a bougé : sans cette mesure, une fonction qui effacerait tout
    // avant de lever passerait le test ci-dessus.
    const restant = await compterEnBase('select count(*) as n from public.journal_entries where user_id = $1', [a.id])
    expect(restant).toBe(1)
  })

  it('n’est pas exécutable par un visiteur non connecté', async () => {
    await expect(
      commeAnonyme((client) => client.query('select public.supprimer_mon_compte()')),
    ).rejects.toThrow(/permission denied/i)
  })
})

describe('tandem_partenaire — ce que le binôme restant apprend', () => {
  it('dit « supprimé » après le geste, et rien avant (témoin)', async () => {
    // Sans cette colonne, l'écran du binôme lirait un nom vide et conclurait
    // « pas encore de nom » — il proposerait d'inviter quelqu'un qui est déjà
    // là. Le signal vient de `auth.users.deleted_at` et non de
    // `profiles.account_status`, que `profiles_update_own` met à la portée de
    // son propriétaire : n'importe qui pourrait sinon se déclarer supprimé sur
    // l'écran d'en face.
    const { a, b } = await monterDecor()

    const avant = await commeUtilisateur(b, async (client) => {
      const { rows } = await client.query('select display_name, partenaire_supprime from public.tandem_partenaire()')
      return rows
    })
    expect(avant).toHaveLength(1)
    expect(avant[0].partenaire_supprime).toBe(false)
    expect(avant[0].display_name).toMatch(/^Anne /)

    const apres = await supprimerPuisMesurer(a, (sonde) =>
      sonde.sousIdentiteDe(b, async (client) => {
        const { rows } = await client.query('select display_name, partenaire_supprime from public.tandem_partenaire()')
        return rows
      }))
    expect(apres).toHaveLength(1)
    expect(apres[0].partenaire_supprime).toBe(true)
    expect(apres[0].display_name).toBe('')
  })
})
