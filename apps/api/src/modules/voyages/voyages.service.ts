import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { RewardsService } from '../rewards/rewards.service'
import { VesselsService } from '../vessels/vessels.service'

export interface CreateVoyageInput {
  vesselId: string
  name: string
  departureName?: string
  destinationName?: string
  plannedStartAt?: string
  needsConfirmation?: boolean
  participantUserIds?: string[]
}

@Injectable()
export class VoyagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rewards: RewardsService,
    private readonly vessels: VesselsService,
  ) {}

  activeForUser(userId: string, vesselId?: string | null) {
    return this.prisma.voyage.findFirst({
      where: {
        ownerId: userId,
        ...(vesselId ? { vesselId } : {}),
        status: { in: ['active', 'planned'] },
      },
      orderBy: [{ status: 'asc' }, { plannedStartAt: 'asc' }],
    })
  }

  listForUser(userId: string) {
    return this.prisma.voyage.findMany({
      where: {
        OR: [{ ownerId: userId }, { participants: { some: { userId } } }],
      },
      include: { participants: true, auditEvents: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async createPlan(userId: string, input: CreateVoyageInput) {
    if (!input.name?.trim()) throw new BadRequestException('Voyage name is required')
    await this.vessels.ensureUserVessel(userId, input.vesselId)
    const voyage = await this.prisma.voyage.create({
      data: {
        ownerId: userId,
        vesselId: input.vesselId,
        name: input.name,
        departureName: input.departureName,
        destinationName: input.destinationName,
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
        needsConfirmation: input.needsConfirmation ?? false,
        participants: {
          create: unique([userId, ...(input.participantUserIds ?? [])]).map((participantUserId) => ({
            userId: participantUserId,
            role: participantUserId === userId ? 'captain' : 'crew',
            status: participantUserId === userId ? 'confirmed' : 'invited',
            confirmedAt: participantUserId === userId ? new Date() : null,
          })),
        },
        auditEvents: {
          create: { actorId: userId, type: 'voyage.created', payload: compactJson({ vesselId: input.vesselId }) },
        },
      },
      include: { participants: true, auditEvents: true },
    })
    return voyage
  }

  async confirm(userId: string, voyageId: string) {
    await this.ensureVoyageAccess(userId, voyageId)
    const participant = await this.prisma.voyageParticipant.findUnique({ where: { voyageId_userId: { voyageId, userId } } })
    if (!participant) throw new ForbiddenException('User is not a voyage participant')
    const updated = await this.prisma.voyageParticipant.update({
      where: { id: participant.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })
    await this.addAudit(voyageId, userId, 'participant.confirmed', { userId })
    const pending = await this.prisma.voyageParticipant.count({ where: { voyageId, status: { not: 'confirmed' } } })
    if (pending === 0) await this.prisma.voyage.update({ where: { id: voyageId }, data: { needsConfirmation: false } })
    return updated
  }

  async start(userId: string, voyageId: string) {
    const voyage = await this.ensureVoyageOwner(userId, voyageId)
    if (voyage.status !== 'planned') throw new BadRequestException('Only planned voyage can be started')
    if (voyage.needsConfirmation) throw new BadRequestException('Voyage still needs confirmation')
    const updated = await this.prisma.voyage.update({
      where: { id: voyageId },
      data: { status: 'active', startedAt: new Date() },
      include: { participants: true, auditEvents: true },
    })
    await this.addAudit(voyageId, userId, 'voyage.started', {})
    return updated
  }

  async complete(userId: string, voyageId: string) {
    const voyage = await this.ensureVoyageOwner(userId, voyageId)
    if (voyage.status !== 'active') throw new BadRequestException('Only active voyage can be completed')
    const updated = await this.prisma.voyage.update({
      where: { id: voyageId },
      data: { status: 'completed', endedAt: new Date(), needsConfirmation: false },
      include: { participants: true, auditEvents: true },
    })
    await this.addAudit(voyageId, userId, 'voyage.completed', { vesselId: voyage.vesselId })
    await this.rewards.grant({
      ruleKey: 'voyage.completed',
      userId,
      vesselId: voyage.vesselId,
      sourceType: 'voyage',
      sourceId: voyage.id,
    })
    return updated
  }

  private async ensureVoyageAccess(userId: string, voyageId: string) {
    const voyage = await this.prisma.voyage.findFirst({
      where: {
        id: voyageId,
        OR: [{ ownerId: userId }, { participants: { some: { userId } } }],
      },
      include: { participants: true },
    })
    if (!voyage) throw new ForbiddenException('Voyage not found or not accessible')
    return voyage
  }

  private async ensureVoyageOwner(userId: string, voyageId: string) {
    const voyage = await this.prisma.voyage.findFirst({ where: { id: voyageId, ownerId: userId } })
    if (!voyage) throw new ForbiddenException('Voyage not found or not owned')
    return voyage
  }

  private addAudit(voyageId: string, actorId: string, type: string, payload: Prisma.InputJsonObject) {
    return this.prisma.voyageAuditEvent.create({ data: { voyageId, actorId, type, payload } })
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function compactJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined && v !== null)) as Prisma.InputJsonObject
}
