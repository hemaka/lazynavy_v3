import { Platform } from 'react-native'
import { getJson, patchJson, postJson } from '../../services/http'
import { getBusinessDb } from '../../features/offline/db'
import { EntityCache } from '../../features/offline/entityCache'
import { SyncQueue } from '../../features/offline/syncQueue'

export interface SupplyItem {
  id: string
  vesselId: string
  name: string
  category: string
  unit: string
  quantity: number
  capacity?: number | null
  warnBelow?: number | null
}

export function listSupplies(vesselId: string, low = false) {
  return getJson<SupplyItem[]>(`/vessels/${vesselId}/supplies${low ? '?low=1' : ''}`)
}

export function createSupply(vesselId: string) {
  return postJson<SupplyItem>(`/vessels/${vesselId}/supplies`, {
    name: 'Fresh Water',
    category: 'water',
    unit: 'L',
    quantity: 40,
    capacity: 200,
    warnBelow: 50,
  })
}

export function adjustSupply(vesselId: string, itemId: string, delta: number) {
  return patchJson<SupplyItem>(`/vessels/${vesselId}/supplies/${itemId}/adjust`, { delta })
}

function assertOfflineCacheAvailable() {
  if (Platform.OS === 'web') {
    throw new Error('Offline cache is only available on native platforms.')
  }
}

export async function listCachedSupplies(vesselId?: string | null) {
  if (Platform.OS === 'web') return []
  const cache = await EntityCache.forUser()
  return (await cache.list<SupplyItem>('supply', vesselId)).map((item) => item.payload)
}

export async function cacheSupplies(items: SupplyItem[]) {
  if (Platform.OS === 'web') return
  const cache = await EntityCache.forUser()
  await cache.upsertMany('supply', items)
}

export async function createSupplyOffline(vesselId: string) {
  assertOfflineCacheAvailable()
  const local: SupplyItem = {
    id: `local-supply-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vesselId,
    name: 'Fresh Water',
    category: 'water',
    unit: 'L',
    quantity: 40,
    capacity: 200,
    warnBelow: 50,
  }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('supply', local, { vesselId, syncState: 'dirty' })
  await queue.enqueue({ entity: 'supply', action: 'create', resourceId: local.id, vesselId, payload: local })
  return local
}

export async function adjustSupplyOffline(item: SupplyItem, delta: number) {
  assertOfflineCacheAvailable()
  const next: SupplyItem = { ...item, quantity: Math.max(0, item.quantity + delta) }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('supply', next, { vesselId: next.vesselId, syncState: 'dirty' })
  await queue.enqueue({
    entity: 'supply',
    action: 'update',
    resourceId: next.id,
    vesselId: next.vesselId,
    payload: { id: next.id, vesselId: next.vesselId, delta, nextQuantity: next.quantity },
  })
  return next
}
