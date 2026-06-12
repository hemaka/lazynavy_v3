import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import type { RowDataPacket } from 'mysql2'
import { PrismaService } from '../prisma/prisma.service'

type LegacyPlaceRow = RowDataPacket & {
  id: string
  kind: string
  type: string
  lat: number
  lng: number
  name: string
  slug: string
  info: unknown
  country: string | null
  description: string | null
  search_txt: string | null
  ex: unknown
  status: number
  ex_id: number | null
}

type LegacyPlaceInfo = {
  hasDock?: boolean | null
  hasShop?: boolean | null
  seabeds?: string[] | null
  bookable?: boolean | null
  hasBeach?: boolean | null
  maxDraft?: number | null
  timezone?: string | null
  hasPontoon?: boolean | null
  protections?: string[] | null
  mooringTypes?: string[] | null
  hasMooringBuoy?: boolean | null
  hasWaterSource?: boolean | null
  multihullFriendly?: boolean | null
}

type LegacyPlaceExtra = {
  name?: string | null
  url?: string | null
  phone?: string | null
  rating?: number | null
  picture?: string | null
  maxDraft?: number | null
  maxLength?: number | null
  regionName?: string | null
  timezone?: string | null
  bookable?: boolean | null
  counts?: { comments?: number | null } | null
  media?: { url?: string | null } | null
}

type CategoryModel = {
  category: 'marina' | 'anchorage' | 'dry_dock' | 'buoy_mooring' | 'public_quay' | 'hazard' | 'other'
  categoryGroup: 'berthing' | 'service' | 'hazard' | 'other'
  subtype: 'marina' | 'anchorage' | 'dry_dock' | 'buoy_mooring' | 'public_quay' | 'hazard' | 'other'
}

