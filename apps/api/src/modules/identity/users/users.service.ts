import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { UpdateProfileDto } from './dto/update-profile.dto'

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
    return this.prisma.user.create({ data })
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
        roles: true,
        verifiedRoles: true,
        isPublic: true,
        locationPolicy: true,
        currentVesselId: true,
        createdAt: true,
      },
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
