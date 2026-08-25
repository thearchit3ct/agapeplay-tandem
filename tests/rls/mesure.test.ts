/**
 * La mesure respectueuse : ce qu'une ligne d'événement peut contenir, qui peut
 * l'écrire, et qui peut la lire.
 *
 * Migration `20260825190000_mesure_respectueuse`. Trois promesses y sont
 * posées, et ce fichier les mesure une par une :
 *
 *   1. **aucune donnée de journal dans les événements** — c'est le critère de
 *      l'issue #20 qui compte vraiment, et le seul dont l'échec serait un
 *      incident. La contrainte `analytics_events_metadata_sobre` le tient
 *      contre une application compromise, pas seulement contre une erreur de
 *      programmation ;
 *   2. **l'écriture est réservée aux comptes connectés**. La politique de
 *      `…_000007` ouvrait l'insertion à `anon` ;
 *   3. **personne ne lit cette table depuis la Data API**, et la vue du funnel
 *      n'a aucun `grant`.
 *
 * Chaque refus est accompagné de son témoin positif dans le même décor : sans
 * lui, une contrainte qui refuserait tout — ou un harnais cassé — passerait
 * pour une protection.
 */
import { describe, expect, it } from 'vitest'
import { commeAnonyme, commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

/**
 * Un identifiant d'appareil, de la forme que les deux applications tirent.
 *
 * Réellement distinct à chaque appel : une première version dérivée de
 * `Date.now()` rendait la même valeur à deux tests voisins, et les comptages
 * ramassaient les lignes du test d'à côté.
 */
const identifiantDAppareil = () => {
  const hexadecimal = (longueur: number) =>
    [...Array(longueur)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hexadecimal(8)}-${hexadecimal(4)}-4${hexadecimal(3)}-8${hexadecimal(3)}-${hexadecimal(12)}`
}

const compte = async (): Promise<Utilisateur> =>
  commeService((client) => creerUtilisateur(client, `mesure-${marque()}@test.local`))

const inserer = (client: Parameters<Parameters<typeof commeUtilisateur>[1]>[0], valeurs: {
  nom?: string
  identifiant?: string
  metadata?: string
}) => client.query(
  // Sans `returning` : `authenticated` a `insert` et rien d'autre, et une
  // clause `returning` lit — elle exigerait `select`, que personne n'a sur
  // cette table. C'est aussi pour cela que le client applicatif appelle
  // `.insert()` sans `.select()` : demander la ligne écrite ferait échouer
  // toutes les émissions, avec un « permission denied » qui ressemble à un
  // problème de politique alors qu'il s'agit d'un droit.
  `insert into public.analytics_events (event_name, anonymous_id, journey_id, locale, metadata)
   values ($1, $2, 'repartir-avec-jesus', 'fr', $3::jsonb)`,
  [valeurs.nom ?? 'session_completed', valeurs.identifiant ?? identifiantDAppareil(), valeurs.metadata ?? '{"day": 2}'],
)

describe('ce qu’un événement peut contenir', () => {
  it('accepte un événement du catalogue du doc 08', async () => {
    // Le témoin. Il tient les quatre tests qui suivent : sans lui, une
    // contrainte qui refuserait toute insertion les ferait tous passer.
    const personne = await compte()
    const { rowCount } = await commeUtilisateur(personne, (client) =>
      inserer(client, { metadata: '{"day": 2, "duration_bucket": "5-10min"}' }))
    expect(rowCount).toBe(1)
  })

  it('refuse une réflexion de séance glissée dans metadata', async () => {
    // Le cas redouté, écrit tel qu'il arriverait : une clé pourtant permise,
    // une valeur qui est une confidence. C'est ce refus-ci qui a été prouvé par
    // mutation — contrainte retirée sur base vivante, ce test rougit seul.
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, {
      metadata: '{"duration_bucket": "j’ai pleuré en écrivant ça, je ne l’ai dit à personne"}',
    }))).rejects.toThrow(/analytics_events_metadata_sobre/)
  })

  it('refuse une clé hors catalogue, même avec une valeur courte', async () => {
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, {
      metadata: '{"reflection": "fatigue"}',
    }))).rejects.toThrow(/analytics_events_metadata_sobre/)
  })

  it('refuse un texte caché sous une valeur imbriquée', async () => {
    // Sans le contrôle de type, la clé est permise et la longueur n'est mesurée
    // que sur la sérialisation : un objet passerait par la fenêtre laissée
    // ouverte à côté de la porte fermée.
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, {
      metadata: '{"day": {"texte": "ce que je n’ai dit à personne"}}',
    }))).rejects.toThrow(/analytics_events_metadata_sobre/)
  })

  it('refuse un nom d’événement absent du doc 08', async () => {
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, { nom: 'journal_written' })))
      .rejects.toThrow(/analytics_events_nom_connu/)
  })
})

describe('l’identifiant d’appareil', () => {
  it('refuse l’identifiant du compte lui-même', async () => {
    // La garde qui empêche la table de devenir un journal d'activité nominatif.
    // Elle attrape le cas littéral — le raccourci « on a déjà l'uid sous la
    // main » — et c'est celui qui arrive vraiment.
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, { identifiant: personne.id })))
      .rejects.toThrow(/mesure serait nominative/)
  })

  it('accepte un tirage quelconque du même compte', async () => {
    // Le témoin du test précédent : ce n'est pas « ce compte » qui est refusé,
    // c'est la valeur qui le désigne.
    const personne = await compte()
    const { rowCount } = await commeUtilisateur(personne, (client) => inserer(client, {}))
    expect(rowCount).toBe(1)
  })

  it('refuse une adresse e-mail en guise d’identifiant', async () => {
    const personne = await compte()
    await expect(commeUtilisateur(personne, (client) => inserer(client, { identifiant: personne.email })))
      .rejects.toThrow(/analytics_events_identifiant_opaque/)
  })
})

describe('qui peut écrire, qui peut lire', () => {
  it('refuse l’insertion à un visiteur non connecté', async () => {
    // `…_000007` l'autorisait. Sur un site statique dont la clé publiable est
    // dans le paquet, c'était un point d'écriture ouvert sur la seule mesure du
    // produit.
    await expect(commeAnonyme((client) => inserer(client, {})))
      .rejects.toThrow(/permission denied|new row violates/)
  })

  it('ne rend aucune ligne à celui-là même qui vient de l’écrire', async () => {
    // Aucune politique SELECT n'existe, et aucun `grant select` non plus : la
    // lecture est refusée un cran plus tôt qu'une politique, au niveau du
    // droit. C'est plus solide qu'un zéro ligne, qu'une politique ajoutée un
    // jour pourrait transformer en liste.
    //
    // Le fait mesuré est double : la ligne existe bel et bien hors RLS — sans
    // ce témoin, le refus prouverait seulement qu'il n'y a rien à lire — et
    // elle reste hors de portée de celui-là même qui vient de l'écrire.
    const personne = await compte()
    const identifiant = identifiantDAppareil()
    await commeService((client) => client.query(
      `insert into public.analytics_events (event_name, anonymous_id, metadata)
       values ('partner_accepted', $1, '{}'::jsonb)`, [identifiant]))

    const horsRls = await commeService((client) => client.query(
      'select count(*)::int as n from public.analytics_events where anonymous_id = $1', [identifiant]))
    expect(horsRls.rows[0].n).toBe(1)

    await expect(commeUtilisateur(personne, (client) => client.query(
      'select count(*) from public.analytics_events where anonymous_id = $1', [identifiant])))
      .rejects.toThrow(/permission denied/)

    for (const identite of ['anon', 'authenticated']) {
      const { rows } = await commeService((client) => client.query(
        'select has_table_privilege($1, \'public.analytics_events\', \'select\') as ouvert', [identite]))
      expect({ [identite]: rows[0].ouvert }).toEqual({ [identite]: false })
    }

    await commeService((client) => client.query(
      'delete from public.analytics_events where anonymous_id = $1', [identifiant]))
  })

  it('ne laisse la vue du funnel lisible à personne depuis la Data API', async () => {
    // Une vue ordinaire s'exécute avec les droits de son propriétaire : un
    // `grant select` accordé un jour ouvrirait la table entière à travers elle,
    // RLS comprise. L'absence de droit est la protection.
    for (const identite of ['anon', 'authenticated']) {
      const { rows } = await commeService((client) => client.query(
        'select has_table_privilege($1, \'public.mesure_funnel_binome\', \'select\') as ouvert', [identite]))
      expect({ [identite]: rows[0].ouvert }).toEqual({ [identite]: false })
    }
  })

  it('rend le funnel du doc 08 en sept étapes, même sans une seule mesure', async () => {
    // Le témoin de la vue : elle répond, et elle répond sept lignes. Une vue
    // qui ne rendrait rien sur une table vide serait un tableau de bord qui
    // disparaît le jour où il n'y a rien à voir — c'est-à-dire le jour où l'on
    // a le plus besoin de savoir qu'on ne mesure rien.
    const { rows } = await commeService((client) => client.query(
      'select rang, evenement, appareils from public.mesure_funnel_binome order by rang'))
    expect(rows.map((ligne) => ligne.evenement)).toEqual([
      'account_created', 'journey_started', 'session_completed',
      'partner_invited', 'partner_accepted', 'share_created', 'weekly_checkin_completed',
    ])
    // Étape 7 : aucun geste ne l'émet tant que le bilan hebdomadaire (issue
    // #18) n'existe pas. Le zéro est structurel, et il est écrit dans le
    // commentaire de la vue pour que personne ne le prenne pour un chiffre.
    expect(rows[6].appareils).toBe('0')
  })
})

describe('le consentement, et la suppression', () => {
  it('laisse chacun régler sa mesure, et personne celle d’un autre', async () => {
    const personne = await compte()
    const autre = await compte()

    const sien = await commeUtilisateur(personne, (client) => client.query(
      'insert into public.mesure_preferences (user_id, mesure) values ($1, false) returning mesure', [personne.id]))
    expect(sien.rows[0].mesure).toBe(false)

    // La politique est `for all` avec `with check` sur l'identité : poser un
    // refus au nom de quelqu'un d'autre est refusé par le `with check`, qui
    // lève — contrairement à un UPDATE écarté par un `using`, qui se tait.
    await expect(commeUtilisateur(autre, (client) => client.query(
      'insert into public.mesure_preferences (user_id, mesure) values ($1, false)', [personne.id])))
      .rejects.toThrow(/row-level security/)

    await commeService((client) => client.query('delete from public.mesure_preferences where user_id = $1', [personne.id]))
  })

  it('emporte la préférence de mesure avec le compte, et aucun événement', async () => {
    // La procédure de suppression, mesurée : ce qui est nominatif part, ce qui
    // ne l'est pas reste — parce qu'aucun prédicat ne pourrait le désigner.
    // C'est le résultat recherché, pas un oubli, et le test l'épingle pour que
    // personne n'« améliore » un jour la fonction en lui faisant croire qu'elle
    // sait retrouver les événements d'une personne.
    const personne = await compte()
    const identifiant = identifiantDAppareil()
    await commeService(async (client) => {
      await client.query('insert into public.mesure_preferences (user_id, mesure) values ($1, true)', [personne.id])
      await client.query(
        `insert into public.analytics_events (event_name, anonymous_id, metadata)
         values ('partner_accepted', $1, '{}'::jsonb)`, [identifiant])
    })

    await commeUtilisateur(personne, async (client) => {
      await client.query('select public.supprimer_mon_compte()')
      // Hors RLS pour mesurer des faits : une ligne effacée et une ligne
      // masquée par une politique rendent le même zéro.
      await client.query('reset role')
      const preference = await client.query('select count(*)::int as n from public.mesure_preferences where user_id = $1', [personne.id])
      const evenements = await client.query('select count(*)::int as n from public.analytics_events where anonymous_id = $1', [identifiant])
      expect({ preference: preference.rows[0].n, evenements: evenements.rows[0].n }).toEqual({ preference: 0, evenements: 1 })
    })

    await commeService((client) => client.query('delete from public.analytics_events where anonymous_id = $1', [identifiant]))
  })
})
