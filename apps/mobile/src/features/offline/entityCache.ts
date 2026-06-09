import type { SQLiteDatabase } from 'expo-sqlite'
import { getBusinessDb } from './db'

export interface CachedEntity<T = any> {
  id: string
  entityType: string
  vesselId: string | null
  updatedAt: number
  serverUpdatedAt: string | null
  syncState: 'clean' | 'dirty'
  payload: T
}

interface CacheRow {
  id: string
  entity_type: string
  vessel_id: string | null
  updated_at: number
  server_updated_at: string | null
  sync_state: string
  payload: string
}

function rowToEntity<T>(row: CacheRow): CachedEntity<T> {
  return {
    id: row.id,
    entityType: row.entity_type,
    vesselId: row.vessel_id,
    updatedAt: row.updated_at,
    serverUpdatedAt: row.server_updated_at,
    syncState: row.sync_state as 'clean' | 'dirty',
    payload: JSON.parse(row.payload),
  }
}

export class EntityCache {
  constructor(private readonly db: SQLiteDatabase) {}

  static async forUser(userId = 'dev') {
    return new EntityCache(await getBusinessDb(userId))
  }

  async upsert(entityType: string, item: any, opts: { vesselId?: string | null; syncState?: 'clean' | 'dirty' } = {}) {
    const id = String(item.id)
    const now = Date.now()
    await this.db.runAsync(
      `INSERT INTO entity_cache (id, entity_type, vessel_id, updated_at, server_updated_at, sync_state, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         entity_type = excluded.entity_type,
         vessel_id = excluded.vessel_id,
         updated_at = excluded.updated_at,
         server_updated_at = excluded.server_updated_at,
         sync_state = excluded.sync_state,
         payload = excluded.payload`,
      [id, entityType, opts.vesselId ?? item.vesselId ?? null, now, item.updatedAt ?? null, opts.syncState ?? 'clean', JSON.stringify(item)],
    )
  }

  async upsertMany(entityType: string, items: any[]) {
    await this.db.withTransactionAsync(async () => {
      for (const item of items) await this.upsert(entityType, item)
    })
  }

  async list<T = any>(entityType: string, vesselId?: string | null): Promise<CachedEntity<T>[]> {
    const rows = vesselId
      ? await this.db.getAllAsync<CacheRow>(`SELECT * FROM entity_cache WHERE entity_type = ? AND vessel_id = ? ORDER BY updated_at DESC`, [entityType, vesselId])
      : await this.db.getAllAsync<CacheRow>(`SELECT * FROM entity_cache WHERE entity_type = ? ORDER BY updated_at DESC`, [entityType])
    return rows.map((row) => rowToEntity<T>(row))
  }

  async get<T = any>(id: string): Promise<CachedEntity<T> | null> {
    const row = await this.db.getFirstAsync<CacheRow>(`SELECT * FROM entity_cache WHERE id = ?`, [id])
    return row ? rowToEntity<T>(row) : null
  }
}
