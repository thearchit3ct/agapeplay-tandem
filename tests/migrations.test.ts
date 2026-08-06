/**
 * Le nommage des migrations, vérifié sans base ni Docker.
 *
 * Ce fichier existe à cause d'une panne silencieuse coûteuse. Les sept
 * premières migrations du projet portaient un préfixe à huit chiffres
 * (`20260804_000001_…`). Le CLI Supabase n'en lit que quatorze : il tronquait
 * la version à `20260804`, prenait les sept fichiers pour une seule et même
 * migration, et cassait sur collision de clé primaire au deuxième. Mesuré :
 * la base s'arrêtait à **3 tables sur 18** — assez pour qu'un test de sécurité
 * passe au vert sur des tables absentes.
 *
 * La garde est ici plutôt que dans la suite RLS parce qu'elle doit être
 * instantanée : elle échoue en une demi-seconde, sur `npm test`, avant même
 * qu'on ait démarré Docker.
 */
import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const DOSSIER = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations')
const fichiers = readdirSync(DOSSIER).filter((nom) => nom.endsWith('.sql'))

describe('nommage des migrations', () => {
  it('trouve bien des migrations à vérifier', () => {
    // Sans ça, tous les tests ci-dessous passeraient sur une liste vide.
    expect(fichiers.length).toBeGreaterThan(0)
  })

  it('préfixe chaque migration de quatorze chiffres suivis d’un souligné', () => {
    const fautives = fichiers.filter((nom) => !/^\d{14}_/.test(nom))
    expect(fautives, 'le CLI Supabase ignore ou confond tout autre format').toEqual([])
  })

  it('ne donne jamais la même version à deux migrations', () => {
    const versions = fichiers.map((nom) => nom.slice(0, 14))
    expect(versions, 'deux migrations de même version = collision de clé primaire')
      .toEqual([...new Set(versions)])
  })

  it('range les fichiers dans l’ordre où ils doivent s’appliquer', () => {
    // L'ordre lexicographique des noms doit être l'ordre chronologique des
    // versions : c'est celui dans lequel le CLI les rejoue.
    const versions = fichiers.map((nom) => nom.slice(0, 14))
    expect([...versions].sort()).toEqual([...versions].sort((a, b) => Number(a) - Number(b)))
  })
})
