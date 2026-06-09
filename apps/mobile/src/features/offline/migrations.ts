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

export const BUSINESS_MIGRATIONS: Migration[] = [B001_INIT_BUSINESS]
