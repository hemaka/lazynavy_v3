import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { SuppliesService, type UpsertSupplyInput } from './supplies.service'

@Controller('vessels/:vesselId/supplies')
export class SuppliesController {
  constructor(
    private readonly identity: IdentityService,
    private readonly supplies: SuppliesService,
  ) {}

  @Get()
  async list(@Param('vesselId') vesselId: string, @Query('userId') userId?: string, @Query('low') low?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return low === '1' ? this.supplies.lowStock(user.id, vesselId) : this.supplies.list(user.id, vesselId)
  }

  @Post()
  async create(@Param('vesselId') vesselId: string, @Body() body: UpsertSupplyInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.supplies.create(user.id, vesselId, body)
  }

  @Patch(':itemId/adjust')
  async adjust(@Param('itemId') itemId: string, @Body() body: { delta: number }, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.supplies.adjust(user.id, itemId, body.delta)
  }
}
