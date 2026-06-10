import * as SQLite from 'expo-sqlite'
import { BUSINESS_MIGRATIONS, SHARED_MIGRATIONS, runMigrations } from './migrations'

let sharedDb: SQLite.SQLiteDatabase | null = null
let sharedDbReady: Promise<SQLite.SQLiteDatabase> | null = null

export function getSharedDb(): Promise<SQLite.SQLiteDatabase> {
  if (sharedDb) return Promise.resolve(sharedDb)
  if (!sharedDbReady) {
    sharedDbReady = (async () => {
      const db = await SQLite.openDatabaseAsync('lazynavy-v3-shared.db')
      await db.execAsync(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`)
      await runMigrations(db, SHARED_MIGRATIONS, 'shared')
      sharedDb = db
      return db
    })()
  }
  return sharedDbReady
}

export async function closeSharedDb(): Promise<void> {
  if (!sharedDb) return
  await sharedDb.closeAsync()
  sharedDb = null
  sharedDbReady = null
}

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
