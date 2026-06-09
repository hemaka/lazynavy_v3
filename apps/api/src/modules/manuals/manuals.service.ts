import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EquipmentService } from '../equipment/equipment.service'
import { VesselsService } from '../vessels/vessels.service'

export interface UpsertManualInput {
  vesselId?: string
  equipmentId?: string
  voyageId?: string
  title: string
  type?: string
  language?: string
  source?: string
  mediaUrl?: string
  contentText?: string
  metadata?: unknown
  offlinePriority?: string
}

@Injectable()
export class ManualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vessels: VesselsService,
    private readonly equipment: EquipmentService,
  ) {}

  async list(userId: string, filters: { vesselId?: string; equipmentId?: string; type?: string } = {}) {
    if (filters.vesselId) await this.vessels.ensureUserVessel(userId, filters.vesselId)
    if (filters.equipmentId) await this.equipment.get(userId, filters.equipmentId)
    return this.prisma.manualDocument.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { vessel: { memberships: { some: { userId } } } }],
        ...(filters.vesselId ? { vesselId: filters.vesselId } : {}),
        ...(filters.equipmentId ? { equipmentId: filters.equipmentId } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      orderBy: [{ offlinePriority: 'asc' }, { updatedAt: 'desc' }],
    })
  }

  async get(userId: string, id: string) {
    const manual = await this.prisma.manualDocument.findFirst({
      where: {
        id,
        deletedAt: null,
        OR: [{ ownerId: userId }, { vessel: { memberships: { some: { userId } } } }],
      },
    })
    if (!manual) throw new BadRequestException('Manual not found')
    return manual
  }

  async create(userId: string, input: UpsertManualInput) {
    if (!input.title?.trim()) throw new BadRequestException('Manual title is required')
    if (input.vesselId) await this.vessels.ensureUserVessel(userId, input.vesselId)
    if (input.equipmentId) await this.equipment.get(userId, input.equipmentId)
    return this.prisma.manualDocument.create({
      data: {
        ownerId: userId,
        vesselId: input.vesselId,
        equipmentId: input.equipmentId,
        voyageId: input.voyageId,
        title: input.title.trim(),
        type: input.type ?? 'knowledge',
        language: input.language,
        source: input.source,
        mediaUrl: input.mediaUrl,
        contentText: input.contentText,
        metadata: input.metadata as any,
        offlinePriority: input.offlinePriority ?? 'normal',
      },
    })
  }

  async update(userId: string, id: string, input: Partial<UpsertManualInput>) {
    await this.get(userId, id)
    return this.prisma.manualDocument.update({
      where: { id },
      data: {
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.mediaUrl !== undefined ? { mediaUrl: input.mediaUrl } : {}),
        ...(input.contentText !== undefined ? { contentText: input.contentText } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as any } : {}),
        ...(input.offlinePriority !== undefined ? { offlinePriority: input.offlinePriority } : {}),
        version: { increment: 1 },
      },
    })
  }

  async softDelete(userId: string, id: string) {
    await this.get(userId, id)
    return this.prisma.manualDocument.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    })
  }

  async search(userId: string, q: string) {
    const term = q.trim()
    if (!term) return []
    return this.prisma.manualDocument.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { vessel: { memberships: { some: { userId } } } },
        ],
        AND: [{
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { contentText: { contains: term, mode: 'insensitive' } },
            { source: { contains: term, mode: 'insensitive' } },
          ],
        }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
  }
}
