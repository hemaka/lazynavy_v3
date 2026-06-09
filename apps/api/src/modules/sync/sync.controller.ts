import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { SyncService, type SyncMutationInput } from './sync.service'

@Controller('sync')
export class SyncController {
  constructor(
    private readonly identity: IdentityService,
    private readonly sync: SyncService,
  ) {}

  @Get('bootstrap')
  async bootstrap(@Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.sync.bootstrap(user.id)
  }

  @Get('changes')
  async changes(@Query('since') since?: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.sync.changes(user.id, since)
  }

  @Post('mutations')
  async mutation(@Body() body: SyncMutationInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.sync.submitMutation(user.id, body)
  }
}
