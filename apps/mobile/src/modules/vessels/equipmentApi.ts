import { Platform } from 'react-native'
import { getJson, postJson } from '../../services/http'
import { getBusinessDb } from '../../features/offline/db'
import { EntityCache } from '../../features/offline/entityCache'
import { SyncQueue } from '../../features/offline/syncQueue'

export interface EquipmentItem {
  id: string
  vesselId: string
  name: string
  category: string
  status: string
  location?: string | null
  maintenanceIntervalDays?: number | null
  lastServicedAt?: string | null
  nextDueAt?: string | null
}

export function listEquipment(vesselId: string) {
  return getJson<EquipmentItem[]>(`/equipment?vesselId=${vesselId}`)
}

export function listDueEquipment(vesselId: string) {
  return getJson<EquipmentItem[]>(`/equipment/due?vesselId=${vesselId}&withinDays=45`)
}

export function createEquipment(vesselId: string) {
  return postJson<EquipmentItem>('/equipment', {
    vesselId,
    name: 'Main Engine',
    category: 'engine',
    status: 'active',
    location: 'Engine room',
    installedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    maintenanceIntervalDays: 30,
  })
}

export function completeService(equipmentId: string) {
  return postJson(`/equipment/${equipmentId}/maintenance`, {
    type: 'service',
    status: 'done',
    title: 'Routine service',
    performedAt: new Date().toISOString(),
  })
}

function assertOfflineCacheAvailable() {
  if (Platform.OS === 'web') {
    throw new Error('Offline cache is only available on native platforms.')
  }
}

export async function listCachedEquipment(vesselId?: string | null) {
  if (Platform.OS === 'web') return []
  const cache = await EntityCache.forUser()
  return (await cache.list<EquipmentItem>('equipment', vesselId)).map((item) => item.payload)
}

export async function cacheEquipment(items: EquipmentItem[]) {
  if (Platform.OS === 'web') return
  const cache = await EntityCache.forUser()
  await cache.upsertMany('equipment', items)
}

export async function createEquipmentOffline(vesselId: string) {
  assertOfflineCacheAvailable()
  const installedAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString()
  const nextDueAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  const local: EquipmentItem = {
    id: `local-equipment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vesselId,
    name: 'Main Engine',
    category: 'engine',
    status: 'active',
    location: 'Engine room',
    maintenanceIntervalDays: 30,
    lastServicedAt: null,
    nextDueAt,
  }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('equipment', local, { vesselId, syncState: 'dirty' })
  await queue.enqueue({ entity: 'equipment', action: 'create', resourceId: local.id, vesselId, payload: { ...local, installedAt } })
  return local
}

export async function completeServiceOffline(item: EquipmentItem) {
  assertOfflineCacheAvailable()
  const performedAt = new Date().toISOString()
  const nextDueAt = item.maintenanceIntervalDays
    ? new Date(Date.now() + item.maintenanceIntervalDays * 24 * 60 * 60 * 1000).toISOString()
    : item.nextDueAt ?? null
  const next: EquipmentItem = { ...item, lastServicedAt: performedAt, nextDueAt }
  const db = await getBusinessDb()
  const cache = new EntityCache(db)
  const queue = new SyncQueue(db)
  await cache.upsert('equipment', next, { vesselId: next.vesselId, syncState: 'dirty' })
  await queue.enqueue({
    entity: 'equipment',
    action: 'update',
    resourceId: next.id,
    vesselId: next.vesselId,
    payload: { id: next.id, vesselId: next.vesselId, maintenance: { type: 'service', status: 'done', title: 'Routine service', performedAt } },
  })
  return next
}
