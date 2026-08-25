/**
 * Test de fumée du web : le bundle construit est-il servi, et contient-il
 * encore ce qui fait l'application ?
 *
 * Ce que ce script prouve : `apps/web/dist` existe, la page répond, **chaque**
 * ressource qu'elle référence répond aussi (un CSS ou un morceau de JS absent
 * du dossier est la panne la plus banale d'un build cassé), et les marqueurs
 * vitaux sont bien dans le JavaScript réellement servi.
 *
 * Ce que ce script ne prouve PAS, et il faut le dire pour ne pas s'en
 * contenter : que React monte, qu'un écran s'affiche, qu'un clic marche. La
 * page est une coquille (`<div id="root">`) remplie par le navigateur, et il
 * n'y a pas de navigateur ici. Un composant qui lève à la première ligne de
 * rendu passerait ce test au vert.
 *
 * Le choix de ne pas monter Playwright est délibéré : il ajouterait à un dépôt
 * qui compte ses dépendances un navigateur de 300 Mo à télécharger sur chaque
 * exécution, pour un produit dont la logique — celle qui peut blesser
 * quelqu'un — est déjà couverte par 238 tests unitaires et la suite RLS. Le
 * jour où un parcours d'écran devra être prouvé de bout en bout, c'est un
 * chantier à lui seul, pas une ligne de CI.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(RACINE, 'apps', 'web', 'dist')

/**
 * Des phrases, pas des noms de variables : la minification renomme les
 * secondes et garde les premières. Chacune répond d'une chose qui doit rester
 * vraie du bundle.
 */
const MARQUEURS = [
  // Le catalogue de textes est embarqué, dans les deux langues. La parité
  // fr/en est vérifiée par `packages/content/copy/parity.test.ts` ; ce qu'on
  // vérifie ici, c'est qu'elle arrive jusqu'au bundle.
  { texte: 'Un petit pas, accompagné.', dit: 'le catalogue français est embarqué' },
  { texte: 'One small step, with someone beside you.', dit: 'le catalogue anglais est embarqué' },
  // Trois fonctions que le produit ne peut pas perdre en silence : le partage
  // explicite du journal (issue #11), la modération, et le geste de protection.
  { texte: 'Partager avec mon binôme', dit: 'le partage du journal est embarqué' },
  { texte: 'Signaler un problème', dit: 'le signalement est embarqué' },
  { texte: 'Bloquer cette relation', dit: 'le blocage est embarqué' },
]

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.json': 'application/json',
}

// Sortie franche plutôt qu'exception : une trace de pile dans un journal de CI
// noie la seule ligne qu'on est venu lire.
const echouer = (message) => {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!existsSync(DIST)) {
  echouer(`aucun build à sonder dans ${DIST}. Lancez « npm run build » d'abord.`)
}

// Serveur statique minimal : le but est de vérifier ce qui est servi, pas
// d'écrire un serveur. Le `normalize` empêche un chemin de sortir de `dist`.
const serveur = createServer((requete, reponse) => {
  const chemin = decodeURIComponent(new URL(requete.url, 'http://localhost').pathname)
  const cible = join(DIST, normalize(chemin === '/' ? '/index.html' : chemin))
  if (!cible.startsWith(DIST) || !existsSync(cible) || !statSync(cible).isFile()) {
    reponse.writeHead(404).end('introuvable')
    return
  }
  reponse.writeHead(200, { 'content-type': TYPES[extname(cible)] ?? 'application/octet-stream' })
  createReadStream(cible).pipe(reponse)
})

await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok))
const base = `http://127.0.0.1:${serveur.address().port}`

try {
  const page = await fetch(`${base}/`)
  if (page.status !== 200) echouer(`la page d'accueil répond ${page.status}`)
  const html = await page.text()

  if (!html.includes('id="root"')) echouer('la page ne porte plus le point de montage « root »')
  console.log('✓ la page d’accueil répond 200 et porte son point de montage')

  // Tout ce que la page réclame doit exister. On ratisse `src` et `href` :
  // scripts, feuilles de style, icône.
  const ressources = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map(([, url]) => url)
  if (ressources.length === 0) echouer('la page ne référence aucune ressource : build vide ?')

  const scripts = []
  for (const url of ressources) {
    const reponse = await fetch(`${base}${url}`)
    if (reponse.status !== 200) echouer(`${url} répond ${reponse.status} — ressource absente du build`)
    const corps = await reponse.text()
    if (corps.length === 0) echouer(`${url} est servi vide`)
    if (url.endsWith('.js')) scripts.push({ url, corps })
  }
  console.log(`✓ les ${ressources.length} ressources référencées répondent 200`)

  if (scripts.length === 0) echouer('la page ne charge aucun JavaScript')

  // Le point d'entrée charge ses morceaux à la demande : les marqueurs peuvent
  // vivre dans n'importe lequel. On sonde donc tout le JavaScript du build, et
  // pas seulement celui que l'index nomme.
  const tout = [
    ...scripts.map(({ corps }) => corps),
    ...[...new Set(
      scripts.flatMap(({ corps }) => [...corps.matchAll(/["'`](\/assets\/[^"'`]+\.js)["'`]/g)].map(([, url]) => url)),
    )].map((url) => readFileSync(join(DIST, url), 'utf8')),
  ].join('\n')

  const absents = MARQUEURS.filter(({ texte }) => !tout.includes(texte))
  if (absents.length > 0) {
    for (const { texte, dit } of absents) console.error(`  manquant : « ${texte} » — ${dit}`)
    echouer(`${absents.length} marqueur(s) vital(aux) absent(s) du bundle servi`)
  }
  console.log(`✓ les ${MARQUEURS.length} marqueurs vitaux sont dans le JavaScript servi`)

  console.log('\nFumée : le build est servable et complet.')
  console.log('Non prouvé ici : que React monte et qu’un écran s’affiche.')
} finally {
  serveur.close()
}
