/**
 * ADR-002, règle 3 : un utilisateur bloqué ne peut plus écrire ni lire chez
 * celui qui l'a bloqué.
 *
 * La migration `20260806012728_blocage_effectif` tient enfin cette promesse.
 * Avant elle, deux des tests de ce fichier s'appelaient « ÉCART ADR-002 » et
 * constataient le contraire ; ils sont désormais des gardes.
 *
 * Ce que le schéma affirme maintenant :
 *
 * - `tandems.blocked_by` nomme celui qui a bloqué. La contrainte de table exige
 *   que ce soit un des deux participants.
 * - `tandems_update_member` : sur une ligne déjà `blocked`, seul `blocked_by`
 *   peut écrire (`using`, ancienne ligne) ; pour atteindre l'état `blocked`,
 *   `blocked_by` doit valoir soi-même (`with check`, nouvelle ligne).
 * - `messages_select_member` : la personne bloquée ne lit plus, celle qui a
 *   bloqué lit encore — elle peut avoir besoin de l'historique pour signaler.
 *
 * Chaque test négatif s'appuie sur un témoin positif : si le témoin tombe,
 * c'est le harnais qui a lâché, pas la politique.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

let claire: Utilisateur
let indesirable: Utilisateur
let tandemId: string

/** Monte un tandem bloqué par Claire, avec un message antérieur au blocage. */
const monterTandemBloque = async (options: { blockedBy: 'claire' | null }) => {
  await commeService(async (client) => {
    const marque = `bloc-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    claire = await creerUtilisateur(client, `claire-${marque}@test.local`)
    indesirable = await creerUtilisateur(client, `indesirable-${marque}@test.local`)

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status, blocked_by) values ($1, $2, 'blocked', $3) returning id",
      [claire.id, indesirable.id, options.blockedBy === 'claire' ? claire.id : null],
    )
    tandemId = tandem.rows[0].id

    await client.query(
      "insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, 'un message d’avant le blocage')",
      [tandemId, claire.id],
    )
  })
}

const ecrire = (auteur: Utilisateur, corps: string) =>
  commeUtilisateur(auteur, (client) =>
    client.query('insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, $3)', [tandemId, auteur.id, corps]),
  )

const lire = (lecteur: Utilisateur) =>
  commeUtilisateur(lecteur, async (client) => {
    const { rows } = await client.query<{ body: string }>(
      'select body from public.tandem_messages where tandem_id = $1 order by created_at',
      [tandemId],
    )
    return rows.map((ligne) => ligne.body)
  })

describe('un tandem bloqué par Claire', () => {
  beforeEach(() => monterTandemBloque({ blockedBy: 'claire' }))

  it('TÉMOIN — dans un tandem actif, écrire et lire fonctionnent des deux côtés', async () => {
    // Sans ce témoin, « l'écriture échoue » et « la lecture est vide » ne
    // prouveraient rien : ils pourraient tenir à n'importe quelle autre cause.
    await commeService((client) =>
      client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [tandemId]),
    )

    await expect(ecrire(indesirable, 'bonjour')).resolves.toBeDefined()
    await expect(lire(indesirable)).resolves.toContain('un message d’avant le blocage')
  })

  it('coupe l’écriture de la personne bloquée', async () => {
    await expect(ecrire(indesirable, 'laisse-moi te parler')).rejects.toThrow(/row-level security/i)
  })

  it('coupe aussi l’écriture de celle qui a bloqué', async () => {
    // Le statut est porté par le tandem, pas par un sens de blocage : les deux
    // côtés sont muets. C'est cohérent, et c'est à savoir.
    await expect(ecrire(claire, 'finalement…')).rejects.toThrow(/row-level security/i)
  })

  it('GARDE — la personne bloquée ne lit plus rien de l’historique', async () => {
    await expect(lire(indesirable)).resolves.toEqual([])
  })

  it('GARDE — celle qui a bloqué continue de lire l’historique', async () => {
    // Délibéré : elle en a besoin pour signaler, `tandem_reports.message_id`
    // désignant un message précis.
    await expect(lire(claire)).resolves.toEqual(['un message d’avant le blocage'])
  })

  it('GARDE — la personne bloquée ne peut plus se débloquer elle-même', async () => {
    const tentative = await commeUtilisateur(indesirable, async (client) => {
      const modification = await client.query("update public.tandems set status = 'active' where id = $1", [tandemId])
      const { rows } = await client.query<{ status: string }>('select status from public.tandems where id = $1', [tandemId])
      return { lignesModifiees: modification.rowCount, statut: rows[0]?.status }
    })

    expect(tentative).toEqual({ lignesModifiees: 0, statut: 'blocked' })
  })

  it('GARDE — la personne bloquée ne contourne pas non plus en se désignant comme bloqueuse', async () => {
    // La politique `using` porte sur l'ancienne ligne : réécrire `blocked_by`
    // ne donne aucune prise, la ligne est déjà hors de portée.
    const tentative = await commeUtilisateur(indesirable, async (client) => {
      const modification = await client.query(
        "update public.tandems set blocked_by = $2, status = 'active' where id = $1",
        [tandemId, indesirable.id],
      )
      return modification.rowCount
    })

    expect(tentative).toBe(0)
  })

  it('celle qui a bloqué peut débloquer, et le tandem refonctionne des deux côtés', async () => {
    // `commeUtilisateur` annule sa transaction en sortant — c'est ce qui isole
    // les tests. Le déblocage est donc constaté *dans* la transaction de Claire
    // (la politique l'a laissé passer, une ligne touchée), puis rejoué hors RLS
    // pour la suite du scénario. Sans ce détour, on testerait le rollback.
    const debloque = await commeUtilisateur(claire, async (client) => {
      const { rowCount } = await client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [tandemId])
      const { rows } = await client.query<{ status: string }>('select status from public.tandems where id = $1', [tandemId])
      return { lignesModifiees: rowCount, statut: rows[0]?.status }
    })
    expect(debloque).toEqual({ lignesModifiees: 1, statut: 'active' })

    await commeService((client) =>
      client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [tandemId]),
    )

    // Chaque côté écrit puis relit dans sa propre transaction : la conversation
    // est à nouveau ouverte dans les deux sens.
    const cotéIndesirable = await commeUtilisateur(indesirable, async (client) => {
      await client.query('insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, $3)', [
        tandemId, indesirable.id, 'merci de m’avoir laissé une chance',
      ])
      const { rows } = await client.query<{ body: string }>(
        'select body from public.tandem_messages where tandem_id = $1 order by created_at', [tandemId],
      )
      return rows.map((ligne) => ligne.body)
    })
    expect(cotéIndesirable).toEqual(['un message d’avant le blocage', 'merci de m’avoir laissé une chance'])

    const cotéClaire = await commeUtilisateur(claire, async (client) => {
      await client.query('insert into public.tandem_messages (tandem_id, sender_id, body) values ($1, $2, $3)', [
        tandemId, claire.id, 'on repart',
      ])
      const { rows } = await client.query<{ body: string }>(
        'select body from public.tandem_messages where tandem_id = $1 order by created_at', [tandemId],
      )
      return rows.map((ligne) => ligne.body)
    })
    expect(cotéClaire).toEqual(['un message d’avant le blocage', 'on repart'])
  })

  it('un tiers ne peut ni lire ni débloquer le tandem', async () => {
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-${Date.now()}@test.local`))

    const vu = await commeUtilisateur(tiers, async (client) => {
      const messages = await client.query('select id from public.tandem_messages where tandem_id = $1', [tandemId])
      const modification = await client.query("update public.tandems set status = 'active' where id = $1", [tandemId])
      return { messages: messages.rowCount, modifiees: modification.rowCount }
    })

    expect(vu).toEqual({ messages: 0, modifiees: 0 })
  })
})

