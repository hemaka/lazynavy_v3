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
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
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
    const where = buildPoiWhere(filters)
    const rows = await this.prisma.poi.findMany({
      where,
      include: { berthing: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.max(limit * 4, limit),
    })

    return rows
      .map((poi) => this.toPoiDto(poi))
      .sort((a, b) => distanceSort(a, b, filters.lat, filters.lng))
      .slice(0, limit)
  }

  async listPoiSummaries(filters: ListPoiFilters = {}): Promise<PoiRegionSummary[]> {
    const limit = clampLimit(filters.limit, 600)
    const rows = await this.prisma.poi.findMany({
      where: buildPoiWhere(filters),
      include: { berthing: true },
      orderBy: { updatedAt: 'desc' },
    })
    const pois = rows.map((poi) => this.toPoiDto(poi))
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
      .sort((a, b) => summaryDistanceSort(a, b, filters.lat, filters.lng))
      .slice(0, limit)
  }

  async getPoiById(id: string): Promise<POI> {
    const poi = await this.prisma.poi.findUnique({ where: { id }, include: { berthing: true } })
    if (!poi) throw new BadRequestException('POI not found')
    return this.toPoiDto(poi)
  }

  async createPoi(userId: string, input: CreatePoiInput) {
    if (!input.name?.trim()) throw new BadRequestException('POI name is required')
    validateLatLng(input.lat, input.lng)
    const categoryModel = toCategoryModel(input.type)
    const shouldCreateBerthing = categoryModel.categoryGroup === 'berthing' || categoryModel.categoryGroup === 'service'
    const poi = await this.prisma.poi.create({
      data: {
        name: input.name,
        type: input.type,
        kind: categoryModel.kind,
        category: categoryModel.category,
        categoryGroup: categoryModel.categoryGroup,
        subtype: categoryModel.subtype,
        scope: input.scope ?? 'public',
        status: input.scope === 'public' ? 'unreviewed' : 'private',
        lat: input.lat,
        lng: input.lng,
        description: input.description,
        createdById: userId,
        berthing: shouldCreateBerthing ? {
          create: {
            berthingTypes: inferBerthingTypes(categoryModel.subtype),
            overnightAllowed: categoryModel.subtype === 'anchorage' || categoryModel.subtype === 'buoy_mooring' || categoryModel.subtype === 'marina' ? true : undefined,
            repair: categoryModel.subtype === 'dry_dock' ? true : undefined,
          },
        } : undefined,
      },
      include: { berthing: true },
    })
    return this.toPoiDto(poi)
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

  async listPoiNotes(poiId: string) {
    await this.ensurePoiExists(poiId)
    const notes = await this.prisma.poiNote.findMany({
      where: {
        poiId,
        deletedAt: null,
        status: { in: ['published', 'highlighted'] },
      },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, avatar: true } } },
      orderBy: [
        { isPinned: 'desc' },
        { isConfirmed: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    return notes.map(toPoiNoteDto)
  }

  async addPoiNote(poiId: string, userId: string, input: AddPoiNoteInput) {
    if (!input.text?.trim()) throw new BadRequestException('Note text is required')
    await this.ensurePoiExists(poiId)
    const note = await this.prisma.poiNote.create({
      data: {
        poiId,
        createdBy: userId,
        createdByRole: 'user',
        status: 'published',
        noteType: input.noteType === 'warning' ? 'warning' : 'info',
        text: input.text.trim(),
      },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, avatar: true } } },
    })
    return toPoiNoteDto(note)
  }

  async deletePoiNote(poiId: string, noteId: string, userId: string) {
    const note = await this.prisma.poiNote.findFirst({ where: { id: noteId, poiId, deletedAt: null } })
    if (!note) throw new BadRequestException('Note not found')
    if (note.createdBy && note.createdBy !== userId) throw new ForbiddenException('Cannot delete another user note')
    await this.prisma.poiNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date(), deletedBy: userId },
    })
    return { ok: true }
  }

  async listPoiReviews(poiId: string) {
    await this.ensurePoiExists(poiId)
    const reviews = await this.prisma.poiReview.findMany({
      where: { poiId },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, avatar: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 80,
    })
    return reviews.map(toPoiReviewDto)
  }

  async getMyPoiReview(poiId: string, userId: string) {
    await this.ensurePoiExists(poiId)
    const review = await this.prisma.poiReview.findUnique({
      where: { poiId_userId: { poiId, userId } },
      include: { user: { select: { id: true, nickname: true, avatarUrl: true, avatar: true } } },
    })
    return review ? toPoiReviewDto(review) : null
  }

  async upsertPoiReview(poiId: string, userId: string, input: UpsertPoiReviewInput) {
    if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('Rating must be 1-5')
    }
    await this.ensurePoiExists(poiId)
    const comment = input.comment?.trim() || null
    const review = await this.prisma.$transaction(async (tx) => {
      const next = await tx.poiReview.upsert({
        where: { poiId_userId: { poiId, userId } },
        create: { poiId, userId, rating: Math.round(input.rating), comment },
        update: { rating: Math.round(input.rating), comment },
        include: { user: { select: { id: true, nickname: true, avatarUrl: true, avatar: true } } },
      })
      await recomputePoiReviewStats(tx, poiId)
      return next
    })
    return toPoiReviewDto(review)
  }

  async deletePoiReview(poiId: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.poiReview.deleteMany({ where: { poiId, userId } })
      await recomputePoiReviewStats(tx, poiId)
    })
    return { ok: true }
  }

  async isPoiFavorited(poiId: string, userId: string) {
    await this.ensurePoiExists(poiId)
    const count = await this.prisma.poiFavorite.count({ where: { poiId, userId } })
    return { favorited: count > 0 }
  }

  async addPoiFavorite(poiId: string, userId: string) {
    await this.ensurePoiExists(poiId)
    await this.prisma.poiFavorite.upsert({
      where: { poiId_userId: { poiId, userId } },
      create: { poiId, userId },
      update: {},
    })
    return { favorited: true }
  }

  async removePoiFavorite(poiId: string, userId: string) {
    await this.prisma.poiFavorite.deleteMany({ where: { poiId, userId } })
    return { favorited: false }
  }

  async listFavoritePois(userId: string) {
    const favorites = await this.prisma.poiFavorite.findMany({
      where: { userId },
      include: { poi: { include: { berthing: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return favorites.map((favorite) => this.toPoiDto(favorite.poi))
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

  private toPoiDto(poi: any): POI {
    const categoryModel = toCategoryModel(poi.type, {
      kind: poi.kind,
      category: poi.category,
      categoryGroup: poi.categoryGroup,
      subtype: poi.subtype,
    })
    const berthing = poi.berthing ?? null
    const commentsCount = poi.commentsCount ?? poi.confirmCount ?? 0
    const status = mapPoiStatus(poi.status)
    return {
      id: poi.id,
      version: poi.version ?? Math.max(1, Math.floor(poi.updatedAt.getTime() / 1000)),
      name: poi.name,
      category: categoryModel.category,
      categoryGroup: categoryModel.categoryGroup,
      subtype: categoryModel.subtype,
      status,
      kind: categoryModel.kind,
      type: poi.type,
      slug: poi.slug ?? poi.id,
      location: { lat: poi.lat, lng: poi.lng },
      region: poi.region ?? undefined,
      country: poi.country ?? undefined,
      address: poi.address ?? undefined,
      description: poi.description ?? undefined,
      commentsCount,
      rating: poi.rating ?? undefined,
      phone: poi.phone ?? undefined,
      sourceUrl: poi.sourceUrl ?? undefined,
      picture: poi.picture ?? undefined,
      timezone: poi.timezone ?? undefined,
      maxDraft: berthing?.maxDraft ?? undefined,
      maxLength: berthing?.maxLength ?? undefined,
      maxBeam: berthing?.maxBeam ?? undefined,
      bookable: berthing?.bookable ?? undefined,
      overnightAllowed: berthing?.overnightAllowed ?? undefined,
      stayLimit: berthing?.stayLimit ?? undefined,
      feeInfo: berthing?.feeInfo ?? undefined,
      multihullFriendly: berthing?.multihullFriendly ?? undefined,
      seabeds: berthing?.seabeds ?? [],
      protections: berthing?.protections ?? [],
      berthingTypes: berthing?.berthingTypes ?? [],
      mooringTypes: berthing?.mooringTypes ?? [],
      bestMonths: poi.bestMonths ?? [],
      hasWater: berthing?.water ?? undefined,
      hasPower: berthing?.power ?? undefined,
      hasFuel: berthing?.fuel ?? undefined,
      hasRepair: berthing?.repair ?? undefined,
      hasWasteDisposal: berthing?.wasteDisposal ?? undefined,
      notes: [],
      warningNotes: [],
      photos: [],
    }
  }

  private async ensurePoiExists(poiId: string) {
    const poi = await this.prisma.poi.findUnique({ where: { id: poiId }, select: { id: true } })
    if (!poi) throw new BadRequestException('POI not found')
    return poi
  }
}

function validateLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new BadRequestException('Invalid latitude')
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new BadRequestException('Invalid longitude')
}

async function recomputePoiReviewStats(tx: any, poiId: string) {
  const aggregate = await tx.poiReview.aggregate({
    where: { poiId },
    _avg: { rating: true },
  })
  const commentsCount = await tx.poiReview.count({
    where: {
      poiId,
      comment: { not: null },
    },
  })
  const average = aggregate._avg.rating
  await tx.poi.update({
    where: { id: poiId },
    data: {
      rating: typeof average === 'number' ? Math.round(average * 10) / 10 : null,
      commentsCount,
    },
  })
}

function toPoiReviewDto(review: any) {
  return {
    id: review.id,
    poiId: review.poiId,
    userId: review.userId,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    user: review.user ? {
      id: review.user.id,
      nickname: review.user.nickname,
      avatar: review.user.avatarUrl ?? review.user.avatar ?? null,
    } : undefined,
  }
}

function toPoiNoteDto(note: any) {
  return {
    id: note.id,
    status: note.status,
    noteType: note.noteType,
    text: note.text,
    isPinned: note.isPinned,
    isConfirmed: note.isConfirmed,
    confirmedAt: note.confirmedAt?.toISOString(),
    confirmedBy: note.confirmedBy ?? undefined,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    createdBy: note.createdBy ?? undefined,
    createdByRole: note.user?.nickname ?? note.createdByRole ?? undefined,
  }
}

function buildPoiWhere(filters: ListPoiFilters) {
  const AND: any[] = []
  const query = filters.q?.trim()

  if (query) {
    AND.push({
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { type: { contains: query, mode: 'insensitive' } },
        { category: { contains: query, mode: 'insensitive' } },
        { subtype: { contains: query, mode: 'insensitive' } },
        { region: { contains: query, mode: 'insensitive' } },
        { country: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ],
    })
  }

  const typeFilter = dbTypesForCategory(filters.category)
  if (typeFilter.length > 0) {
    AND.push({
      OR: [
        { type: { in: typeFilter } },
        { category: { in: typeFilter } },
        { subtype: { in: typeFilter } },
      ],
    })
  }

  const bbox = normalizeBBox(filters)
  if (bbox) {
    AND.push({ lat: { gte: bbox.minLat, lte: bbox.maxLat } })
    if (bbox.wrapsLongitude) {
      AND.push({
        OR: [
          { lng: { gte: bbox.minLng } },
          { lng: { lte: bbox.maxLng } },
        ],
      })
    } else {
      AND.push({ lng: { gte: bbox.minLng, lte: bbox.maxLng } })
    }
  }

  return AND.length > 0 ? { AND } : {}
}

function dbTypesForCategory(category?: string) {
  if (!category || category === 'all') return []
  const normalized = category.trim().toLowerCase()
  if (normalized === 'marina') return ['marina', 'harbor', 'harbour', 'port', 'dock', 'yacht_club']
  if (normalized === 'anchorage') return ['anchorage', 'anchor']
  if (normalized === 'dry_dock') return ['dry_dock', 'boatyard', 'repair']
  if (normalized === 'buoy_mooring') return ['buoy_mooring', 'mooring', 'buoy']
  if (normalized === 'public_quay') return ['public_quay', 'quay', 'pier']
  if (normalized === 'hazard') return ['hazard', 'restricted', 'shoal', 'reef']
  if (normalized === 'other') return ['lighthouse', 'island', 'scenic', 'discovery', 'other']
  return [normalized]
}

function normalizeBBox(filters: ListPoiFilters) {
  const values = [filters.minLat, filters.maxLat, filters.minLng, filters.maxLng]
  if (!values.every((value) => Number.isFinite(value))) return null

  const minLat = Math.max(-90, Math.min(filters.minLat!, filters.maxLat!))
  const maxLat = Math.min(90, Math.max(filters.minLat!, filters.maxLat!))
  const rawMinLng = filters.minLng!
  const rawMaxLng = filters.maxLng!

  if (rawMaxLng - rawMinLng >= 360) {
    return { minLat, maxLat, minLng: -180, maxLng: 180, wrapsLongitude: false }
  }

  const minLng = normalizeLng(rawMinLng)
  const maxLng = normalizeLng(rawMaxLng)
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    wrapsLongitude: minLng > maxLng,
  }
}

function normalizeLng(lng: number) {
  let next = lng
  while (next < -180) next += 360
  while (next > 180) next -= 360
  return next
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

interface CategoryModel {
  kind: string
  category: PoiCategory
  categoryGroup: 'berthing' | 'service' | 'hazard' | 'other'
  subtype: PoiCategory
}

function toCategoryModel(type: string, existing?: Partial<CategoryModel>): CategoryModel {
  if (existing?.category && existing?.categoryGroup && existing?.subtype) {
    return {
      kind: existing.kind || inferKind(type),
      category: existing.category,
      categoryGroup: existing.categoryGroup,
      subtype: existing.subtype,
    }
  }

  const normalized = type.trim().toLowerCase()
  if (['anchorage', 'anchor'].includes(normalized)) {
    return { kind: 'mooring', category: 'anchorage', categoryGroup: 'berthing', subtype: 'anchorage' }
  }
  if (['buoy_mooring', 'mooring', 'buoy'].includes(normalized)) {
    return { kind: 'mooring', category: 'buoy_mooring', categoryGroup: 'berthing', subtype: 'buoy_mooring' }
  }
  if (['hazard', 'restricted', 'shoal', 'reef', 'prohibited'].includes(normalized)) {
    return { kind: 'mooring', category: 'hazard', categoryGroup: 'hazard', subtype: 'hazard' }
  }
  if (['dry_dock', 'dry-berthing', 'boatyard', 'repair'].includes(normalized)) {
    return { kind: 'port', category: 'dry_dock', categoryGroup: 'service', subtype: 'dry_dock' }
  }
  if (['public_quay', 'jetty', 'quay', 'pier'].includes(normalized)) {
    return { kind: 'port', category: 'public_quay', categoryGroup: 'berthing', subtype: 'public_quay' }
  }
  if (['marina', 'harbor', 'harbour', 'port', 'dock', 'yacht_club'].includes(normalized)) {
    return { kind: 'port', category: 'marina', categoryGroup: 'berthing', subtype: 'marina' }
  }
  return { kind: inferKind(type), category: 'other', categoryGroup: 'other', subtype: 'other' }
}

function inferKind(type: string) {
  const normalized = type.trim().toLowerCase()
  if (['anchorage', 'anchor', 'buoy_mooring', 'mooring', 'buoy', 'hazard', 'restricted', 'shoal', 'reef', 'prohibited'].includes(normalized)) {
    return 'mooring'
  }
  return 'port'
}

function inferBerthingTypes(subtype: PoiCategory) {
  if (subtype === 'anchorage') return ['anchor']
  if (subtype === 'buoy_mooring') return ['buoy']
  if (subtype === 'public_quay') return ['quay']
  if (subtype === 'dry_dock') return ['dry_dock']
  if (subtype === 'marina') return ['dock']
  return []
}

function mapPoiStatus(status: string) {
  if (status === 'private') return 'draft'
  if (status === 'unreviewed') return 'pending_review'
  if (status === 'restricted') return 'restricted'
  if (status === 'temporarily_closed') return 'temporarily_closed'
  if (status === 'archived') return 'archived'
  return 'active'
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

function summaryDistanceSort(a: PoiRegionSummary, b: PoiRegionSummary, lat?: number, lng?: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return b.count - a.count
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
