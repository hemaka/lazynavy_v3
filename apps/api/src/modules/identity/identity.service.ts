import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDevUser() {
    const existing = await this.prisma.user.findFirst({ where: { nickname: 'V3 Captain' } })
    if (existing) return existing
    return this.prisma.user.create({
      data: {
        nickname: 'V3 Captain',
        title: 'Harbor Rookie',
        level: 1,
        xp: 35,
        nextLevelXp: 120,
      },
    })
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }
}
