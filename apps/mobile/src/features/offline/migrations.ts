import type { SQLiteDatabase } from 'expo-sqlite'

export interface Migration {
  id: number
  name: string
  sql: string
}

export async function runMigrations(db: SQLiteDatabase, migrations: Migration[], label: string): Promise<void> {
  await db.execAsync(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`)
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM meta WHERE key = 'schema_version'`)
  const currentVersion = row?.value ? Number(row.value) : 0
  const pending = migrations.filter((migration) => migration.id > currentVersion).sort((a, b) => a.id - b.id)
  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql)
      await db.runAsync(`INSERT OR REPLACE INTO meta(key, value) VALUES('schema_version', ?)`, [String(migration.id)])
    })
    console.log(`[offline:${label}] applied migration ${migration.id} ${migration.name}`)
  }
}

const B001_INIT_BUSINESS: Migration = {
  id: 1,
  name: 'init_business_cache',
  sql: `
    CREATE TABLE IF NOT EXISTS entity_cache (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      vessel_id TEXT,
      updated_at INTEGER NOT NULL,
      server_updated_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'clean',
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entity_cache_type ON entity_cache(entity_type, updated_at);
    CREATE INDEX IF NOT EXISTS idx_entity_cache_vessel ON entity_cache(vessel_id, entity_type);
    CREATE INDEX IF NOT EXISTS idx_entity_cache_sync ON entity_cache(sync_state);

    CREATE TABLE IF NOT EXISTS pending_updates (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      vessel_id TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER,
      created_at INTEGER NOT NULL,
      last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_updates(status, next_attempt_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_pending_resource ON pending_updates(entity, resource_id);
  `,
}

const B002_LOCATION_POINTS: Migration = {
  id: 2,
  name: 'location_points',
  sql: `
    CREATE TABLE IF NOT EXISTS location_points (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      vessel_id TEXT,
      voyage_id TEXT,
      mode TEXT NOT NULL,
      presence_status TEXT NOT NULL DEFAULT 'unknown',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy_m REAL,
      speed_mps REAL,
      heading REAL,
      altitude REAL,
      recorded_at INTEGER NOT NULL,
      synced_at INTEGER,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      quality TEXT NOT NULL DEFAULT 'good',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_location_points_recorded ON location_points(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_location_points_sync ON location_points(sync_status, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_location_points_voyage ON location_points(voyage_id, recorded_at);
    CREATE INDEX IF NOT EXISTS idx_location_points_mode ON location_points(mode, recorded_at);
  `,
}

const S001_INIT_POIS: Migration = {
  id: 1,
  name: 'init_pois',
  sql: `
    CREATE TABLE IF NOT EXISTS pois (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      category_group TEXT NOT NULL,
      subtype TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      country TEXT,
      region TEXT,
      address TEXT,
      phone TEXT,
      description TEXT,
      timezone TEXT,
      max_length REAL,
      max_draft REAL,
      max_beam REAL,
      multihull_friendly INTEGER,
      has_water INTEGER,
      has_power INTEGER,
      has_fuel INTEGER,
      has_repair INTEGER,
      has_waste_disposal INTEGER,
      stay_limit TEXT,
      fee_info TEXT,
      bookable INTEGER,
      overnight_allowed INTEGER,
      berthing_types TEXT,
      seabeds TEXT,
      protections TEXT,
      mooring_types TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pois_geo ON pois(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);
    CREATE INDEX IF NOT EXISTS idx_pois_subtype ON pois(subtype);
    CREATE INDEX IF NOT EXISTS idx_pois_country ON pois(country);

    CREATE VIRTUAL TABLE IF NOT EXISTS pois_fts USING fts5(
      id UNINDEXED,
      name,
      description,
      country,
      region,
      address
    );

    CREATE TRIGGER IF NOT EXISTS pois_ai AFTER INSERT ON pois BEGIN
      INSERT INTO pois_fts(id, name, description, country, region, address)
      VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.country, ''), COALESCE(new.region, ''), COALESCE(new.address, ''));
    END;

    CREATE TRIGGER IF NOT EXISTS pois_au AFTER UPDATE ON pois BEGIN
      UPDATE pois_fts SET
        name = new.name,
        description = COALESCE(new.description, ''),
        country = COALESCE(new.country, ''),
        region = COALESCE(new.region, ''),
        address = COALESCE(new.address, '')
      WHERE id = new.id;
    END;

    CREATE TRIGGER IF NOT EXISTS pois_ad AFTER DELETE ON pois BEGIN
      DELETE FROM pois_fts WHERE id = old.id;
    END;
  `,
}

const S002_POI_DETAIL_CACHE: Migration = {
  id: 2,
  name: 'poi_detail_cache',
  sql: `
    CREATE TABLE IF NOT EXISTS poi_detail_cache (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      detail_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_poi_detail_cache_updated ON poi_detail_cache(updated_at);
  `,
}

export const SHARED_MIGRATIONS: Migration[] = [S001_INIT_POIS, S002_POI_DETAIL_CACHE]
export const BUSINESS_MIGRATIONS: Migration[] = [B001_INIT_BUSINESS, B002_LOCATION_POINTS]
