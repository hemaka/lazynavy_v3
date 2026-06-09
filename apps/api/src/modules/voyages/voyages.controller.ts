import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { type CreateVoyageInput, VoyagesService } from './voyages.service'

@Controller('voyages')
export class VoyagesController {
  constructor(
    private readonly identity: IdentityService,
    private readonly voyages: VoyagesService,
  ) {}

  @Get()
  async list(@Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.voyages.listForUser(user.id)
  }

  @Post()
  async create(@Body() body: CreateVoyageInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.createPlan(user.id, body)
  }

  @Patch(':id/confirm')
  async confirm(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.confirm(user.id, id)
  }

  @Patch(':id/start')
  async start(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.start(user.id, id)
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.complete(user.id, id)
  }
}
