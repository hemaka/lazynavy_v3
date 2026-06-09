import { Platform } from 'react-native'
import { getJson, postJson } from '../../services/http'
import { getBusinessDb } from '../../features/offline/db'
import { EntityCache } from '../../features/offline/entityCache'
import { SyncQueue } from '../../features/offline/syncQueue'

export interface LogEntry {
  id: string
  vesselId: string
  voyageId?: string | null
  type: string
  title: string
  body?: string | null
  createdAt: string
}

export function listLogs() {
  return getJson<LogEntry[]>('/logs')
}

export function createLog(vesselId: string, voyageId?: string | null) {
  return postJson<LogEntry>('/logs', {
    vesselId,
    voyageId,
    type: 'note',
    title: 'Deck check',
    body: 'Quick V3 log entry from the mobile app.',
  })
}

function assertOfflineCacheAvailable() {
  if (Platform.OS === 'web') {
    throw new Error('Offline cache is only available on native platforms.')
  }
}

export async function listCachedLogs(vesselId?: string | null) {
  if (Platform.OS === 'web') return []
  const cache = await EntityCache.forUser()
  return (await cache.list<LogEntry>('log', vesselId)).map((item) => item.payload)
}

export async function cacheLogs(logs: LogEntry[]) {
  if (Platform.OS === 'web') return
  const cache = await EntityCache.forUser()
  await cache.upsertMany('log', logs)
}

export async function createLogOffline(vesselId: string, voyageId?: string | null) {
  assertOfflineCacheAvailable()
  const local: LogEntry = {
    id: `local-log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vesselId,
    voyageId,
    type: 'note',
    title: 'Deck check',
    body: 'Quick V3 log entry from the mobile app.',
    createdAt: new Date().toISOString(),
  }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('log', local, { vesselId, syncState: 'dirty' })
  await queue.enqueue({ entity: 'log', action: 'create', resourceId: local.id, vesselId, payload: local })
  return local
}
