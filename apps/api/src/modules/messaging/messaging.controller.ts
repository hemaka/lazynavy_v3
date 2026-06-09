import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { MessagingService } from './messaging.service'

@Controller('messages')
export class MessagingController {
  constructor(
    private readonly identity: IdentityService,
    private readonly messaging: MessagingService,
  ) {}

  @Get('threads')
  async threads(@Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.messaging.listThreads(user.id)
  }

  @Get('threads/:threadId')
  async messages(@Param('threadId') threadId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.messaging.listMessages(user.id, threadId)
  }

  @Post('threads/:threadId/messages')
  async send(@Param('threadId') threadId: string, @Body() body: { body: string; kind?: string; metadata?: unknown }, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.messaging.send(user.id, threadId, body)
  }
}
