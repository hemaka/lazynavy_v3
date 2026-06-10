import type { SQLiteBindValue, SQLiteDatabase } from 'expo-sqlite'

export type SyncEntity = 'log' | 'supply' | 'equipment' | 'manual' | 'voyage' | 'vessel' | 'location_point' | 'presence_event'
export type SyncAction = 'create' | 'update' | 'delete'
export type SyncStatus = 'pending' | 'syncing' | 'failed'

export interface PendingUpdate {
  id: string
  entity: SyncEntity
  action: SyncAction
  resourceId: string
  vesselId: string | null
  payload: unknown
  status: SyncStatus
  attempts: number
  nextAttemptAt: number | null
  createdAt: number
  lastError: string | null
}

interface PendingRow {
  id: string
  entity: string
  action: string
  resource_id: string
  vessel_id: string | null
  payload: string
  status: string
  attempts: number
  next_attempt_at: number | null
  created_at: number
  last_error: string | null
}

const MAX_ATTEMPTS = 6
const BACKOFF_MS = [2_000, 8_000, 30_000, 120_000, 600_000, 3_600_000]

function rowToPending(row: PendingRow): PendingUpdate {
  return {
    id: row.id,
    entity: row.entity as SyncEntity,
    action: row.action as SyncAction,
    resourceId: row.resource_id,
    vesselId: row.vessel_id,
    payload: JSON.parse(row.payload),
    status: row.status as SyncStatus,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    lastError: row.last_error,
  }
}

function nextId() {
  return `v3-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export class SyncQueue {
  constructor(private readonly db: SQLiteDatabase) {}

  async enqueue(input: { entity: SyncEntity; action: SyncAction; resourceId: string; vesselId?: string | null; payload: unknown }): Promise<string> {
    const id = nextId()
    await this.db.runAsync(
      `INSERT INTO pending_updates (id, entity, action, resource_id, vessel_id, payload, status, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [id, input.entity, input.action, input.resourceId, input.vesselId ?? null, JSON.stringify(input.payload), Date.now()],
    )
    return id
  }

  async nextBatch(limit = 20): Promise<PendingUpdate[]> {
    const rows = await this.db.getAllAsync<PendingRow>(
      `SELECT * FROM pending_updates
       WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
       ORDER BY created_at ASC LIMIT ?`,
      [Date.now(), limit],
    )
    return rows.map(rowToPending)
  }

  markSyncing(id: string) {
    return this.db.runAsync(`UPDATE pending_updates SET status = 'syncing' WHERE id = ?`, [id])
  }

  complete(id: string) {
    return this.db.runAsync(`DELETE FROM pending_updates WHERE id = ?`, [id])
  }

  async recordFailure(id: string, error: string): Promise<void> {
    const row = await this.db.getFirstAsync<{ attempts: number }>(`SELECT attempts FROM pending_updates WHERE id = ?`, [id])
    if (!row) return
    const attempts = row.attempts + 1
    if (attempts >= MAX_ATTEMPTS) {
      await this.db.runAsync(`UPDATE pending_updates SET status = 'failed', attempts = ?, last_error = ?, next_attempt_at = NULL WHERE id = ?`, [attempts, error, id])
      return
    }
    const nextAttemptAt = Date.now() + (BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? BACKOFF_MS[BACKOFF_MS.length - 1])
    await this.db.runAsync(`UPDATE pending_updates SET status = 'pending', attempts = ?, last_error = ?, next_attempt_at = ? WHERE id = ?`, [attempts, error, nextAttemptAt, id])
  }

  async countPending(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM pending_updates WHERE status IN ('pending', 'syncing')`)
    return Number(row?.n ?? 0)
  }

  async retryFailed(): Promise<number> {
    const row = await this.db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM pending_updates WHERE status = 'failed'`)
    await this.db.runAsync(`UPDATE pending_updates SET status = 'pending', attempts = 0, next_attempt_at = NULL WHERE status = 'failed'`)
    return Number(row?.n ?? 0)
  }

  listForResource(entity: SyncEntity, resourceId: string): Promise<PendingUpdate[]> {
    return this.db.getAllAsync<PendingRow>(
      `SELECT * FROM pending_updates WHERE entity = ? AND resource_id = ? ORDER BY created_at ASC`,
      [entity, resourceId] as SQLiteBindValue[],
    ).then((rows) => rows.map(rowToPending))
  }
}
