/**
 * Suite RLS : séparée de `npm test`, qui reste hermétique et sans Docker.
 *
 * Ces tests exigent une base Postgres réelle — c'est le sujet. S'ils ne
 * l'atteignent pas, ils échouent bruyamment : une suite de sécurité sautée en
 * silence est le faux vert qu'on cherche justement à éviter.
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rls/**/*.test.ts'],
    globalSetup: ['./tests/rls/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
})
