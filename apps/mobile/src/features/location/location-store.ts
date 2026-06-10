import type { SQLiteDatabase } from 'expo-sqlite'
import { getBusinessDb } from '../offline/db'
import { SyncQueue } from '../offline/syncQueue'
import type { LocationPoint } from './types'

interface LocationPointRow {
  id: string
  user_id: string
  vessel_id: string | null
  voyage_id: string | null
  mode: string
  presence_status: string
  lat: number
  lng: number
  accuracy_m: number | null
  speed_mps: number | null
  heading: number | null
  altitude: number | null
  recorded_at: number
  sync_status: string
  quality: string
}

export class LocationStore {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly queue: SyncQueue,
  ) {}

  static async forUser(userId: string) {
    const db = await getBusinessDb(userId)
    return new LocationStore(db, new SyncQueue(db))
  }

  async insertPoint(point: LocationPoint) {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO location_points (
        id, user_id, vessel_id, voyage_id, mode, presence_status,
        lat, lng, accuracy_m, speed_mps, heading, altitude,
        recorded_at, sync_status, quality, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        point.id,
        point.userId,
        point.vesselId ?? null,
        point.voyageId ?? null,
        point.mode,
        point.presenceStatus,
        point.lat,
        point.lng,
        point.accuracyM ?? null,
        point.speedMps ?? null,
        point.heading ?? null,
        point.altitude ?? null,
        point.recordedAt,
        point.quality,
        Date.now(),
      ],
    )

    await this.queue.enqueue({
      entity: 'location_point',
      action: 'create',
      resourceId: point.id,
      vesselId: point.vesselId ?? null,
      payload: point,
    })
  }

  async latestPoint(): Promise<LocationPoint | null> {
    const row = await this.db.getFirstAsync<LocationPointRow>(
      `SELECT * FROM location_points ORDER BY recorded_at DESC LIMIT 1`,
    )
    return row ? rowToPoint(row) : null
  }
}

function rowToPoint(row: LocationPointRow): LocationPoint {
  return {
    id: row.id,
    userId: row.user_id,
    vesselId: row.vessel_id,
    voyageId: row.voyage_id,
    mode: row.mode as LocationPoint['mode'],
    presenceStatus: row.presence_status as LocationPoint['presenceStatus'],
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracy_m,
    speedMps: row.speed_mps,
    heading: row.heading,
    altitude: row.altitude,
    recordedAt: row.recorded_at,
    quality: row.quality as LocationPoint['quality'],
  }
}
