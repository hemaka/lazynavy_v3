import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import {
  VesselsService,
  type AddCrewInput,
  type CreateInvitationInput,
  type CreateVesselInput,
  type UpdateVesselInput,
} from './vessels.service'

@Controller('vessels')
export class VesselsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly vessels: VesselsService,
  ) {}

  @Get('roles')
  async roles() {
    return this.vessels.listRoles()
  }

  @Get('models')
  async models(@Query('type') type?: string) {
    return this.vessels.listModels(type)
  }

  @Post('models')
  async createModel(@Body() body: { brand: string; model: string; type?: string; lengthFt?: number; yearStart?: number; yearEnd?: number; specsJson?: unknown; equipmentDefaultsJson?: unknown }) {
    return this.vessels.createModel(body)
  }

  @Post('join')
  async join(@Body() body: { code: string }, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.acceptInvitation(user.id, body.code)
  }

  @Get()
  async list(@Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.vessels.listForUser(user.id)
  }

  @Post()
  async create(@Body() body: CreateVesselInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.createForUser(user.id, body)
  }

  @Patch(':id')
  async update(@Param('id') vesselId: string, @Body() body: UpdateVesselInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.updateVessel(user.id, vesselId, body)
  }

  @Patch(':id/current')
  async setCurrent(@Param('id') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.setCurrent(user.id, vesselId)
  }

  @Get(':id/permissions/me')
  async myPermissions(@Param('id') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.permissionsForUser(user.id, vesselId)
  }

  @Post(':id/crew')
  async addCrew(@Param('id') vesselId: string, @Body() body: AddCrewInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.addCrew(user.id, vesselId, body)
  }

  @Get(':id/invitations')
  async invitations(@Param('id') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.listInvitations(user.id, vesselId)
  }

  @Post(':id/invitations')
  async createInvitation(@Param('id') vesselId: string, @Body() body: CreateInvitationInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.createInvitation(user.id, vesselId, body)
  }

  @Patch(':id/invitations/:invitationId/revoke')
  async revokeInvitation(@Param('id') vesselId: string, @Param('invitationId') invitationId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.revokeInvitation(user.id, vesselId, invitationId)
  }

  @Get(':id/setup-steps')
  async setupSteps(@Param('id') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.listSetupSteps(user.id, vesselId)
  }

  @Patch(':id/setup-steps/:key/complete')
  async completeSetupStep(@Param('id') vesselId: string, @Param('key') key: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.completeSetupStep(user.id, vesselId, key)
  }

  @Patch(':id/setup-steps/:key/skip')
  async skipSetupStep(@Param('id') vesselId: string, @Param('key') key: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.skipSetupStep(user.id, vesselId, key)
  }
}
