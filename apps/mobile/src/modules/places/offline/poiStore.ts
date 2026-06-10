import type { SQLiteBindValue } from 'expo-sqlite'
import type { POI, PoiCategory, PoiCategoryGroup, PoiStatus } from '@lazynavy-v3/types'
import { getSharedDb } from '../../../features/offline/db'

/**
 * Local-first POI store backed by shared.db (expo-sqlite).
 *
 * Sync model: server-authoritative + version-based incremental. The server
 * bumps Poi.version when Poi or PoiBerthing changes. The client diff-syncs:
 *   - id not in local → INSERT
 *   - id in local but version differs → UPDATE
 *   - id in local and version matches → SKIP
 */

interface PoiRow {
  id: string
  version: number
  updated_at: number
  name: string
  category: string
  category_group: string
  subtype: string | null
  lat: number
  lng: number
  country: string | null
  region: string | null
  address: string | null
  phone: string | null
  description: string | null
  timezone: string | null
  max_length: number | null
  max_draft: number | null
  max_beam: number | null
  multihull_friendly: number | null
  has_water: number | null
  has_power: number | null
  has_fuel: number | null
  has_repair: number | null
  has_waste_disposal: number | null
  stay_limit: string | null
  fee_info: string | null
  bookable: number | null
  overnight_allowed: number | null
  berthing_types: string | null
  seabeds: string | null
  protections: string | null
  mooring_types: string | null
}

interface PoiDetailRow {
  detail_json: string
}

function intToBool(v: number | null): boolean | undefined {
  if (v === null || v === undefined) return undefined
  return v !== 0
}

function boolToInt(v: boolean | undefined): number | null {
  if (v === undefined) return null
  return v ? 1 : 0
}

function parseArr(v: string | null): string[] {
  if (!v) return []
  return v.split('|').filter(Boolean)
}

function joinArr(v: string[] | undefined): string | null {
  if (!v || v.length === 0) return null
  return v.join('|')
}

function rowToPoi(row: PoiRow): POI {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    category: row.category as PoiCategory,
    categoryGroup: row.category_group as PoiCategoryGroup,
    subtype: (row.subtype ?? row.category) as PoiCategory,
    status: 'active' as PoiStatus,
    kind: '',
    type: '',
    slug: '',
    location: { lat: row.lat, lng: row.lng },
    region: row.region ?? undefined,
    country: row.country ?? undefined,
    address: row.address ?? undefined,
    description: row.description ?? undefined,
    commentsCount: 0,
    phone: row.phone ?? undefined,
    timezone: row.timezone ?? undefined,
    maxDraft: row.max_draft ?? undefined,
    maxLength: row.max_length ?? undefined,
    maxBeam: row.max_beam ?? undefined,
    bookable: intToBool(row.bookable),
    overnightAllowed: intToBool(row.overnight_allowed),
    stayLimit: row.stay_limit ?? undefined,
    feeInfo: row.fee_info ?? undefined,
    multihullFriendly: intToBool(row.multihull_friendly),
    berthingTypes: parseArr(row.berthing_types),
    seabeds: parseArr(row.seabeds),
    protections: parseArr(row.protections),
    mooringTypes: parseArr(row.mooring_types),
    bestMonths: [],
    hasWater: intToBool(row.has_water),
    hasPower: intToBool(row.has_power),
    hasFuel: intToBool(row.has_fuel),
    hasRepair: intToBool(row.has_repair),
    hasWasteDisposal: intToBool(row.has_waste_disposal),
    notes: [],
    warningNotes: [],
    photos: [],
  }
}

function poiToParams(poi: POI, now: number): SQLiteBindValue[] {
  return [
    poi.id,
    poi.version,
    now,
    poi.name,
    poi.category,
    poi.categoryGroup,
    poi.subtype ?? null,
    poi.location.lat,
    poi.location.lng,
    poi.country ?? null,
    poi.region ?? null,
    poi.address ?? null,
    poi.phone ?? null,
    poi.description ?? null,
    poi.timezone ?? null,
    poi.maxLength ?? null,
    poi.maxDraft ?? null,
    poi.maxBeam ?? null,
    boolToInt(poi.multihullFriendly),
    boolToInt(poi.hasWater),
    boolToInt(poi.hasPower),
    boolToInt(poi.hasFuel),
    boolToInt(poi.hasRepair),
    boolToInt(poi.hasWasteDisposal),
    poi.stayLimit ?? null,
    poi.feeInfo ?? null,
    boolToInt(poi.bookable),
    boolToInt(poi.overnightAllowed),
    joinArr(poi.berthingTypes),
    joinArr(poi.seabeds),
    joinArr(poi.protections),
    joinArr(poi.mooringTypes),
  ]
}

