import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { RewardsService } from '../rewards/rewards.service'
import { VesselsService } from '../vessels/vessels.service'

export interface CreateLogInput {
  vesselId: string
  voyageId?: string
  type?: string
  title: string
  body?: string
  photoUrl?: string
  lat?: number
  lng?: number
}

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewards: RewardsService,
    private readonly vessels: VesselsService,
  ) {}

  async list(userId: string, filters: { vesselId?: string; voyageId?: string } = {}) {
    return this.prisma.logEntry.findMany({
      where: {
        userId,
        ...(filters.vesselId ? { vesselId: filters.vesselId } : {}),
        ...(filters.voyageId ? { voyageId: filters.voyageId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(userId: string, input: CreateLogInput) {
    if (!input.title?.trim()) throw new BadRequestException('Log title is required')
    const vessel = await this.vessels.ensureUserVessel(userId, input.vesselId)
    if (input.voyageId) {
      const voyage = await this.prisma.voyage.findFirst({
        where: {
          id: input.voyageId,
          vesselId: vessel.id,
          OR: [{ ownerId: userId }, { participants: { some: { userId } } }],
        },
      })
      if (!voyage) throw new ForbiddenException('Voyage not found or not accessible')
    }

    const log = await this.prisma.logEntry.create({
      data: {
        userId,
        vesselId: vessel.id,
        voyageId: input.voyageId,
        type: input.type ?? 'note',
        title: input.title,
        body: input.body,
        photoUrl: input.photoUrl,
        lat: input.lat,
        lng: input.lng,
      },
    })

    await this.rewards.grant({
      ruleKey: 'log.created',
      userId,
      vesselId: vessel.id,
      sourceType: 'log',
      sourceId: log.id,
    })

    return log
  }
}
