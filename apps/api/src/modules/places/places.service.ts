import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
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

@Injectable()
export class PlacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogsService,
    private readonly rewards: RewardsService,
    private readonly vessels: VesselsService,
  ) {}

  listPois() {
    return this.prisma.poi.findMany({ orderBy: { updatedAt: 'desc' } })
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
