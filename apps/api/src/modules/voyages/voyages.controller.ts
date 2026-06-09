import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { type CreateVoyageDocumentInput, type CreateVoyageInput, VoyagesService } from './voyages.service'

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
  async start(@Param('id') id: string, @Body() body: { skipChecklistWarning?: boolean } = {}, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.start(user.id, id, body)
  }

  @Get(':id/checklist')
  async checklist(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.voyages.listChecklist(user.id, id)
  }

  @Patch(':id/checklist/:itemId/complete')
  async completeChecklist(@Param('id') id: string, @Param('itemId') itemId: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.completeChecklistItem(user.id, id, itemId)
  }

  @Get(':id/documents')
  async documents(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) return []
    return this.voyages.listDocuments(user.id, id)
  }

  @Post(':id/documents')
  async createDocument(@Param('id') id: string, @Body() body: CreateVoyageDocumentInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.createDocument(user.id, id, body)
  }

  @Patch(':id/complete')
  async complete(@Param('id') id: string, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.voyages.complete(user.id, id)
  }
}
