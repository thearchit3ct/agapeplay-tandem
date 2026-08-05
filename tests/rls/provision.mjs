/**
 * Monte une base Supabase locale jetable à partir des migrations du dépôt.
 *
 * Le dépôt nomme ses migrations `20260804_000001_…` — huit chiffres. Le CLI
 * attend quatorze : il tronque la version à `20260804`, considère les sept
 * fichiers comme une seule et même version, et casse sur collision de clé
 * primaire au deuxième. Mesuré : la base s'arrête à 3 tables sur 18.
 *
 * On ne renomme donc rien dans le dépôt — l'historique du projet distant
 * enregistre ces migrations sous d'autres versions, et les réconcilier est une
 * décision de l'utilisateur. Le harnais **copie** les fichiers dans un dossier
 * temporaire en les renumérotant, dans leur ordre lexicographique actuel. Les
 * tests deviennent indépendants du nommage du dépôt, et le jour où
 * l'utilisateur tranche, il n'y a rien à refaire ici.
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

  fichiers.forEach((nom, index) => {
    const libelle = nom.replace(/^\d+_\d+_/, '').replace(/^\d+_/, '')
    const version = `202608041200${String(index + 1).padStart(2, '0')}`
    copyFileSync(join(source, nom), join(DOSSIER, 'supabase', 'migrations', `${version}_${libelle}`))
  })

  supabase(['start', '-x', SERVICES_EXCLUS.join(',')], { stdio: 'inherit' })
  return { fichiers, dossier: DOSSIER }
}

export const arreter = () => {
  try { supabase(['stop', '--no-backup'], { stdio: 'ignore' }) } catch { /* rien à arrêter */ }
}
