/**
 * Ce qu'un signalement dit de lui-même, et ce que personne ne peut lui faire
 * dire.
 *
 * `20260825173000_categorie_et_urgence.sql` ajoute deux colonnes qui ne se
 * défendent pas de la même façon, et c'est tout le sujet de ce fichier :
 *
 * - **`category` vient de la personne**, et sa borne est une contrainte `check`.
 *   Une contrainte **lève** — contrairement à un `using`, qui refuse en silence.
 *   Les tests l'attendent donc explicitement, et jamais un `rowCount` à zéro.
 * - **`urgency` ne vient de personne**. C'est une colonne générée : PostgreSQL
 *   refuse toute valeur proposée par un client, quel que soit son rôle. Il n'y a
 *   donc rien à garder — pas de politique, pas de grant à retirer — et le test
 *   mesure précisément ce refus, parce que c'est lui, et lui seul, qui empêche
 *   une application compromise de déclarer « standard » un signalement de danger.
 *
 * Le troisième point est ailleurs dans le schéma et vaut d'être mesuré ici : le
 * `grant update (status)` de `20260806180000` interdit à un modérateur de
 * réécrire `category`, exactement comme il lui interdit de réécrire `reason`.
 * On ne falsifie pas le témoignage de la personne qui a signalé — ni son mot
 * libre, ni la case qu'elle a cochée.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { commeService, commeUtilisateur, creerUtilisateur, type Utilisateur } from './harnais'

const marque = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

let signalante: Utilisateur
let visee: Utilisateur
let moderateur: Utilisateur
let tandemId: string
let signalementId: string

beforeAll(async () => {
  await commeService(async (client) => {
    const suffixe = marque()
    signalante = await creerUtilisateur(client, `cat-signalante-${suffixe}@test.local`)
    visee = await creerUtilisateur(client, `cat-visee-${suffixe}@test.local`)
    moderateur = await creerUtilisateur(client, `cat-mod-${suffixe}@test.local`)

    await client.query('insert into public.tandem_moderators (user_id) values ($1)', [moderateur.id])

    const tandem = await client.query<{ id: string }>(
      "insert into public.tandems (participant_a_id, participant_b_id, status) values ($1, $2, 'active') returning id",
      [signalante.id, visee.id],
    )
    tandemId = tandem.rows[0].id

    const rapport = await client.query<{ id: string }>(
      "insert into public.tandem_reports (tandem_id, reporter_id, category, reason) values ($1, $2, 'insistance', 'Elle revient à la charge.') returning id",
      [tandemId, signalante.id],
    )
    signalementId = rapport.rows[0].id
  })
})

/** Poser un signalement sous l'identité de la personne concernée. */
const signaler = (colonnes: string, valeurs: unknown[]) =>
  commeUtilisateur(signalante, (client) =>
    client.query(
      `insert into public.tandem_reports (tandem_id, reporter_id, ${colonnes}) values ($1, $2${valeurs.map((_, index) => `, $${index + 3}`).join('')}) returning id, category, urgency, reason`,
      [tandemId, signalante.id, ...valeurs],
    ))

describe('la catégorie d’un signalement', () => {
  it('TÉMOIN — une catégorie valide passe, et la personne relit sa ligne', async () => {
    // Sans ce témoin, tous les refus ci-dessous pourraient venir de la politique
    // d'insertion ou du harnais, et non de ce qu'ils prétendent mesurer.
    const { rows } = await signaler('category', ['malaise'])

    expect(rows[0].category).toBe('malaise')
  })

  it('refuse une catégorie que la contrainte ne connaît pas', async () => {
    // Une contrainte `check` lève, là où un `using` se tairait. C'est ce qui
    // permet à l'application de distinguer « refusé » de « rien à faire ».
    await expect(signaler('category', ['harcelement'])).rejects.toThrow(/violates check constraint/i)
  })

  it('refuse un signalement sans catégorie — aucun défaut ne vient le combler', async () => {
    // Le point n'est pas le `not null`, c'est l'**absence de défaut**. Un
    // `default 'autre'` laisserait un client insérer sans choisir, et la colonne
    // se remplirait toute seule de la même valeur : on aurait remplacé un
    // littéral figé par un autre, sans que rien ne le signale.
    await expect(signaler('reason', ['Sans catégorie.'])).rejects.toThrow(/null value in column "category"/i)
  })

  it('garde ouverte la valeur des huit signalements antérieurs', async () => {
    // `non_precise` reste acceptée par la contrainte — sinon les lignes
    // rétro-remplies deviendraient invalides au premier UPDATE de statut — mais
    // aucun écran ne la propose (`CATEGORIES_PROPOSEES`, côté domaine).
    const { rows } = await signaler('category', ['non_precise'])
    expect(rows[0].category).toBe('non_precise')
  })
})

