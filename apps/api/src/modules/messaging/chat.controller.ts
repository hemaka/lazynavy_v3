import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../identity/auth/guards/jwt-auth.guard'
import { MessagingService } from './messaging.service'

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('rooms')
  listRooms(@Request() req: any) {
    return this.messaging.listRooms(req.user.id)
  }

  @Post('locations')
  getOrCreateLocationRoom(
    @Request() req: any,
    @Body() dto: { sourceType: string; sourceId: string; title?: string; homeRegion?: string; geoRegion?: string },
  ) {
    return this.messaging.getOrCreateLocationRoom(req.user.id, dto)
  }

  @Get('rooms/:roomId')
  getRoom(@Request() req: any, @Param('roomId') roomId: string) {
    return this.messaging.getRoomForUser(req.user.id, roomId)
  }

  @Get('rooms/:roomId/messages')
  listMessages(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.messaging.listRoomMessages(req.user.id, roomId, cursor, limit)
  }

  @Post('rooms/:roomId/messages')
  sendMessage(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: { clientMessageId?: string; type?: string; text?: string; payload?: Record<string, unknown> },
  ) {
    return this.messaging.sendRoomMessage(req.user.id, roomId, dto)
  }

  @Post('rooms/:roomId/read')
  markRead(@Request() req: any, @Param('roomId') roomId: string, @Body() dto: { messageId?: string }) {
    return this.messaging.markRead(req.user.id, roomId, dto.messageId)
  }
}
