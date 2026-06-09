import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { EquipmentService, type CreateMaintenanceInput, type UpsertEquipmentInput } from './equipment.service'

@Controller()
export class EquipmentController {
  constructor(
    private readonly identity: IdentityService,
    private readonly equipment: EquipmentService,
  ) {}

  @Get('equipment-templates')
  templates(@Query('category') category?: string) {
    return this.equipment.listTemplates(category)
  }

  @Post('equipment-templates')
  createTemplate(@Body() body: { name: string; category?: string; brand?: string; model?: string; defaultMaintenanceDays?: number; specsJson?: unknown; partsJson?: unknown }) {
    return this.equipment.createTemplate(body)
  }

  @Get('equipment/due')
  async due(@Query('vesselId') vesselId?: string, @Query('withinDays') withinDays?: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.equipment.due(user.id, { vesselId, withinDays: withinDays ? Number(withinDays) : undefined })
  }

  @Get('equipment')
  async list(@Query('vesselId') vesselId?: string, @Query('status') status?: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.equipment.list(user.id, { vesselId, status })
  }

  @Post('equipment')
  async create(@Body() body: UpsertEquipmentInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.equipment.create(user.id, body)
  }

  @Get('equipment/:id')
  async get(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.equipment.get(user.id, id)
  }

  @Patch('equipment/:id')
  async update(@Param('id') id: string, @Body() body: Partial<UpsertEquipmentInput>, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.equipment.update(user.id, id, body)
  }

  @Delete('equipment/:id')
  async remove(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.equipment.softDelete(user.id, id)
  }

  @Get('equipment/:id/maintenance')
  async listMaintenance(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.equipment.listMaintenance(user.id, id)
  }

  @Post('equipment/:id/maintenance')
  async addMaintenance(@Param('id') id: string, @Body() body: CreateMaintenanceInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.equipment.addMaintenance(user.id, id, body)
  }
}
