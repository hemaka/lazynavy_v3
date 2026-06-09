import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { VesselsService, type AddCrewInput, type CreateVesselInput } from './vessels.service'

@Controller('vessels')
export class VesselsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly vessels: VesselsService,
  ) {}

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

  @Patch(':id/current')
  async setCurrent(@Param('id') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.setCurrent(user.id, vesselId)
  }

  @Post(':id/crew')
  async addCrew(@Param('id') vesselId: string, @Body() body: AddCrewInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.vessels.addCrew(user.id, vesselId, body)
  }
}
