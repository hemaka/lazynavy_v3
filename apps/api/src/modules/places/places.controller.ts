import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { AddPoiNoteInput, CreateDiscoveryPointInput, CreatePoiInput, PlacesService, UpsertPoiReviewInput, UnlockDiscoveryInput } from './places.service'

@Controller()
export class PlacesController {
  constructor(
    private readonly identity: IdentityService,
    private readonly places: PlacesService,
  ) {}

  @Get('pois')
  listPois(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('zoom') zoom?: string,
  ) {
    return this.places.listPois({
      category,
      q,
      limit: limit ? Number(limit) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      zoom: zoom ? Number(zoom) : undefined,
    })
  }

  @Get('pois/summary')
  listPoiSummaries(
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('zoom') zoom?: string,
  ) {
    return this.places.listPoiSummaries({
      category,
      limit: limit ? Number(limit) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      zoom: zoom ? Number(zoom) : undefined,
    })
  }

  @Get('pois/:id')
  getPoi(@Param('id') id: string) {
    return this.places.getPoiById(id)
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

  @Get('pois/:id/notes')
  listPoiNotes(@Param('id') id: string) {
    return this.places.listPoiNotes(id)
  }

  @Post('pois/:id/notes')
  async addPoiNote(@Param('id') id: string, @Body() body: AddPoiNoteInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.places.addPoiNote(id, user.id, body)
  }

  @Delete('pois/:id/notes/:noteId')
  deletePoiNote(@Param('id') id: string, @Param('noteId') noteId: string) {
    return this.places.deletePoiNote(id, noteId)
  }

  @Get('pois/:id/reviews')
  listPoiReviews(@Param('id') id: string) {
    return this.places.listPoiReviews(id)
  }

  @Get('pois/:id/reviews/me')
  myPoiReview() {
    return null
  }

  @Post('pois/:id/reviews')
  async upsertPoiReview(@Param('id') id: string, @Body() body: UpsertPoiReviewInput, @Query('userId') userId?: string) {
    const user = userId ? await this.identity.getUser(userId) : await this.identity.getOrCreateDevUser()
    if (!user) throw new Error('User not found')
    return this.places.upsertPoiReview(id, user.id, body)
  }

  @Delete('pois/:id/reviews/me')
  deletePoiReview() {
    return { ok: true }
  }

  @Get('pois/:id/favorite')
  isPoiFavorited() {
    return { favorited: false }
  }

  @Post('pois/:id/favorite')
  addPoiFavorite() {
    return { favorited: true }
  }

  @Delete('pois/:id/favorite')
  removePoiFavorite() {
    return { favorited: false }
  }

  @Get('pois/mine/favorites')
  listFavoritePois() {
    return []
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
