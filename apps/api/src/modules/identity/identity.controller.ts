import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService, type CreateManagedAccountInput } from './identity.service'

@Controller('identity')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Get('dev-session')
  async devSession() {
    const user = await this.identity.getOrCreateDevUser()
    return { user }
  }

  @Get('managed-accounts')
  async managedAccounts(@Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.identity.listManagedAccounts(user.id)
  }

  @Post('managed-accounts')
  async createManagedAccount(@Body() body: CreateManagedAccountInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.identity.createManagedAccount(user.id, body)
  }

  @Patch('managed-accounts/:id')
  async bindManagedAccount(@Param('id') id: string, @Body() body: { internalEmail?: string; nickname?: string }, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.identity.bindManagedAccount(user.id, id, body)
  }
}
