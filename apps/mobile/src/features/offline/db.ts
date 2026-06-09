import * as SQLite from 'expo-sqlite'
import { BUSINESS_MIGRATIONS, runMigrations } from './migrations'

const businessDbs = new Map<string, SQLite.SQLiteDatabase>()
const businessDbReady = new Map<string, Promise<SQLite.SQLiteDatabase>>()

export function getBusinessDb(userId = 'dev'): Promise<SQLite.SQLiteDatabase> {
  const existing = businessDbs.get(userId)
  if (existing) return Promise.resolve(existing)
  const inflight = businessDbReady.get(userId)
  if (inflight) return inflight

  const promise = (async () => {
    const db = await SQLite.openDatabaseAsync(`lazynavy-v3-business-${userId}.db`)
    await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`)
    await runMigrations(db, BUSINESS_MIGRATIONS, `business:${userId.slice(0, 8)}`)
    businessDbs.set(userId, db)
    return db
  })()
  businessDbReady.set(userId, promise)
  return promise
}

export async function closeBusinessDb(userId = 'dev'): Promise<void> {
  const db = businessDbs.get(userId)
  if (!db) return
  await db.closeAsync()
  businessDbs.delete(userId)
  businessDbReady.delete(userId)
}
