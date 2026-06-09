import { Controller, Get, Param, Patch, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  async list(@Query('status') status?: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.notifications.list(user.id, status)
  }

  @Patch(':id/read')
  async read(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.notifications.markRead(user.id, id)
  }
}
