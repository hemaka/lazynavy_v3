import { DEFAULT_API_PORT } from '@lazynavy-v3/config'

export const DEFAULT_DATABASE_URL = 'postgresql://lazynavy:lazynavy@localhost:5432/lazynavy_v3?schema=public'

export function envString(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback
  if (value === undefined || value === '') throw new Error(`Missing env ${key}`)
  return value
}

export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`Invalid numeric env ${key}`)
  return value
}

export function apiPort() {
  return envNumber('PORT', DEFAULT_API_PORT)
}
