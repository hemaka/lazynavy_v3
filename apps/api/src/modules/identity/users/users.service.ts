import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { envNumber } from '../../../config/env'
import { PrismaService } from '../../../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

const DEFAULT_ACTIVE_BADGE_ID = '01_beginner'
const DEFAULT_MARINE_CONDITION_REFRESH_INTERVAL_MINUTES = 15
const DEFAULT_MARINE_CONDITION_REFRESH_DISTANCE_KM = 5
const DEFAULT_VOYAGE_LOCATION_MIN_INTERVAL_SECONDS = 5
const DEFAULT_VOYAGE_LOCATION_MIN_DISTANCE_METERS = 15
const DEFAULT_VOYAGE_LOCATION_MAX_INTERVAL_SECONDS = 60
const DEFAULT_VOYAGE_LOCATION_MAX_ACCURACY_METERS = 50
const DEFAULT_ASHORE_LOCATION_MIN_INTERVAL_SECONDS = 30
const DEFAULT_ASHORE_LOCATION_MIN_DISTANCE_METERS = 25
const DEFAULT_ASHORE_LOCATION_MAX_INTERVAL_SECONDS = 300
const DEFAULT_ASHORE_LOCATION_MAX_ACCURACY_METERS = 75
const DEFAULT_LEAVE_VESSEL_DISTANCE_METERS = 80
const DEFAULT_RETURN_VESSEL_DISTANCE_METERS = 40
const DEFAULT_LEAVE_VESSEL_GRACE_SECONDS = 180

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!user) throw new NotFoundException('用户不存在')
    return user
  }

  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        coverImage: true,
        bio: true,
        region: true,
        country: true,
        firstLanguage: true,
        currency: true,
        timezone: true,
        textLanguage: true,
        uiLanguage: true,
        gender: true,
        birthDate: true,
        sailingYears: true,
        activeBadgeId: true,
        roles: true,
        verifiedRoles: true,
        isPublic: true,
        locationPolicy: true,
        createdAt: true,
      },
    })
    if (!user) throw new NotFoundException('用户不存在')
    return withComputedAge(user)
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } })
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone, deletedAt: null } })
  }

  async create(data: { nickname: string; email?: string | null; phone?: string | null; passwordHash: string }) {
    const user = await this.prisma.user.create({ data })
    await this.ensureDefaultBadges(user.id)
    return this.ensureDefaultActiveBadge(user.id)
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    if (dto.birthDate !== undefined && !isValidBirthDate(dto.birthDate)) {
      throw new BadRequestException('生日格式不正确')
    }
    // Verify vessel ownership before persisting — never trust client-supplied id.
    if (dto.currentVesselId) {
      const vessel = await this.prisma.vessel.findFirst({
        where: { id: dto.currentVesselId, deletedAt: null },
        select: { ownerId: true },
      })
      if (!vessel) throw new BadRequestException('船只不存在')
      if (vessel.ownerId !== id) throw new ForbiddenException('无权设置该船只为当前船只')
    }
    if (dto.activeBadgeId) {
      await this.ensureUserCanUseBadge(id, dto.activeBadgeId)
    }
    const { birthDate, ...profileData } = dto
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...profileData,
        ...(birthDate !== undefined ? { birthDate: parseBirthDate(birthDate) } : {}),
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        coverImage: true,
        bio: true,
        region: true,
        country: true,
        firstLanguage: true,
        currency: true,
        timezone: true,
        textLanguage: true,
        uiLanguage: true,
        gender: true,
        birthDate: true,
        sailingYears: true,
        activeBadgeId: true,
        roles: true,
        verifiedRoles: true,
        isPublic: true,
        locationPolicy: true,
        currentVesselId: true,
        createdAt: true,
      },
    })
    return withComputedAge(user)
  }

  async listAvailableBadges(userId: string) {
    await this.ensureDefaultBadges(userId)
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { activeBadgeId: true },
    })
    if (!user) throw new NotFoundException('用户不存在')

    const items = await this.prisma.userBadge.findMany({
      where: {
        userId,
        status: 'available',
        badge: { status: 'active' },
      },
      include: { badge: true },
      orderBy: [{ badge: { sortOrder: 'asc' } }, { grantedAt: 'asc' }],
    })

    return {
      activeBadgeId: user.activeBadgeId,
      badges: items.map((item) => ({
        id: item.badge.id,
        kind: item.badge.kind,
        status: item.badge.status,
        title: item.badge.title,
        description: item.badge.description,
        imageKey: item.badge.imageKey,
        sortOrder: item.badge.sortOrder,
        userBadgeStatus: item.status,
        source: item.source,
        grantedAt: item.grantedAt,
      })),
    }
  }

  async setActiveBadge(userId: string, badgeId?: string | null) {
    if (badgeId) await this.ensureUserCanUseBadge(userId, badgeId)
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { activeBadgeId: badgeId ?? null },
      select: {
        id: true,
        activeBadgeId: true,
      },
    })
    return {
      activeBadgeId: user.activeBadgeId,
      badge: user.activeBadgeId ? (await this.prisma.badge.findUnique({ where: { id: user.activeBadgeId } })) : null,
    }
  }

  private async ensureUserCanUseBadge(userId: string, badgeId: string) {
    await this.ensureDefaultBadges(userId)
    const userBadge = await this.prisma.userBadge.findFirst({
      where: {
        userId,
        badgeId,
        status: 'available',
        badge: { status: 'active' },
      },
      select: { id: true },
    })
    if (!userBadge) throw new BadRequestException('徽章不可用或尚未启用')
  }

  private async ensureDefaultBadges(userId: string) {
    const badges = await this.prisma.badge.findMany({
      where: { kind: 'system_achievement', status: 'active' },
      select: { id: true },
    })
    if (!badges.length) return
    await this.prisma.userBadge.createMany({
      data: badges.map((badge) => ({
        id: `${userId}:${badge.id}`,
        userId,
        badgeId: badge.id,
        status: 'available',
        source: 'system',
      })),
      skipDuplicates: true,
    })
    await this.ensureDefaultActiveBadge(userId)
  }

  private async ensureDefaultActiveBadge(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeBadgeId: true },
    })
    if (user?.activeBadgeId) return this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const beginnerBadge = await this.prisma.userBadge.findFirst({
      where: {
        userId,
        badgeId: DEFAULT_ACTIVE_BADGE_ID,
        status: 'available',
        badge: { status: 'active' },
      },
      select: { id: true },
    })
    if (!beginnerBadge) return this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    return this.prisma.user.update({
      where: { id: userId },
      data: { activeBadgeId: DEFAULT_ACTIVE_BADGE_ID },
    })
  }

  async updateRoles(id: string, roles: string[]) {
    return this.prisma.user.update({
      where: { id },
      data: { roles: { set: roles as any } },
      select: { id: true, roles: true, verifiedRoles: true },
    })
  }

  async adminListUsers(q?: string) {
    return this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { nickname: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      select: {
        id: true,
        nickname: true,
        email: true,
        phone: true,
        roles: true,
        isPublic: true,
        createdAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
  }

  safeUser(user: any) {
    const { passwordHash, deletedAt, ...safe } = user
    return {
      ...withComputedAge(safe),
      clientConfig: clientConfig(),
    }
  }
}

function withComputedAge<T extends { birthDate?: Date | string | null }>(user: T) {
  const birthDate = formatBirthDate(user.birthDate)
  return {
    ...user,
    birthDate,
    age: calculateAge(birthDate),
  }
}

function calculateAge(birthDate?: string | null) {
  if (!birthDate || isPrivateBirthDate(birthDate)) return null
  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const today = new Date()
  let age = today.getFullYear() - Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (today.getMonth() < month || (today.getMonth() === month && today.getDate() < day)) age -= 1
  return age >= 0 && age <= 120 ? age : null
}

function isValidBirthDate(value: string) {
  if (isPrivateBirthDate(value)) return true
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  return date <= todayUtc
}

function parseBirthDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function formatBirthDate(value?: Date | string | null) {
  if (!value) return null
  if (typeof value === 'string') return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
}

function isPrivateBirthDate(value: string) {
  return value === '1900-01-01'
}

function clientConfig() {
  return {
    marineCondition: {
      refreshIntervalMinutes: envNumber('MARINE_CONDITION_REFRESH_INTERVAL_MINUTES', DEFAULT_MARINE_CONDITION_REFRESH_INTERVAL_MINUTES),
      refreshDistanceKm: envNumber('MARINE_CONDITION_REFRESH_DISTANCE_KM', DEFAULT_MARINE_CONDITION_REFRESH_DISTANCE_KM),
    },
    locationTracking: {
      voyage: {
        minIntervalSeconds: envNumber('VOYAGE_LOCATION_MIN_INTERVAL_SECONDS', DEFAULT_VOYAGE_LOCATION_MIN_INTERVAL_SECONDS),
        minDistanceMeters: envNumber('VOYAGE_LOCATION_MIN_DISTANCE_METERS', DEFAULT_VOYAGE_LOCATION_MIN_DISTANCE_METERS),
        maxIntervalSeconds: envNumber('VOYAGE_LOCATION_MAX_INTERVAL_SECONDS', DEFAULT_VOYAGE_LOCATION_MAX_INTERVAL_SECONDS),
        maxAccuracyMeters: envNumber('VOYAGE_LOCATION_MAX_ACCURACY_METERS', DEFAULT_VOYAGE_LOCATION_MAX_ACCURACY_METERS),
      },
      ashore: {
        minIntervalSeconds: envNumber('ASHORE_LOCATION_MIN_INTERVAL_SECONDS', DEFAULT_ASHORE_LOCATION_MIN_INTERVAL_SECONDS),
        minDistanceMeters: envNumber('ASHORE_LOCATION_MIN_DISTANCE_METERS', DEFAULT_ASHORE_LOCATION_MIN_DISTANCE_METERS),
        maxIntervalSeconds: envNumber('ASHORE_LOCATION_MAX_INTERVAL_SECONDS', DEFAULT_ASHORE_LOCATION_MAX_INTERVAL_SECONDS),
        maxAccuracyMeters: envNumber('ASHORE_LOCATION_MAX_ACCURACY_METERS', DEFAULT_ASHORE_LOCATION_MAX_ACCURACY_METERS),
      },
      vesselPresence: {
        leaveDistanceMeters: envNumber('LEAVE_VESSEL_DISTANCE_METERS', DEFAULT_LEAVE_VESSEL_DISTANCE_METERS),
        returnDistanceMeters: envNumber('RETURN_VESSEL_DISTANCE_METERS', DEFAULT_RETURN_VESSEL_DISTANCE_METERS),
        graceSeconds: envNumber('LEAVE_VESSEL_GRACE_SECONDS', DEFAULT_LEAVE_VESSEL_GRACE_SECONDS),
      },
    },
  }
}