const UPSERT_SQL = `
INSERT INTO pois (
  id, version, updated_at,
  name, category, category_group, subtype, lat, lng,
  country, region, address,
  phone, description, timezone,
  max_length, max_draft, max_beam, multihull_friendly,
  has_water, has_power, has_fuel, has_repair, has_waste_disposal,
  stay_limit, fee_info, bookable, overnight_allowed,
  berthing_types, seabeds, protections, mooring_types
) VALUES (?, ?, ?,  ?, ?, ?, ?, ?, ?,  ?, ?, ?,  ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?, ?, ?,  ?, ?, ?, ?,  ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  version = excluded.version,
  updated_at = excluded.updated_at,
  name = excluded.name, category = excluded.category, category_group = excluded.category_group, subtype = excluded.subtype,
  lat = excluded.lat, lng = excluded.lng,
  country = excluded.country, region = excluded.region, address = excluded.address,
  phone = excluded.phone, description = excluded.description, timezone = excluded.timezone,
  max_length = excluded.max_length, max_draft = excluded.max_draft, max_beam = excluded.max_beam, multihull_friendly = excluded.multihull_friendly,
  has_water = excluded.has_water, has_power = excluded.has_power, has_fuel = excluded.has_fuel, has_repair = excluded.has_repair, has_waste_disposal = excluded.has_waste_disposal,
  stay_limit = excluded.stay_limit, fee_info = excluded.fee_info, bookable = excluded.bookable, overnight_allowed = excluded.overnight_allowed,
  berthing_types = excluded.berthing_types, seabeds = excluded.seabeds, protections = excluded.protections, mooring_types = excluded.mooring_types
`.trim()

export interface SyncStats {
  inserted: number
  updated: number
  skipped: number
}

export interface QueryByBBoxOpts {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
  category?: string
  limit?: number
}

class PoiStore {
  /**
   * Diff-sync a batch of POIs from the server into local. Compares server
   * `version` to the cached row's `version`; only upserts changed/new rows.
   */
  async syncFromServerList(items: POI[]): Promise<SyncStats> {
    if (items.length === 0) return { inserted: 0, updated: 0, skipped: 0 }
    const db = await getSharedDb()
    const now = Date.now()

    // Fetch all existing versions in one query (avoids N round-trips).
    const ids = items.map((p) => p.id)
    const placeholders = ids.map(() => '?').join(',')
    const existingRows = await db.getAllAsync<{ id: string; version: number }>(
      `SELECT id, version FROM pois WHERE id IN (${placeholders})`,
      ids,
    )
    const existing = new Map<string, number>()
    for (const row of existingRows) existing.set(row.id, row.version)

    let inserted = 0
    let updated = 0
    let skipped = 0

    await db.withTransactionAsync(async () => {
      for (const poi of items) {
        const localVer = existing.get(poi.id)
        if (localVer === poi.version) {
          skipped++
          continue
        }
        await db.runAsync(UPSERT_SQL, poiToParams(poi, now))
        if (localVer === undefined) inserted++
        else updated++
      }
    })

    return { inserted, updated, skipped }
  }

  /** Bounding-box viewport query. Optionally filtered by category. */
  async queryByBBox(opts: QueryByBBoxOpts): Promise<POI[]> {
    const db = await getSharedDb()
    const params: SQLiteBindValue[] = [opts.minLat, opts.maxLat, opts.minLng, opts.maxLng]
    let sql = `SELECT * FROM pois WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`
    if (opts.category && opts.category !== 'all') {
      sql += ` AND (subtype = ? OR category = ?)`
      params.push(opts.category, opts.category)
    }
    sql += ` LIMIT ?`
    params.push(opts.limit ?? 500)
    const rows = await db.getAllAsync<PoiRow>(sql, params)
    return rows.map(rowToPoi)
  }

  async getById(id: string): Promise<POI | null> {
    const db = await getSharedDb()
    const detailRow = await db.getFirstAsync<PoiDetailRow>(
      `SELECT detail_json FROM poi_detail_cache WHERE id = ?`,
      [id],
    )
    if (detailRow?.detail_json) {
      try {
        return JSON.parse(detailRow.detail_json) as POI
      } catch {
        await db.runAsync(`DELETE FROM poi_detail_cache WHERE id = ?`, [id])
      }
    }

    const row = await db.getFirstAsync<PoiRow>(`SELECT * FROM pois WHERE id = ?`, [id])
    return row ? rowToPoi(row) : null
  }

  async upsertDetail(poi: POI): Promise<void> {
    const db = await getSharedDb()
    const now = Date.now()
    await this.syncFromServerList([poi])
    await db.runAsync(
      `
        INSERT INTO poi_detail_cache (id, version, updated_at, detail_json)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          updated_at = excluded.updated_at,
          detail_json = excluded.detail_json
      `,
      [poi.id, poi.version, now, JSON.stringify(poi)],
    )
  }

  /**
   * Full-text search across name/description/country/region/address using
   * SQLite FTS5. Supports prefix matching with the trailing *.
   */
  async search(query: string, opts?: { limit?: number }): Promise<POI[]> {
    const trimmed = query.trim()
    if (!trimmed) return []
    const db = await getSharedDb()
    const ftsTerm = ftsEscape(trimmed) + '*'
    const rows = await db.getAllAsync<PoiRow>(
      `SELECT pois.* FROM pois JOIN pois_fts ON pois_fts.id = pois.id WHERE pois_fts MATCH ? LIMIT ?`,
      [ftsTerm, opts?.limit ?? 100],
    )
    return rows.map(rowToPoi)
  }

  async count(): Promise<number> {
    const db = await getSharedDb()
    const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM pois`)
    return Number(row?.n ?? 0)
  }
}

function ftsEscape(s: string): string {
  // Wrap whole term in double-quotes and escape internal double-quotes by
  // doubling them, so FTS5 treats it as a single literal token.
  return '"' + s.replace(/"/g, '""') + '"'
}

export const poiStore = new PoiStore()
