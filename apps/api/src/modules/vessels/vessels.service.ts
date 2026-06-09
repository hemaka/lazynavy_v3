import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface CreateVesselInput {
  name: string
  type?: string
  homePort?: string
}

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.vessel.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: { memberships: true },
      orderBy: [{ updatedAt: 'desc' }],
    })
  }

  async createForUser(userId: string, input: CreateVesselInput) {
    const vessel = await this.prisma.vessel.create({
      data: {
        ownerId: userId,
        name: input.name,
        type: input.type,
        homePort: input.homePort,
        sceneTemplate: 'marina',
        memberships: { create: { userId, role: 'captain' } },
      },
      include: { memberships: true },
    })
    await this.prisma.user.update({ where: { id: userId }, data: { currentVesselId: vessel.id } })
    return vessel
  }
}
