import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { type CreateLogInput, LogsService } from './logs.service'

@Controller('logs')
export class LogsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly logs: LogsService,
  ) {}

  @Get()
  async list(@Query('userId') userId?: string, @Query('vesselId') vesselId?: string, @Query('voyageId') voyageId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.logs.list(user.id, { vesselId, voyageId })
  }

  @Post()
  async create(@Body() body: CreateLogInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.logs.create(user.id, body)
  }
}