describe('l’urgence d’un signalement', () => {
  it('se déduit de la catégorie, valeur par valeur', async () => {
    // La même table de correspondance que `urgenceDe` dans packages/domain. Les
    // deux se modifient ensemble : ce test est l'endroit où la dérive se voit.
    const attendu: Array<[string, string]> = [
      ['sexuel', 'immediate'],
      ['danger', 'immediate'],
      ['insistance', 'elevee'],
      ['secret', 'elevee'],
      ['malaise', 'standard'],
      ['autre', 'standard'],
      ['non_precise', 'standard'],
    ]

    for (const [categorie, urgence] of attendu) {
      const { rows } = await signaler('category', [categorie])
      expect({ categorie, urgence: rows[0].urgency }).toEqual({ categorie, urgence })
    }
  })

  it('ne peut pas être proposée par celui qui signale', async () => {
    // Le cœur de la décision : l'urgence n'est pas une donnée saisie. Le refus
    // ne vient pas d'une politique qu'on pourrait élargir un jour, mais de la
    // nature de la colonne — et il vaut pour tous les rôles, application
    // compromise comprise.
    await expect(signaler('category, urgency', ['malaise', 'immediate']))
      .rejects.toThrow(/cannot insert a non-DEFAULT value into column "urgency"/i)
  })

  it('ne peut pas non plus être réécrite par un modérateur', async () => {
    // Le message attendu ici n'est **pas** « permission denied », et c'est une
    // mesure, pas une supposition : PostgreSQL refuse la colonne générée avant
    // même de regarder le grant par colonne. Un test qui aurait attendu le
    // refus de droits serait passé au rouge le jour où quelqu'un aurait
    // accordé `update (urgency)` — c'est-à-dire au pire moment.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set urgency = 'standard' where id = $1", [signalementId])),
    ).rejects.toThrow(/can only be updated to DEFAULT/i)
  })
})

describe('ce qu’un modérateur ne peut pas réécrire', () => {
  it('TÉMOIN — il fait bien avancer le statut', async () => {
    const lignes = await commeUtilisateur(moderateur, async (client) => {
      const resultat = await client.query(
        "update public.tandem_reports set status = 'reviewing' where id = $1", [signalementId])
      return resultat.rowCount
    })
    expect(lignes).toBe(1)
  })

  it('ne peut pas réécrire la catégorie choisie', async () => {
    // Même refus que sur `reason`, et pour la même raison : le grant porte sur
    // `status` seul. Requalifier un dossier « danger » en « autre » d'un clic
    // serait la falsification la plus discrète que cette table permette.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set category = 'autre' where id = $1", [signalementId])),
    ).rejects.toThrow(/permission denied/i)
  })

  it('ne peut pas glisser la catégorie à côté du statut', async () => {
    // Le refus couvre la tentative mixte : PostgreSQL parle de **table**, pas de
    // colonne, dès qu'une colonne non accordée est nommée.
    await expect(
      commeUtilisateur(moderateur, (client) =>
        client.query("update public.tandem_reports set status = 'resolved', category = 'autre' where id = $1", [signalementId])),
    ).rejects.toThrow(/permission denied/i)
  })

  it('GARDE — le droit d’écriture de authenticated ne porte que sur status', async () => {
    // Les trois tests ci-dessus mesurent des refus ; celui-ci mesure le jeu
    // exact des colonnes accordées. Un `grant update (status, category)` ajouté
    // un jour « pour permettre de requalifier » les ferait tous virer au vert
    // sans qu'on l'ait décidé.
    const colonnes = await commeService(async (client) => {
      const { rows } = await client.query<{ column_name: string }>(
        `select column_name from information_schema.column_privileges
          where table_schema = 'public' and table_name = 'tandem_reports'
            and grantee = 'authenticated' and privilege_type = 'UPDATE'
          order by column_name`,
      )
      return rows.map((ligne) => ligne.column_name)
    })

    expect(colonnes).toEqual(['status'])
  })
})

describe('le mot libre, devenu facultatif', () => {
  it('accepte un signalement sans mot libre', async () => {
    // Le cas courant : on choisit une ligne, on n'écrit rien. La contrainte de
    // longueur ne s'y oppose pas — `char_length(NULL)` rend NULL, le `between`
    // rend NULL, et un `check` qui rend NULL passe.
    const { rows } = await signaler('category', ['malaise'])
    expect(rows[0].reason).toBeNull()
  })

  it('refuse toujours la chaîne vide', async () => {
    // D'où l'obligation, côté applications, d'envoyer `null` et non `''` :
    // sinon tous les signalements sans mot libre échoueraient.
    await expect(signaler('category, reason', ['malaise', ''])).rejects.toThrow(/violates check constraint/i)
  })

  it('refuse toujours un mot libre au-delà de mille caractères', async () => {
    await expect(signaler('category, reason', ['malaise', 'a'.repeat(1001)]))
      .rejects.toThrow(/violates check constraint/i)
  })
})
