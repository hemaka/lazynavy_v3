import { getJson, postJson } from '../../services/http'
import { getBusinessDb } from './db'
import { EntityCache } from './entityCache'
import { SyncQueue, type PendingUpdate } from './syncQueue'

function cacheItems(cache: EntityCache, type: string, items: any[] | undefined) {
  return cache.upsertMany(type, Array.isArray(items) ? items : [])
}

export class SyncWorker {
  static async bootstrap(userId = 'dev') {
    const payload = await getJson<any>('/sync/bootstrap')
    const cache = await EntityCache.forUser(userId)
    await cacheItems(cache, 'vessel', payload.vessels)
    await cacheItems(cache, 'voyage', payload.voyages)
    await cacheItems(cache, 'log', payload.logs)
    await cacheItems(cache, 'supply', payload.supplies)
    await cacheItems(cache, 'equipment', payload.equipment)
    await cacheItems(cache, 'manual', payload.manuals)
    return payload
  }

  static async pushPending(userId = 'dev') {
    const db = await getBusinessDb(userId)
    const queue = new SyncQueue(db)
    const batch = await queue.nextBatch(20)
    for (const update of batch) {
      await pushOne(queue, update)
    }
    return queue.countPending()
  }

  static async pendingCount(userId = 'dev') {
    const db = await getBusinessDb(userId)
    return new SyncQueue(db).countPending()
  }
}

async function pushOne(queue: SyncQueue, update: PendingUpdate) {
  await queue.markSyncing(update.id)
  try {
    await postJson('/sync/mutations', {
      clientMutationId: update.id,
      vesselId: update.vesselId,
      entityType: update.entity,
      operation: update.action,
      payload: update.payload,
    })
    await queue.complete(update.id)
  } catch (err: any) {
    await queue.recordFailure(update.id, err?.message ?? 'Sync failed')
  }
}
