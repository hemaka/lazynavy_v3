import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { VesselsService } from '../vessels/vessels.service'

export interface UpsertSupplyInput {
  name: string
  category?: string
  unit?: string
  quantity?: number
  capacity?: number
  warnBelow?: number
  location?: string
  notes?: string
}

@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly vessels: VesselsService,
  ) {}

  async list(userId: string, vesselId: string) {
    await this.vessels.ensureUserVessel(userId, vesselId)
    return this.prisma.supplyItem.findMany({ where: { vesselId }, orderBy: [{ category: 'asc' }, { name: 'asc' }] })
  }

  async create(userId: string, vesselId: string, input: UpsertSupplyInput) {
    await this.vessels.ensureUserVessel(userId, vesselId)
    if (!input.name?.trim()) throw new BadRequestException('Supply name is required')
    return this.prisma.supplyItem.create({
      data: {
        vesselId,
        name: input.name,
        category: input.category ?? 'general',
        unit: input.unit ?? 'pcs',
        quantity: input.quantity ?? 0,
        capacity: input.capacity,
        warnBelow: input.warnBelow,
        location: input.location,
        notes: input.notes,
      },
    })
  }

  async adjust(userId: string, itemId: string, delta: number) {
    if (!Number.isFinite(delta)) throw new BadRequestException('Invalid quantity delta')
    const item = await this.prisma.supplyItem.findUnique({ where: { id: itemId } })
    if (!item) throw new BadRequestException('Supply item not found')
    await this.vessels.ensureUserVessel(userId, item.vesselId)
    const updated = await this.prisma.supplyItem.update({
      where: { id: itemId },
      data: { quantity: Math.max(0, item.quantity + delta) },
    })
    if (updated.warnBelow !== null && updated.quantity <= updated.warnBelow) {
      const vessel = await this.prisma.vessel.findUnique({ where: { id: updated.vesselId } })
      if (vessel) {
        await this.notifications.notify({
          userId: vessel.ownerId,
          vesselId: updated.vesselId,
          sourceType: 'supply',
          sourceId: updated.id,
          type: 'supply.low_stock',
          title: 'Supply low stock',
          body: `${updated.name} is at ${updated.quantity} ${updated.unit}.`,
          severity: 'warning',
        })
      }
    }
    return updated
  }

  async lowStock(userId: string, vesselId: string) {
    await this.vessels.ensureUserVessel(userId, vesselId)
    const items = await this.prisma.supplyItem.findMany({ where: { vesselId, warnBelow: { not: null } }, orderBy: { name: 'asc' } })
    return items.filter((item) => item.warnBelow !== null && item.quantity <= item.warnBelow)
  }
}
