import { Platform } from 'react-native'
import { getJson, postJson } from '../../services/http'
import { getBusinessDb } from '../../features/offline/db'
import { EntityCache } from '../../features/offline/entityCache'
import { SyncQueue } from '../../features/offline/syncQueue'

export interface ManualDocument {
  id: string
  title: string
  type: string
  contentText?: string | null
  offlinePriority: string
}

export function listVesselManuals(vesselId: string) {
  return getJson<ManualDocument[]>(`/vessels/${vesselId}/manuals`)
}

export function createVesselManual(vesselId: string, type: 'vessel_manual' | 'certificate' | 'insurance' = 'vessel_manual') {
  return postJson<ManualDocument>('/manuals', {
    vesselId,
    type,
    title: type === 'vessel_manual' ? 'Boat Manual' : type === 'certificate' ? 'Registration Certificate' : 'Insurance Policy',
    contentText: 'Stored for offline boat access.',
    offlinePriority: type === 'vessel_manual' ? 'high' : 'normal',
  })
}

export function searchManuals(query: string) {
  return getJson<ManualDocument[]>(`/manuals/search?q=${encodeURIComponent(query)}`)
}

function assertOfflineCacheAvailable() {
  if (Platform.OS === 'web') {
    throw new Error('Offline cache is only available on native platforms.')
  }
}

export async function listCachedManuals(vesselId?: string | null) {
  if (Platform.OS === 'web') return []
  const cache = await EntityCache.forUser()
  return (await cache.list<ManualDocument>('manual', vesselId)).map((item) => item.payload)
}

export async function cacheManuals(items: ManualDocument[], vesselId?: string | null) {
  if (Platform.OS === 'web') return
  const cache = await EntityCache.forUser()
  await Promise.all(items.map((item) => cache.upsert('manual', item, { vesselId: vesselId ?? null })))
}

export async function createVesselManualOffline(vesselId: string, type: 'vessel_manual' | 'certificate' | 'insurance' = 'vessel_manual') {
  assertOfflineCacheAvailable()
  const local: ManualDocument = {
    id: `local-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: type === 'vessel_manual' ? 'Boat Manual' : type === 'certificate' ? 'Registration Certificate' : 'Insurance Policy',
    type,
    contentText: 'Stored for offline boat access.',
    offlinePriority: type === 'vessel_manual' ? 'high' : 'normal',
  }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('manual', local, { vesselId, syncState: 'dirty' })
  await queue.enqueue({ entity: 'manual', action: 'create', resourceId: local.id, vesselId, payload: { ...local, vesselId } })
  return local
}
