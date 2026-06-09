import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { RewardsService } from '../rewards/rewards.service'
import { VesselsService } from '../vessels/vessels.service'

export interface UpsertEquipmentInput {
  vesselId: string
  templateId?: string
  name: string
  category?: string
  brand?: string
  model?: string
  status?: string
  location?: string
  installedAt?: string
  maintenanceIntervalDays?: number
  lastServicedAt?: string
  partsJson?: unknown
  metadata?: unknown
}

export interface CreateMaintenanceInput {
  vesselId?: string
  type?: string
  status?: string
  title: string
  notes?: string
  performedAt?: string
  dueAt?: string
  cost?: number
  sourceMessageId?: string
  sourceActionId?: string
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly vessels: VesselsService,
    private readonly rewards: RewardsService,
  ) {}

  listTemplates(category?: string) {
    return this.prisma.equipmentTemplate.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  }

  async createTemplate(input: { name: string; category?: string; brand?: string; model?: string; defaultMaintenanceDays?: number; specsJson?: unknown; partsJson?: unknown }) {
    if (!input.name?.trim()) throw new BadRequestException('Template name is required')
    return this.prisma.equipmentTemplate.create({
      data: {
        name: input.name.trim(),
        category: input.category ?? 'other',
        brand: input.brand,
        model: input.model,
        defaultMaintenanceDays: input.defaultMaintenanceDays,
        specsJson: jsonOrUndefined(input.specsJson),
        partsJson: jsonOrUndefined(input.partsJson),
      },
    })
  }

  async list(userId: string, filters: { vesselId?: string; status?: string }) {
    if (!filters.vesselId) throw new BadRequestException('vesselId is required')
    await this.vessels.ensureUserVessel(userId, filters.vesselId)
    return this.prisma.equipment.findMany({
      where: { vesselId: filters.vesselId, deletedAt: null, ...(filters.status ? { status: filters.status } : {}) },
      include: { template: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  }

  async due(userId: string, filters: { vesselId?: string; withinDays?: number }) {
    if (!filters.vesselId) throw new BadRequestException('vesselId is required')
    await this.vessels.ensureUserVessel(userId, filters.vesselId)
    const until = new Date()
    until.setDate(until.getDate() + Math.max(0, filters.withinDays ?? 30))
    const items = await this.prisma.equipment.findMany({
      where: { vesselId: filters.vesselId, deletedAt: null, nextDueAt: { lte: until } },
      orderBy: [{ nextDueAt: 'asc' }],
    })
    const vessel = await this.prisma.vessel.findUnique({ where: { id: filters.vesselId } })
    if (vessel) {
      for (const item of items) {
        await this.notifications.notify({
          userId: vessel.ownerId,
          vesselId: vessel.id,
          sourceType: 'equipment',
          sourceId: item.id,
          type: 'maintenance.due',
          title: 'Maintenance due',
          body: `${item.name} needs maintenance.`,
          severity: 'warning',
          payload: { nextDueAt: item.nextDueAt },
        })
      }
    }
    return items
  }

  async get(userId: string, equipmentId: string) {
    const equipment = await this.prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { template: true, maintenanceRecords: { orderBy: { createdAt: 'desc' } } },
    })
    if (!equipment || equipment.deletedAt) throw new BadRequestException('Equipment not found')
    await this.vessels.ensureUserVessel(userId, equipment.vesselId)
    return equipment
  }

  async create(userId: string, input: UpsertEquipmentInput) {
    await this.vessels.ensureUserVessel(userId, input.vesselId)
    if (!input.name?.trim()) throw new BadRequestException('Equipment name is required')
    const installedAt = parseDate(input.installedAt)
    const lastServicedAt = parseDate(input.lastServicedAt)
    const intervalDays = input.maintenanceIntervalDays
    return this.prisma.equipment.create({
      data: {
        vesselId: input.vesselId,
        templateId: input.templateId,
        name: input.name.trim(),
        category: input.category ?? 'other',
        brand: input.brand,
        model: input.model,
        status: input.status ?? 'active',
        location: input.location,
        installedAt,
        maintenanceIntervalDays: intervalDays,
        lastServicedAt,
        nextDueAt: deriveNextDue(lastServicedAt ?? installedAt, intervalDays),
        partsJson: jsonOrUndefined(input.partsJson),
        metadata: jsonOrUndefined(input.metadata),
      },
    })
  }

  async update(userId: string, equipmentId: string, input: Partial<UpsertEquipmentInput>) {
    const existing = await this.get(userId, equipmentId)
    const installedAt = input.installedAt !== undefined ? parseDate(input.installedAt) : existing.installedAt
    const lastServicedAt = input.lastServicedAt !== undefined ? parseDate(input.lastServicedAt) : existing.lastServicedAt
    const intervalDays = input.maintenanceIntervalDays !== undefined ? input.maintenanceIntervalDays : existing.maintenanceIntervalDays
    return this.prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.installedAt !== undefined ? { installedAt } : {}),
        ...(input.maintenanceIntervalDays !== undefined ? { maintenanceIntervalDays: intervalDays } : {}),
        ...(input.lastServicedAt !== undefined ? { lastServicedAt } : {}),
        ...(input.partsJson !== undefined ? { partsJson: jsonOrUndefined(input.partsJson) } : {}),
        ...(input.metadata !== undefined ? { metadata: jsonOrUndefined(input.metadata) } : {}),
        nextDueAt: deriveNextDue(lastServicedAt ?? installedAt, intervalDays),
        version: { increment: 1 },
      },
    })
  }

  async softDelete(userId: string, equipmentId: string) {
    await this.get(userId, equipmentId)
    return this.prisma.equipment.update({
      where: { id: equipmentId },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    })
  }

  async listMaintenance(userId: string, equipmentId: string) {
    const equipment = await this.get(userId, equipmentId)
    return this.prisma.maintenanceRecord.findMany({
      where: { equipmentId: equipment.id },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addMaintenance(userId: string, equipmentId: string, input: CreateMaintenanceInput) {
    const equipment = await this.get(userId, equipmentId)
    if (!input.title?.trim()) throw new BadRequestException('Maintenance title is required')
    const performedAt = parseDate(input.performedAt) ?? (input.status === 'done' ? new Date() : null)
    const status = input.status ?? 'open'
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.maintenanceRecord.create({
        data: {
          vesselId: equipment.vesselId,
          equipmentId: equipment.id,
          type: input.type ?? 'service',
          status,
          title: input.title.trim(),
          notes: input.notes,
          performedAt,
          dueAt: parseDate(input.dueAt),
          cost: input.cost,
          completedById: status === 'done' ? userId : null,
          sourceMessageId: input.sourceMessageId,
          sourceActionId: input.sourceActionId,
        },
      })
      if (record.type === 'service' && record.status === 'done') {
        await tx.equipment.update({
          where: { id: equipment.id },
          data: {
            lastServicedAt: performedAt,
            nextDueAt: deriveNextDue(performedAt, equipment.maintenanceIntervalDays),
            status: 'active',
            version: { increment: 1 },
          },
        })
      }
      return record
    }).then(async (record) => {
      if (record.status === 'done') {
        await this.rewards.grant({
          ruleKey: 'maintenance.completed',
          userId,
          vesselId: equipment.vesselId,
          sourceType: 'maintenance',
          sourceId: record.id,
        })
        await this.notifications.notify({
          userId,
          vesselId: equipment.vesselId,
          sourceType: 'maintenance',
          sourceId: record.id,
          type: 'maintenance.completed',
          title: 'Maintenance recorded',
          body: `${record.title} was completed.`,
          severity: 'info',
        })
      }
      return record
    })
  }
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date')
  return date
}

function deriveNextDue(anchor: Date | null, intervalDays?: number | null) {
  if (!anchor || !intervalDays) return null
  const due = new Date(anchor)
  due.setDate(due.getDate() + intervalDays)
  return due
}

function jsonOrUndefined(value: unknown) {
  return value === undefined ? undefined : value as any
}
