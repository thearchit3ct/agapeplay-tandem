/**
 * Monte une base Supabase locale jetable à partir des migrations du dépôt.
 *
 * Les migrations sont copiées telles quelles depuis `supabase/migrations`.
 * Elles portent toutes un préfixe à quatorze chiffres, ce qui est la seule
 * forme que le CLI sache lire — voir `migrations.test.ts`, qui l'exige sans
 * avoir besoin d'une base.
 *
 * Ce harnais a longtemps renuméroté les fichiers en les copiant, parce que le
 * dépôt les nommait sur huit chiffres : le CLI tronquait alors la version à
 * `20260804`, prenait les sept fichiers pour une seule et même version, et
 * cassait sur collision de clé primaire au deuxième. Mesuré à l'époque : la
 * base s'arrêtait à 3 tables sur 18. Le renommage a supprimé la cause ; la
 * béquille n'a plus lieu d'être, et la garde a pris sa place.
 *
 * `supabase/config.toml` n'est pas versionné : on fait `supabase init`.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const DOSSIER = join(racine, '.rls-stack')
const CLI = ['--yes', 'supabase@2.111.0']

// Postgres seul suffit : les tests parlent SQL directement, avec
// `set local role authenticated` et `request.jwt.claims`. Passer par PostgREST
// ajouterait une couche HTTP sans rien tester de plus des politiques.
const SERVICES_EXCLUS = [
  'realtime', 'storage-api', 'imgproxy', 'studio', 'edge-runtime',
  'logflare', 'vector', 'supavisor', 'mailpit', 'postgres-meta',
]

const supabase = (args, options = {}) =>
  execFileSync('npx', [...CLI, ...args], { cwd: DOSSIER, encoding: 'utf8', ...options })

export const demarrer = () => {
  arreter()
  rmSync(DOSSIER, { recursive: true, force: true })
  mkdirSync(join(DOSSIER, 'supabase', 'migrations'), { recursive: true })

  supabase(['init', '--force', '--with-vscode-settings', 'false', '--with-intellij-settings', 'false'], { stdio: 'ignore' })

  const source = join(racine, 'supabase', 'migrations')
  const fichiers = readdirSync(source).filter((nom) => nom.endsWith('.sql')).sort()
  if (fichiers.length === 0) throw new Error('aucune migration trouvée dans supabase/migrations')

  const malNommees = fichiers.filter((nom) => !/^\d{14}_/.test(nom))
  if (malNommees.length > 0) {
    throw new Error(
      `migration(s) au préfixe non conforme, le CLI les ignorerait ou les confondrait : ${malNommees.join(', ')}`,
    )
  }

  fichiers.forEach((nom) => {
    copyFileSync(join(source, nom), join(DOSSIER, 'supabase', 'migrations', nom))
  })

  supabase(['start', '-x', SERVICES_EXCLUS.join(',')], { stdio: 'inherit' })
  return { fichiers, dossier: DOSSIER }
}

export const arreter = () => {
  try { supabase(['stop', '--no-backup'], { stdio: 'ignore' }) } catch { /* rien à arrêter */ }
}
