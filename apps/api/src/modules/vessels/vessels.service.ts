import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { MessagingService } from '../messaging/messaging.service'
import { NotificationsService } from '../notifications/notifications.service'
import { RewardsService } from '../rewards/rewards.service'

const ROLE_TEMPLATES = [
  { key: 'owner', name: 'Owner', rank: 100, permissions: ['vessel.manage', 'crew.manage', 'invite.manage', 'voyage.manage', 'supplies.manage'] },
  { key: 'captain', name: 'Captain', rank: 90, permissions: ['crew.manage', 'invite.manage', 'voyage.manage', 'supplies.manage'] },
  { key: 'navigator', name: 'Navigator', rank: 70, permissions: ['voyage.manage', 'log.create', 'poi.confirm'] },
  { key: 'crew', name: 'Crew', rank: 50, permissions: ['log.create', 'supplies.view', 'poi.confirm'] },
  { key: 'guest', name: 'Guest', rank: 20, permissions: ['log.create'] },
] as const

const SETUP_STEPS = [
  { key: 'profile', title: 'Boat profile', sortOrder: 10 },
  { key: 'home_port', title: 'Home port', sortOrder: 20 },
  { key: 'supplies', title: 'First supplies', sortOrder: 30 },
  { key: 'crew', title: 'Crew invite', sortOrder: 40 },
] as const

export interface CreateVesselInput {
  name: string
  type?: string
  homePort?: string
  registeredName?: string
  buildYear?: number
  acquisitionYear?: number
}

export interface UpdateVesselInput {
  name?: string
  type?: string
  homePort?: string
  registeredName?: string
  buildYear?: number
  acquisitionYear?: number
  sceneTemplate?: string
}

export interface AddCrewInput {
  userId: string
  role?: string
}

export interface CreateInvitationInput {
  role?: string
  expiresInDays?: number
}

