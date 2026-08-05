/**
 * Un `localStorage` en mémoire, remis à zéro avant chaque test.
 *
 * Le cache de contenu hors ligne, l'état local et la file de synchronisation
 * passent tous par `localStorage`. Les tester demande un stockage réel — pas un
 * espion : ce qui compte est ce que la valeur devient après un aller-retour
 * écriture/lecture, pas le fait qu'une méthode ait été appelée.
 */
import { beforeEach } from 'vitest'

class MemoryStorage implements Storage {
  private entries = new Map<string, string>()

  get length() { return this.entries.size }
  key(index: number) { return [...this.entries.keys()][index] ?? null }
  getItem(key: string) { return this.entries.get(key) ?? null }
  setItem(key: string, value: string) { this.entries.set(key, String(value)) }
  removeItem(key: string) { this.entries.delete(key) }
  clear() { this.entries.clear() }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })

beforeEach(() => { storage.clear() })
