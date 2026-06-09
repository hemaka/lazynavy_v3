import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface CreateVesselInput {
  name: string
  type?: string
  homePort?: string
}

export interface AddCrewInput {
  userId: string
  role?: string
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
    if (!input.name?.trim()) throw new BadRequestException('Vessel name is required')
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

  async setCurrent(userId: string, vesselId: string) {
    const vessel = await this.ensureUserVessel(userId, vesselId)
    await this.prisma.user.update({ where: { id: userId }, data: { currentVesselId: vessel.id } })
    return vessel
  }

  async addCrew(actorId: string, vesselId: string, input: AddCrewInput) {
    const vessel = await this.ensureUserVessel(actorId, vesselId)
    const actorMembership = vessel.memberships.find((m) => m.userId === actorId)
    if (vessel.ownerId !== actorId && actorMembership?.role !== 'captain') {
      throw new ForbiddenException('Only captain can add crew')
    }
    return this.prisma.vesselMembership.upsert({
      where: { vesselId_userId: { vesselId, userId: input.userId } },
      create: { vesselId, userId: input.userId, role: input.role ?? 'guest' },
      update: { role: input.role ?? 'guest' },
    })
  }

  async ensureUserVessel(userId: string, vesselId: string) {
    const vessel = await this.prisma.vessel.findFirst({
      where: {
        id: vesselId,
        deletedAt: null,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: { memberships: true },
    })
    if (!vessel) throw new ForbiddenException('Vessel not found or not accessible')
    return vessel
  }
}
