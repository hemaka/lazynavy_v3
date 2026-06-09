import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { VesselsService } from '../vessels/vessels.service'

export interface SyncMutationInput {
  clientMutationId: string
  vesselId?: string
  entityType: string
  operation: string
  payload: unknown
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vessels: VesselsService,
  ) {}

  async bootstrap(userId: string) {
    const vessels = await this.vessels.listForUser(userId)
    const vesselIds = vessels.map((vessel) => vessel.id)
    return {
      serverTime: new Date().toISOString(),
      vessels,
      voyages: await this.prisma.voyage.findMany({ where: { vesselId: { in: vesselIds } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
      logs: await this.prisma.logEntry.findMany({ where: { vesselId: { in: vesselIds } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
      supplies: await this.prisma.supplyItem.findMany({ where: { vesselId: { in: vesselIds } }, orderBy: { updatedAt: 'desc' }, take: 200 }),
      equipment: await this.prisma.equipment.findMany({ where: { vesselId: { in: vesselIds }, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 200 }),
      manuals: await this.prisma.manualDocument.findMany({ where: { vesselId: { in: vesselIds }, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 200 }),
    }
  }

  async changes(userId: string, since?: string) {
    const sinceDate = since ? new Date(since) : new Date(0)
    if (Number.isNaN(sinceDate.getTime())) throw new BadRequestException('Invalid since value')
    const vessels = await this.vessels.listForUser(userId)
    const vesselIds = vessels.map((vessel) => vessel.id)
    return {
      serverTime: new Date().toISOString(),
      logs: await this.prisma.logEntry.findMany({ where: { vesselId: { in: vesselIds }, updatedAt: { gt: sinceDate } }, orderBy: { updatedAt: 'asc' } }),
      supplies: await this.prisma.supplyItem.findMany({ where: { vesselId: { in: vesselIds }, updatedAt: { gt: sinceDate } }, orderBy: { updatedAt: 'asc' } }),
      equipment: await this.prisma.equipment.findMany({ where: { vesselId: { in: vesselIds }, updatedAt: { gt: sinceDate } }, orderBy: { updatedAt: 'asc' } }),
      manuals: await this.prisma.manualDocument.findMany({ where: { vesselId: { in: vesselIds }, updatedAt: { gt: sinceDate } }, orderBy: { updatedAt: 'asc' } }),
    }
  }

  async submitMutation(userId: string, input: SyncMutationInput) {
    if (!input.clientMutationId?.trim()) throw new BadRequestException('clientMutationId is required')
    if (input.vesselId) await this.vessels.ensureUserVessel(userId, input.vesselId)
    const existing = await this.prisma.syncMutation.findUnique({ where: { clientMutationId: input.clientMutationId } })
    if (existing) return existing
    return this.prisma.syncMutation.create({
      data: {
        userId,
        vesselId: input.vesselId,
        clientMutationId: input.clientMutationId,
        entityType: input.entityType,
        operation: input.operation,
        payload: input.payload as any,
        status: 'received',
      },
    })
  }
}