function parseJson<T>(value: unknown): T | null {
  if (!value) return null
  if (typeof value === 'object') return value as T
  if (typeof value !== 'string') return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function toJson(value: unknown) {
  return value ?? undefined
}

function toCategoryModel(kind: string, type: string): CategoryModel {
  const normalizedKind = kind.trim().toLowerCase()
  const normalizedType = type.trim().toLowerCase()
  if (normalizedKind === 'mooring' && normalizedType === 'anchor') return { category: 'anchorage', categoryGroup: 'berthing', subtype: 'anchorage' }
  if (normalizedKind === 'mooring' && normalizedType === 'buoy') return { category: 'buoy_mooring', categoryGroup: 'berthing', subtype: 'buoy_mooring' }
  if (normalizedKind === 'mooring' && normalizedType === 'prohibited') return { category: 'hazard', categoryGroup: 'hazard', subtype: 'hazard' }
  if (normalizedKind === 'port' && normalizedType === 'dry-berthing') return { category: 'dry_dock', categoryGroup: 'service', subtype: 'dry_dock' }
  if (normalizedKind === 'port' && (normalizedType === 'jetty' || normalizedType === 'public_quay')) return { category: 'public_quay', categoryGroup: 'berthing', subtype: 'public_quay' }
  if (normalizedKind === 'port') return { category: 'marina', categoryGroup: 'berthing', subtype: 'marina' }
  return { category: 'other', categoryGroup: 'other', subtype: 'other' }
}

function mapPoiStatus(status: number) {
  if (status === 1) return 'active'
  if (status === 2) return 'restricted'
  if (status === 3) return 'temporarily_closed'
  return 'draft'
}

function inferBerthingTypes(subtype: CategoryModel['subtype'], mooringTypes?: string[] | null) {
  if (mooringTypes?.length) return mooringTypes
  if (subtype === 'anchorage') return ['anchor']
  if (subtype === 'buoy_mooring') return ['buoy']
  if (subtype === 'public_quay') return ['quay']
  if (subtype === 'dry_dock') return ['dry_dock']
  if (subtype === 'marina') return ['dock']
  return []
}

function normalizeName(rawName: string, extra?: LegacyPlaceExtra | null) {
  const trimmed = rawName.trim()
  if (/^[a-f0-9]{32}$/i.test(trimmed) && extra?.name?.trim()) return extra.name.trim()
  return trimmed
}

function boolOrNull(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

async function main() {
  const legacyConfig = {
    host: process.env.LEGACY_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.LEGACY_DB_PORT ?? 3306),
    user: process.env.LEGACY_DB_USERNAME ?? process.env.LEGACY_DB_USER ?? 'root',
    password: process.env.LEGACY_DB_PASSWORD ?? '123456',
    database: process.env.LEGACY_DB_DATABASE ?? 'lazynavy_old',
  }

  const prisma = new PrismaService()
  const mysqlConn = process.env.LEGACY_PLACES_JSON
    ? null
    : await mysql.createConnection({ ...legacyConfig, charset: 'utf8mb4' })

  try {
    await prisma.$connect()
    const rows = process.env.LEGACY_PLACES_JSON
      ? JSON.parse(await readFile(process.env.LEGACY_PLACES_JSON, 'utf8')) as LegacyPlaceRow[]
      : await (async () => {
          const [result] = await mysqlConn!.query<LegacyPlaceRow[]>(
            `SELECT id, kind, type, lat, lng, name, slug, info, country, description, search_txt, ex, status, ex_id
             FROM places
             ORDER BY updated_at DESC, created_at DESC`,
          )
          return result
        })()

    let updated = 0
    let created = 0
    let deletedBerthing = 0
    const now = new Date()

    for (const row of rows) {
      const info = parseJson<LegacyPlaceInfo>(row.info)
      const extra = parseJson<LegacyPlaceExtra>(row.ex)
      const categoryModel = toCategoryModel(row.kind, row.type)
      const name = normalizeName(row.name, extra)
      const picture = extra?.picture ?? extra?.media?.url ?? null
      const commonData = {
        version: { increment: 1 },
        legacySource: 'legacy_places',
        legacyUuid: row.id,
        legacyExId: row.ex_id || null,
        kind: row.kind,
        type: row.type,
        category: categoryModel.category,
        categoryGroup: categoryModel.categoryGroup,
        subtype: categoryModel.subtype,
        lat: Number(row.lat),
        lng: Number(row.lng),
        name,
        slug: row.slug || row.id,
        region: extra?.regionName ?? null,
        country: row.country,
        address: extra?.regionName ?? null,
        searchText: row.search_txt ?? name,
        status: mapPoiStatus(row.status),
        legacyStatus: row.status,
        rating: extra?.rating ?? null,
        confirmCount: extra?.counts?.comments ?? 0,
        commentsCount: extra?.counts?.comments ?? 0,
        phone: extra?.phone ?? null,
        picture,
        sourceUrl: extra?.url ?? null,
        timezone: info?.timezone ?? extra?.timezone ?? null,
        description: row.description,
        bestMonths: [],
        sourcePayload: toJson(row.ex),
        infoPayload: toJson(info),
        extraPayload: {
          sourceCountry: row.country,
          sourceStatus: row.status,
          searchText: row.search_txt,
        },
        syncedAt: now,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      }

      const berthingData = categoryModel.categoryGroup === 'berthing' || categoryModel.categoryGroup === 'service'
        ? {
            berthingTypes: inferBerthingTypes(categoryModel.subtype, info?.mooringTypes),
            maxDraft: info?.maxDraft ?? extra?.maxDraft ?? null,
            maxLength: extra?.maxLength ?? null,
            maxBeam: null,
            multihullFriendly: info?.multihullFriendly ?? null,
            bookable: info?.bookable ?? extra?.bookable ?? null,
            overnightAllowed: categoryModel.categoryGroup === 'berthing' ? true : null,
            stayLimit: null,
            feeInfo: null,
            seabeds: info?.seabeds ?? [],
            protections: info?.protections ?? [],
            mooringTypes: info?.mooringTypes ?? [],
            water: boolOrNull(info?.hasWaterSource),
            power: null,
            fuel: null,
            toilets: null,
            showers: null,
            laundry: null,
            groceries: boolOrNull(info?.hasShop),
            repair: categoryModel.subtype === 'dry_dock' ? true : null,
            wasteDisposal: null,
            dinghyLanding: boolOrNull(info?.hasBeach) ?? boolOrNull(info?.hasPontoon) ?? boolOrNull(info?.hasDock),
          }
        : null

      const existing = await prisma.poi.findUnique({ where: { id: row.id }, include: { berthing: true } })
      if (existing) {
        await prisma.poi.update({
          where: { id: existing.id },
          data: {
            ...commonData,
            berthing: berthingData
              ? existing.berthing
                ? { update: berthingData }
                : { create: berthingData }
              : existing.berthing
                ? { delete: true }
                : undefined,
          },
        })
        if (!berthingData && existing.berthing) deletedBerthing++
        updated++
      } else {
        await prisma.poi.create({
          data: {
            id: row.id,
            ...commonData,
            version: 1,
            berthing: berthingData ? { create: berthingData } : undefined,
          },
        })
        created++
      }
    }

    console.log(`legacy places synced: ${rows.length}; updated=${updated}; created=${created}; deletedBerthing=${deletedBerthing}`)
    const counts = await prisma.poi.groupBy({ by: ['category'], _count: { _all: true } })
    for (const count of counts.sort((a, b) => b._count._all - a._count._all)) {
      console.log(`${count.category}: ${count._count._all}`)
    }
  } finally {
    await mysqlConn?.end()
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
