/**
 * Socle de test du monorepo.
 *
 * ADR-002 engage le projet à traiter les règles qui protègent les personnes
 * comme du code de sécurité. Ce fichier est le premier maillon : il rend les
 * règles métier exécutables sans base de données, sans navigateur et sans
 * réseau.
 *
 * `environment: 'node'` est un choix, pas un défaut : les seules API de
 * navigateur dont les règles testées ont besoin sont `localStorage` et
 * `crypto.randomUUID`, et un stub mémoire de vingt lignes (tests/setup.ts) les
 * couvre. Monter jsdom pour cela chargerait un DOM entier que rien n'observe.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['{packages,apps}/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
})
