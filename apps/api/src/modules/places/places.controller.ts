import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common'
import { IdentityService } from '../identity/identity.service'
import { JwtAuthGuard } from '../identity/auth/guards/jwt-auth.guard'
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
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
  ) {
    return this.places.listPois({
      category,
      q,
      limit: limit ? Number(limit) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      zoom: zoom ? Number(zoom) : undefined,
      minLat: minLat ? Number(minLat) : undefined,
      maxLat: maxLat ? Number(maxLat) : undefined,
      minLng: minLng ? Number(minLng) : undefined,
      maxLng: maxLng ? Number(maxLng) : undefined,
    })
  }

  @Get('pois/summary')
  listPoiSummaries(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('zoom') zoom?: string,
    @Query('minLat') minLat?: string,
    @Query('maxLat') maxLat?: string,
    @Query('minLng') minLng?: string,
    @Query('maxLng') maxLng?: string,
  ) {
    return this.places.listPoiSummaries({
      category,
      q,
      limit: limit ? Number(limit) : undefined,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      zoom: zoom ? Number(zoom) : undefined,
      minLat: minLat ? Number(minLat) : undefined,
      maxLat: maxLat ? Number(maxLat) : undefined,
      minLng: minLng ? Number(minLng) : undefined,
      maxLng: maxLng ? Number(maxLng) : undefined,
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
  @UseGuards(JwtAuthGuard)
  addPoiNote(@Param('id') id: string, @Body() body: AddPoiNoteInput, @Request() req: any) {
    return this.places.addPoiNote(id, req.user.id, body)
  }

  @Delete('pois/:id/notes/:noteId')
  @UseGuards(JwtAuthGuard)
  deletePoiNote(@Param('id') id: string, @Param('noteId') noteId: string, @Request() req: any) {
    return this.places.deletePoiNote(id, noteId, req.user.id)
  }

  @Get('pois/:id/reviews')
  listPoiReviews(@Param('id') id: string) {
    return this.places.listPoiReviews(id)
  }

  @Get('pois/:id/reviews/me')
  @UseGuards(JwtAuthGuard)
  myPoiReview(@Param('id') id: string, @Request() req: any) {
    return this.places.getMyPoiReview(id, req.user.id)
  }

  @Post('pois/:id/reviews')
  @UseGuards(JwtAuthGuard)
  upsertPoiReview(@Param('id') id: string, @Body() body: UpsertPoiReviewInput, @Request() req: any) {
    return this.places.upsertPoiReview(id, req.user.id, body)
  }

  @Delete('pois/:id/reviews/me')
  @UseGuards(JwtAuthGuard)
  deletePoiReview(@Param('id') id: string, @Request() req: any) {
    return this.places.deletePoiReview(id, req.user.id)
  }

  @Get('pois/:id/favorite')
  @UseGuards(JwtAuthGuard)
  isPoiFavorited(@Param('id') id: string, @Request() req: any) {
    return this.places.isPoiFavorited(id, req.user.id)
  }

  @Post('pois/:id/favorite')
  @UseGuards(JwtAuthGuard)
  addPoiFavorite(@Param('id') id: string, @Request() req: any) {
    return this.places.addPoiFavorite(id, req.user.id)
  }

  @Delete('pois/:id/favorite')
  @UseGuards(JwtAuthGuard)
  removePoiFavorite(@Param('id') id: string, @Request() req: any) {
    return this.places.removePoiFavorite(id, req.user.id)
  }

  @Get('pois/mine/favorites')
  @UseGuards(JwtAuthGuard)
  listFavoritePois(@Request() req: any) {
    return this.places.listFavoritePois(req.user.id)
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
