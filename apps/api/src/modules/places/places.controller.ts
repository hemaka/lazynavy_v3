import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { CreateDiscoveryPointInput, CreatePoiInput, PlacesService, UnlockDiscoveryInput } from './places.service'

@Controller()
export class PlacesController {
  constructor(
    private readonly identity: IdentityService,
    private readonly places: PlacesService,
  ) {}

  @Get('pois')
  listPois() {
    return this.places.listPois()
  }

  @Post('pois')
  async createPoi(@Body() body: CreatePoiInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.places.createPoi(user.id, body)
  }

  @Patch('pois/:id/confirm')
  async confirmPoi(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.places.confirmPoi(user.id, id)
  }

  @Get('discovery-points')
  listDiscoveryPoints() {
    return this.places.listDiscoveryPoints()
  }

  @Post('discovery-points')
  createDiscoveryPoint(@Body() body: CreateDiscoveryPointInput) {
    return this.places.createDiscoveryPoint(body)
  }

  @Post('discovery-unlocks')
  async unlockDiscovery(@Body() body: UnlockDiscoveryInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.places.unlockDiscovery(user.id, body)
  }
}
