import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

const DEFAULT_ACTIVE_BADGE_ID = '01_beginner'

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
    return user
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
    return this.prisma.user.update({
      where: { id },
      data: dto,
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
    return safe
  }
}