describe('poser un blocage', () => {
  beforeEach(async () => {
    await monterTandemBloque({ blockedBy: 'claire' })
    await commeService((client) =>
      client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [tandemId]),
    )
  })

  it('TÉMOIN — bloquer en son propre nom fonctionne', async () => {
    // On compte les lignes touchées, et pas seulement l'absence d'erreur : un
    // UPDATE refusé par le `using` d'une politique ne lève rien, il modifie
    // zéro ligne. « ça n'a pas planté » ne prouverait donc rien.
    const pose = await commeUtilisateur(claire, async (client) => {
      const { rowCount } = await client.query(
        "update public.tandems set status = 'blocked', blocked_by = $2 where id = $1", [tandemId, claire.id],
      )
      const { rows } = await client.query<{ status: string; blocked_by: string }>(
        'select status, blocked_by::text from public.tandems where id = $1', [tandemId],
      )
      return { lignesModifiees: rowCount, ...rows[0] }
    })

    expect(pose).toEqual({ lignesModifiees: 1, status: 'blocked', blocked_by: claire.id })
  })

  it('GARDE — on ne bloque pas au nom d’un autre', async () => {
    // `with check` porte sur la nouvelle ligne : viser l'état `blocked` impose
    // `blocked_by = auth.uid()`. Claire ne peut pas faire porter le blocage par
    // l'autre, ce qui lui donnerait à lui le droit de le lever.
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("update public.tandems set status = 'blocked', blocked_by = $2 where id = $1", [tandemId, indesirable.id]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('GARDE — on ne bloque pas sans se nommer', async () => {
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("update public.tandems set status = 'blocked' where id = $1", [tandemId]),
      ),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('un tandem bloqué avant la migration (blocked_by NULL)', () => {
  // Ces lignes existent peut-être en base : rien dans le schéma ne dit qui les a
  // bloquées, et le deviner reviendrait à donner à un inconnu le droit de lever
  // un blocage. Choix assumé de la migration : elles gèlent, et seul un
  // opérateur en `service_role` les rouvre.
  beforeEach(() => monterTandemBloque({ blockedBy: null }))

  it('personne ne lit l’historique, pas même celle qui aurait bloqué', async () => {
    await expect(lire(claire)).resolves.toEqual([])
    await expect(lire(indesirable)).resolves.toEqual([])
  })

  it('personne ne change le statut par l’API', async () => {
    for (const participant of [claire, indesirable]) {
      const modifiees = await commeUtilisateur(participant, async (client) => {
        const { rowCount } = await client.query("update public.tandems set status = 'active' where id = $1", [tandemId])
        return rowCount
      })
      expect(modifiees).toBe(0)
    }
  })

  it('un opérateur en service_role dégèle la ligne en nommant celui qui a bloqué', async () => {
    // La recette exacte est écrite dans la migration ; ce test la vérifie.
    await commeService((client) =>
      client.query('update public.tandems set blocked_by = $2 where id = $1', [tandemId, claire.id]),
    )

    await expect(lire(claire)).resolves.toEqual(['un message d’avant le blocage'])
    await expect(lire(indesirable)).resolves.toEqual([])
    await expect(
      commeUtilisateur(claire, (client) =>
        client.query("update public.tandems set status = 'active', blocked_by = null where id = $1", [tandemId]),
      ),
    ).resolves.toBeDefined()
  })
})

describe('la colonne blocked_by', () => {
  beforeEach(() => monterTandemBloque({ blockedBy: 'claire' }))

  it('n’accepte qu’un participant du tandem', async () => {
    const tiers = await commeService((client) => creerUtilisateur(client, `tiers-chk-${Date.now()}@test.local`))

    // `commeService` n'ouvre pas de transaction : on la pose ici pour ne pas
    // laisser en base la ligne fautive du jour où la contrainte disparaîtrait.
    await expect(
      commeService(async (client) => {
        await client.query('begin')
        try {
          await client.query('update public.tandems set blocked_by = $2 where id = $1', [tandemId, tiers.id])
        } finally {
          await client.query('rollback').catch(() => {})
        }
      }),
    ).rejects.toThrow(/tandems_blocked_by_participant_chk/)
  })
})