@Injectable()
export class VesselsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
    private readonly notifications: NotificationsService,
    private readonly rewards: RewardsService,
  ) {}

  async listRoles() {
    await this.ensureRoleTemplates()
    return this.prisma.vesselRoleTemplate.findMany({
      where: { enabled: true },
      orderBy: { rank: 'desc' },
    })
  }

  listForUser(userId: string) {
    return this.prisma.vessel.findMany({
      where: {
        deletedAt: null,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      include: { memberships: true, setupSteps: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ updatedAt: 'desc' }],
    })
  }

  async createForUser(userId: string, input: CreateVesselInput) {
    if (!input.name?.trim()) throw new BadRequestException('Vessel name is required')
    await this.ensureRoleTemplates()
    const vessel = await this.prisma.vessel.create({
      data: {
        ownerId: userId,
        name: input.name.trim(),
        type: input.type,
        homePort: input.homePort,
        registeredName: input.registeredName,
        buildYear: input.buildYear,
        acquisitionYear: input.acquisitionYear,
        sceneTemplate: 'marina',
        memberships: { create: { userId, role: 'captain' } },
        setupSteps: { create: SETUP_STEPS.map((step) => ({ ...step })) },
      },
      include: { memberships: true, setupSteps: { orderBy: { sortOrder: 'asc' } } },
    })
    await this.messaging.ensureBoatThread(vessel.id, `${vessel.name} Crew`, userId)
    await this.prisma.user.update({ where: { id: userId }, data: { currentVesselId: vessel.id } })
    return vessel
  }

  async updateVessel(actorId: string, vesselId: string, input: UpdateVesselInput) {
    await this.ensureCanManage(actorId, vesselId)
    const data = {
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.homePort !== undefined ? { homePort: input.homePort } : {}),
      ...(input.registeredName !== undefined ? { registeredName: input.registeredName } : {}),
      ...(input.buildYear !== undefined ? { buildYear: input.buildYear } : {}),
      ...(input.acquisitionYear !== undefined ? { acquisitionYear: input.acquisitionYear } : {}),
      ...(input.sceneTemplate !== undefined ? { sceneTemplate: input.sceneTemplate } : {}),
    }
    return this.prisma.vessel.update({
      where: { id: vesselId },
      data,
      include: { memberships: true, setupSteps: { orderBy: { sortOrder: 'asc' } } },
    })
  }

  async setCurrent(userId: string, vesselId: string) {
    const vessel = await this.ensureUserVessel(userId, vesselId)
    await this.prisma.user.update({ where: { id: userId }, data: { currentVesselId: vessel.id } })
    return vessel
  }

  async addCrew(actorId: string, vesselId: string, input: AddCrewInput) {
    await this.ensureCanManageCrew(actorId, vesselId)
    const membership = await this.prisma.vesselMembership.upsert({
      where: { vesselId_userId: { vesselId, userId: input.userId } },
      create: { vesselId, userId: input.userId, role: input.role ?? 'guest' },
      update: { role: input.role ?? 'guest' },
    })
    await this.messaging.addBoatMember(vesselId, input.userId, input.role ?? 'guest')
    return membership
  }

  async listInvitations(actorId: string, vesselId: string) {
    await this.ensureCanManageCrew(actorId, vesselId)
    return this.prisma.vesselInvitation.findMany({
      where: { vesselId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createInvitation(actorId: string, vesselId: string, input: CreateInvitationInput) {
    await this.ensureCanManageCrew(actorId, vesselId)
    const role = input.role ?? 'crew'
    if (!ROLE_TEMPLATES.some((template) => template.key === role)) throw new BadRequestException('Unknown vessel role')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + Math.max(1, Math.min(input.expiresInDays ?? 14, 90)))

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomBytes(4).toString('hex').toUpperCase()
      try {
        const invitation = await this.prisma.vesselInvitation.create({
          data: { vesselId, invitedById: actorId, role, code, expiresAt },
        })
        await this.notifications.notify({
          userId: actorId,
          vesselId,
          sourceType: 'vessel_invitation',
          sourceId: invitation.id,
          type: 'boat.invitation.created',
          title: 'Boat invite created',
          body: `Invite code ${invitation.code} is ready for ${role}.`,
          payload: { code: invitation.code, role },
        })
        return invitation
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err
      }
    }
    throw new BadRequestException('Could not allocate invitation code')
  }

  async revokeInvitation(actorId: string, vesselId: string, invitationId: string) {
    await this.ensureCanManageCrew(actorId, vesselId)
    return this.prisma.vesselInvitation.updateMany({
      where: { id: invitationId, vesselId, status: 'active' },
      data: { status: 'revoked' },
    })
  }

  async acceptInvitation(userId: string, code: string) {
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) throw new BadRequestException('Invitation code is required')
    const invite = await this.prisma.vesselInvitation.findUnique({ where: { code: cleanCode }, include: { vessel: true } })
    if (!invite || invite.status !== 'active') throw new BadRequestException('Invitation is not active')
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) throw new BadRequestException('Invitation has expired')
    if (invite.vessel.deletedAt) throw new BadRequestException('Vessel is no longer available')

    const result = await this.prisma.$transaction(async (tx) => {
      const membership = await tx.vesselMembership.upsert({
        where: { vesselId_userId: { vesselId: invite.vesselId, userId } },
        create: { vesselId: invite.vesselId, userId, role: invite.role },
        update: { role: invite.role },
      })
      await tx.vesselInvitation.update({
        where: { id: invite.id },
        data: { status: 'claimed', claimedById: userId, claimedAt: new Date() },
      })
      const user = await tx.user.findUnique({ where: { id: userId } })
      if (user && !user.currentVesselId) {
        await tx.user.update({ where: { id: userId }, data: { currentVesselId: invite.vesselId } })
      }
      return { vessel: invite.vessel, membership }
    })
    await this.messaging.addBoatMember(invite.vesselId, userId, invite.role)
    await this.notifications.notify({
      userId: invite.vessel.ownerId,
      vesselId: invite.vesselId,
      sourceType: 'vessel_invitation',
      sourceId: invite.id,
      type: 'boat.invitation.claimed',
      title: 'Crew joined boat',
      body: `${userId} joined ${invite.vessel.name} as ${invite.role}.`,
      payload: { userId, role: invite.role },
    })
    return result
  }

  async listSetupSteps(userId: string, vesselId: string) {
    await this.ensureUserVessel(userId, vesselId)
    await this.ensureSetupSteps(vesselId)
    return this.prisma.vesselSetupStep.findMany({
      where: { vesselId },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async completeSetupStep(userId: string, vesselId: string, key: string) {
    await this.ensureCanManage(userId, vesselId)
    await this.ensureSetupSteps(vesselId)
    const step = await this.prisma.vesselSetupStep.update({
      where: { vesselId_key: { vesselId, key } },
      data: { status: 'completed', completedById: userId, completedAt: new Date(), skippedAt: null },
    })
    await this.updateSetupStatusAndReward(userId, vesselId)
    return step
  }

  async skipSetupStep(userId: string, vesselId: string, key: string) {
    await this.ensureCanManage(userId, vesselId)
    await this.ensureSetupSteps(vesselId)
    const step = await this.prisma.vesselSetupStep.update({
      where: { vesselId_key: { vesselId, key } },
      data: { status: 'skipped', completedById: null, completedAt: null, skippedAt: new Date() },
    })
    await this.updateSetupStatusAndReward(userId, vesselId)
    return step
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

  private async ensureCanManage(userId: string, vesselId: string) {
    const vessel = await this.ensureUserVessel(userId, vesselId)
    const actorMembership = vessel.memberships.find((m) => m.userId === userId)
    if (vessel.ownerId !== userId && actorMembership?.role !== 'captain') {
      throw new ForbiddenException('Only owner or captain can manage vessel')
    }
    return vessel
  }

  private async ensureCanManageCrew(userId: string, vesselId: string) {
    const vessel = await this.ensureCanManage(userId, vesselId)
    return vessel
  }

  private async ensureRoleTemplates() {
    for (const template of ROLE_TEMPLATES) {
      await this.prisma.vesselRoleTemplate.upsert({
        where: { key: template.key },
        create: template,
        update: { name: template.name, rank: template.rank, permissions: template.permissions, enabled: true },
      })
    }
  }

  private async ensureSetupSteps(vesselId: string) {
    for (const step of SETUP_STEPS) {
      await this.prisma.vesselSetupStep.upsert({
        where: { vesselId_key: { vesselId, key: step.key } },
        create: { vesselId, ...step },
        update: {},
      })
    }
  }

  private async updateSetupStatusAndReward(userId: string, vesselId: string) {
    const openCount = await this.prisma.vesselSetupStep.count({ where: { vesselId, status: 'open' } })
    if (openCount > 0) return
    await this.prisma.vessel.update({ where: { id: vesselId }, data: { setupStatus: 'completed' } })
    await this.rewards.grant({
      ruleKey: 'boat.setup.completed',
      userId,
      vesselId,
      sourceType: 'vessel',
      sourceId: vesselId,
    })
  }
}
