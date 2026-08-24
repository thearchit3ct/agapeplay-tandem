/**
 * Ce que ces tests protègent : qu'une action faite hors ligne parte une fois,
 * et une seule, quand le réseau revient.
 *
 * La file porte des entrées de journal privé et des messages de tandem. Un
 * doublon n'est pas un désagrément cosmétique ici : c'est une confidence
 * écrite une fois qui apparaît deux fois dans le journal de son auteur.
 */
import { describe, expect, it } from 'vitest'
import { clearSyncQueue, enqueueSync, readSyncQueue, removeSync } from './offlineQueue'

const journalEntry = (text: string) => ({
  id: 'journal:abc',
  kind: 'journal_entry' as const,
  payload: { text },
})

describe('file de synchronisation hors ligne', () => {
  it('part vide, et rend une liste vide plutôt que null', async () => {
    expect(readSyncQueue()).toEqual([])
  })

  it('conserve l’ordre dans lequel les actions ont été faites', () => {
    enqueueSync({ id: 'a', kind: 'session_progress', payload: {} })
    enqueueSync({ id: 'b', kind: 'journal_entry', payload: {} })
    enqueueSync({ id: 'c', kind: 'tandem_message', payload: {} })

    expect(readSyncQueue().map((operation) => operation.id)).toEqual(['a', 'b', 'c'])
  })

  it('n’empile pas deux fois la même action, et garde la version la plus récente', () => {
    enqueueSync(journalEntry('premier jet'))
    enqueueSync(journalEntry('texte corrigé'))

    const queue = readSyncQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].payload).toEqual({ text: 'texte corrigé' })
  })

  it('remet une action redéposée en fin de file', () => {
    enqueueSync({ id: 'a', kind: 'session_progress', payload: {} })
    enqueueSync({ id: 'b', kind: 'journal_entry', payload: {} })
    enqueueSync({ id: 'a', kind: 'session_progress', payload: { revu: true } })

    expect(readSyncQueue().map((operation) => operation.id)).toEqual(['b', 'a'])
  })

  it('retire l’action envoyée sans toucher aux suivantes', () => {
    enqueueSync({ id: 'a', kind: 'session_progress', payload: {} })
    enqueueSync({ id: 'b', kind: 'journal_entry', payload: {} })
    removeSync('a')

    expect(readSyncQueue().map((operation) => operation.id)).toEqual(['b'])
  })

  it('ignore une demande de retrait pour une action absente', () => {
    enqueueSync({ id: 'a', kind: 'session_progress', payload: {} })
    removeSync('inconnue')

    expect(readSyncQueue().map((operation) => operation.id)).toEqual(['a'])
  })

  it('repart d’une file vide si le stockage est illisible', () => {
    localStorage.setItem('agapeplay-tandem-sync-queue', 'pas du JSON')

    // Sans ce garde-fou, toute lecture de la file lèverait une exception à
    // chaque retour en ligne — et l'appareil ne synchroniserait plus jamais.
    expect(readSyncQueue()).toEqual([])
    enqueueSync({ id: 'a', kind: 'session_progress', payload: {} })
    expect(readSyncQueue()).toHaveLength(1)
  })
})

describe('vidage de la file', () => {
  it('emporte les opérations en attente — elles portent du journal et des messages', () => {
    enqueueSync({ id: 'journal:1', kind: 'journal_entry', payload: { text: 'À ne pas rejouer après un départ.' } })
    expect(readSyncQueue()).toHaveLength(1)

    clearSyncQueue()

    expect(readSyncQueue()).toEqual([])
  })
})
