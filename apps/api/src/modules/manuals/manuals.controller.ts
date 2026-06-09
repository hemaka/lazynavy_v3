import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { ManualsService, type UpsertManualInput } from './manuals.service'

@Controller()
export class ManualsController {
  constructor(
    private readonly identity: IdentityService,
    private readonly manuals: ManualsService,
  ) {}

  @Get('manuals/search')
  async search(@Query('q') q = '', @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.manuals.search(user.id, q)
  }

  @Get('manuals')
  async list(@Query('vesselId') vesselId?: string, @Query('equipmentId') equipmentId?: string, @Query('type') type?: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.manuals.list(user.id, { vesselId, equipmentId, type })
  }

  @Post('manuals')
  async create(@Body() body: UpsertManualInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.manuals.create(user.id, body)
  }

  @Get('manuals/:id')
  async get(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.manuals.get(user.id, id)
  }

  @Patch('manuals/:id')
  async update(@Param('id') id: string, @Body() body: Partial<UpsertManualInput>, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.manuals.update(user.id, id, body)
  }

  @Delete('manuals/:id')
  async remove(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.manuals.softDelete(user.id, id)
  }

  @Get('vessels/:vesselId/manuals')
  async vesselManuals(@Param('vesselId') vesselId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.manuals.list(user.id, { vesselId })
  }

  @Get('equipment/:equipmentId/manuals')
  async equipmentManuals(@Param('equipmentId') equipmentId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.manuals.list(user.id, { equipmentId })
  }
}
