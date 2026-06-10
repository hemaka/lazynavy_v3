import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import type { POI, PoiCategory, PoiRegionSummary } from '@lazynavy-v3/types'
import { PrismaService } from '../../prisma/prisma.service'
import { LogsService } from '../logs/logs.service'
import { RewardsService } from '../rewards/rewards.service'
import { VesselsService } from '../vessels/vessels.service'

export interface CreatePoiInput {
  name: string
  type: string
  scope?: string
  lat: number
  lng: number
  description?: string
}

export interface CreateDiscoveryPointInput {
  poiId?: string
  name: string
  type: string
  lat: number
  lng: number
  radiusM?: number
  hidden?: boolean
  hint?: string
  description?: string
}

export interface UnlockDiscoveryInput {
  pointId: string
  voyageId: string
  photoUrl: string
  lat: number
  lng: number
}

export interface ListPoiFilters {
  category?: string
  q?: string
  limit?: number
  lat?: number
  lng?: number
  zoom?: number
}

export interface AddPoiNoteInput {
  text: string
  noteType?: 'info' | 'warning'
}

export interface UpsertPoiReviewInput {
  rating: number
  comment?: string
}

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
    private readonly rewards: RewardsService,
    private readonly vessels: VesselsService,
  ) {}

  async listPois(filters: ListPoiFilters = {}): Promise<POI[]> {
    const limit = clampLimit(filters.limit, 220)
    const rows = await this.prisma.poi.findMany({
      where: {
        ...(filters.q?.trim()
          ? {
              OR: [
                { name: { contains: filters.q.trim(), mode: 'insensitive' } },
                { description: { contains: filters.q.trim(), mode: 'insensitive' } },
                { type: { contains: filters.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(limit * 3, limit),
    })

    return rows
      .map((poi) => this.toPoiDto(poi))
      .filter((poi) => !filters.category || filters.category === 'all' || poi.category === filters.category || poi.subtype === filters.category)
      .sort((a, b) => distanceSort(a, b, filters.lat, filters.lng))
      .slice(0, limit)
  }

  async listPoiSummaries(filters: ListPoiFilters = {}): Promise<PoiRegionSummary[]> {
    const pois = await this.listPois({ ...filters, limit: Math.max(filters.limit ?? 600, 600) })
    const cellSize = summaryCellSizeForZoom(filters.zoom ?? 5)
    const groups = new Map<string, {
      latSum: number
      lngSum: number
      count: number
      categories: Partial<Record<PoiCategory, number>>
      region?: string
    }>()

    for (const poi of pois) {
      const latCell = Math.floor(poi.location.lat / cellSize)
      const lngCell = Math.floor(poi.location.lng / cellSize)
      const id = `${latCell}:${lngCell}`
      const group = groups.get(id) ?? {
        latSum: 0,
        lngSum: 0,
        count: 0,
        categories: {},
        region: poi.region ?? poi.country,
      }
      group.latSum += poi.location.lat
      group.lngSum += poi.location.lng
      group.count += 1
      group.categories[poi.category] = (group.categories[poi.category] ?? 0) + 1
      groups.set(id, group)
    }

    return Array.from(groups.entries()).map(([id, group]) => {
      let topCategory: PoiCategory = 'other'
      let topCount = 0
      for (const [category, count] of Object.entries(group.categories) as [PoiCategory, number][]) {
        if (count > topCount) {
          topCategory = category
          topCount = count
        }
      }
      return {
        id,
        location: { lat: group.latSum / group.count, lng: group.lngSum / group.count },
        count: group.count,
        topCategory,
        categories: group.categories,
        region: group.region,
      }
    })
  }

  async getPoiById(id: string): Promise<POI> {
    const poi = await this.prisma.poi.findUnique({ where: { id } })
    if (!poi) throw new BadRequestException('POI not found')
    return this.toPoiDto(poi)
  }

  async createPoi(userId: string, input: CreatePoiInput) {
    if (!input.name?.trim()) throw new BadRequestException('POI name is required')
    validateLatLng(input.lat, input.lng)
    return this.prisma.poi.create({
      data: {
        name: input.name,
        type: input.type,
        scope: input.scope ?? 'public',
        status: input.scope === 'public' ? 'unreviewed' : 'private',
        lat: input.lat,
        lng: input.lng,
        description: input.description,
        createdById: userId,
      },
    })
  }

  async confirmPoi(userId: string, poiId: string) {
    const poi = await this.prisma.poi.findUnique({ where: { id: poiId } })
    if (!poi) throw new BadRequestException('POI not found')
    return this.prisma.$transaction(async (tx) => {
      const confirm = await tx.poiConfirm.upsert({
        where: { poiId_userId: { poiId, userId } },
        create: { poiId, userId },
        update: {},
      })
      const confirmCount = await tx.poiConfirm.count({ where: { poiId } })
      await tx.poi.update({ where: { id: poiId }, data: { confirmCount } })
      return confirm
    })
  }

  listPoiNotes(_poiId: string) {
    return []
  }

  addPoiNote(poiId: string, userId: string, input: AddPoiNoteInput) {
    if (!input.text?.trim()) throw new BadRequestException('Note text is required')
    return {
      id: `local-note-${Date.now()}`,
      status: 'published',
      noteType: input.noteType ?? 'info',
      text: input.text.trim(),
      isPinned: false,
      isConfirmed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      poiId,
    }
  }

  deletePoiNote(_poiId: string, _noteId: string) {
    return { ok: true }
  }

  listPoiReviews(_poiId: string) {
    return []
  }

  upsertPoiReview(poiId: string, userId: string, input: UpsertPoiReviewInput) {
    if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be 1-5')
    }
    return {
      id: `local-review-${Date.now()}`,
      poiId,
      userId,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  listDiscoveryPoints() {
    return this.prisma.discoveryPoint.findMany({
      where: { status: 'approved', hidden: false },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createDiscoveryPoint(input: CreateDiscoveryPointInput) {
    if (!input.name?.trim()) throw new BadRequestException('Discovery name is required')
    validateLatLng(input.lat, input.lng)
    return this.prisma.discoveryPoint.create({
      data: {
        poiId: input.poiId,
        name: input.name,
        type: input.type,
        lat: input.lat,
        lng: input.lng,
        radiusM: input.radiusM ?? 250,
        hidden: input.hidden ?? false,
        hint: input.hint,
        description: input.description,
      },
    })
  }

  async unlockDiscovery(userId: string, input: UnlockDiscoveryInput) {
    if (!input.photoUrl?.trim()) throw new BadRequestException('Discovery photo is required')
    validateLatLng(input.lat, input.lng)
    const point = await this.prisma.discoveryPoint.findFirst({ where: { id: input.pointId, status: 'approved' } })
    if (!point) throw new BadRequestException('Discovery point not found')
    const voyage = await this.prisma.voyage.findFirst({
      where: {
        id: input.voyageId,
        OR: [{ ownerId: userId }, { participants: { some: { userId } } }],
      },
    })
    if (!voyage) throw new ForbiddenException('Voyage not found or not accessible')
    if (!['active', 'completed'].includes(voyage.status)) throw new BadRequestException('Discovery must be unlocked during or after a voyage')
    const vessel = await this.vessels.ensureUserVessel(userId, voyage.vesselId)
    const distanceM = distanceMeters(input.lat, input.lng, point.lat, point.lng)
    const anomalyScore = Math.min(1, distanceM / Math.max(point.radiusM, 1))
    if (distanceM > point.radiusM) throw new BadRequestException('Discovery attempt is outside allowed radius')

    const log = await this.logs.create(userId, {
      vesselId: vessel.id,
      voyageId: voyage.id,
      type: 'discovery',
      title: `Discovery: ${point.name}`,
      body: point.description ?? undefined,
      photoUrl: input.photoUrl,
      lat: input.lat,
      lng: input.lng,
    })

    const unlock = await this.prisma.discoveryUnlock.create({
      data: {
        pointId: point.id,
        userId,
        vesselId: vessel.id,
        voyageId: voyage.id,
        logEntryId: log.id,
        photoUrl: input.photoUrl,
        lat: input.lat,
        lng: input.lng,
        anomalyScore,
      },
    })

    await this.prisma.discoveryPoint.update({ where: { id: point.id }, data: { discoveredById: userId } })
    await this.rewards.grant({
      ruleKey: 'discovery.unlocked',
      userId,
      vesselId: vessel.id,
      sourceType: 'discovery',
      sourceId: unlock.id,
      anomalyScore,
    })

    return unlock
  }

  private toPoiDto(poi: {
    id: string
    name: string
    type: string
    status: string
    lat: number
    lng: number
    description: string | null
    confirmCount: number
    updatedAt: Date
  }): POI {
    const category = typeToCategory(poi.type)
    return {
      id: poi.id,
      version: Math.max(1, Math.floor(poi.updatedAt.getTime() / 1000)),
      name: poi.name,
      category,
      categoryGroup: category === 'hazard' ? 'hazard' : category === 'other' ? 'other' : 'berthing',
      subtype: category,
      status: poi.status === 'private' ? 'draft' : 'active',
      kind: poi.type,
      type: poi.type,
      slug: poi.id,
      location: { lat: poi.lat, lng: poi.lng },
      description: poi.description ?? undefined,
      commentsCount: poi.confirmCount,
      rating: undefined,
      seabeds: [],
      protections: [],
      berthingTypes: [],
      mooringTypes: [],
      bestMonths: [],
      notes: [],
      warningNotes: [],
      photos: [],
    }
  }
}

function validateLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new BadRequestException('Invalid latitude')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new BadRequestException('Invalid longitude')
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000
  const p1 = lat1 * Math.PI / 180
  const p2 = lat2 * Math.PI / 180
  const dp = (lat2 - lat1) * Math.PI / 180
  const dl = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function typeToCategory(type: string): PoiCategory {
  const normalized = type.trim().toLowerCase()
  if (['marina', 'harbor', 'harbour', 'port', 'dock', 'yacht_club'].includes(normalized)) return 'marina'
  if (['anchorage', 'anchor'].includes(normalized)) return 'anchorage'
  if (['dry_dock', 'boatyard', 'repair'].includes(normalized)) return 'dry_dock'
  if (['buoy_mooring', 'mooring', 'buoy'].includes(normalized)) return 'buoy_mooring'
  if (['public_quay', 'quay', 'pier'].includes(normalized)) return 'public_quay'
  if (['hazard', 'restricted', 'shoal', 'reef'].includes(normalized)) return 'hazard'
  if (['lighthouse', 'island', 'scenic', 'discovery'].includes(normalized)) return 'other'
  return 'other'
}

function clampLimit(limit: number | undefined, fallback: number) {
  if (!Number.isFinite(limit)) return fallback
  return Math.max(1, Math.min(Math.floor(limit!), 1000))
}

function distanceSort(a: POI, b: POI, lat?: number, lng?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 0
  const da = (a.location.lat - lat!) ** 2 + (a.location.lng - lng!) ** 2
  const db = (b.location.lat - lat!) ** 2 + (b.location.lng - lng!) ** 2
  return da - db
}

function summaryCellSizeForZoom(zoom: number) {
  if (zoom >= 8) return 0.25
  if (zoom >= 7) return 0.45
  if (zoom >= 6) return 0.75
  if (zoom >= 5) return 1.2
  return 2.2
}
