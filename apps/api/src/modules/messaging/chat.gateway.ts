import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { JwtService } from '@nestjs/jwt'
import type { Server, Socket } from 'socket.io'
import { UsersService } from '../identity/users/users.service'
import { MessagingService } from './messaging.service'
import { ChatRealtimeService } from './chat-realtime.service'

type AuthenticatedSocket = Socket & { data: { user?: { id: string; nickname?: string } } }

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server

  constructor(
    private jwt: JwtService,
    private users: UsersService,
    private messaging: MessagingService,
    private realtime: ChatRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.setServer(server)
    server.use(async (client: AuthenticatedSocket, next) => {
      try {
        const token = this.extractToken(client)
        if (!token) throw new Error('Unauthorized')

        const payload = await this.jwt.verifyAsync<{ sub: string; nickname?: string; ver?: number }>(token)
        const user = await this.users.findById(payload.sub)
        if ((payload.ver ?? 0) !== user.tokenVersion) throw new Error('Token revoked')
        client.data.user = { id: user.id, nickname: user.nickname }
        next()
      } catch {
        next(new Error('Unauthorized'))
      }
    })
  }

  async handleConnection(client: AuthenticatedSocket) {
    const user = client.data.user
    if (user) await client.join(this.realtime.userChannel(user.id))
  }

  @SubscribeMessage('room:join')
  async joinRoom(client: AuthenticatedSocket, data: { roomId?: string }, ack?: (response: unknown) => void) {
    const userId = this.requireSocketUser(client)
    if (!data?.roomId) throw new WsException('roomId is required')

    const room = await this.messaging.getRoomForUser(userId, data.roomId)
    await client.join(this.realtime.roomChannel(data.roomId))
    ack?.({ ok: true, room })
  }

  @SubscribeMessage('room:leave')
  async leaveRoom(client: AuthenticatedSocket, data: { roomId?: string }, ack?: (response: unknown) => void) {
    this.requireSocketUser(client)
    if (!data?.roomId) throw new WsException('roomId is required')

    await client.leave(this.realtime.roomChannel(data.roomId))
    ack?.({ ok: true, roomId: data.roomId })
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    client: AuthenticatedSocket,
    data: { roomId?: string; clientMessageId?: string; type?: string; text?: string; payload?: Record<string, unknown> },
    ack?: (response: unknown) => void,
  ) {
    const userId = this.requireSocketUser(client)
    if (!data?.roomId) throw new WsException('roomId is required')

    const message = await this.messaging.sendRoomMessage(userId, data.roomId, {
      clientMessageId: data.clientMessageId,
      type: data.type,
      text: data.text,
      payload: data.payload,
    })
    ack?.({ ok: true, message })
  }

  @SubscribeMessage('message:read')
  async markRead(client: AuthenticatedSocket, data: { roomId?: string; messageId?: string }, ack?: (response: unknown) => void) {
    const userId = this.requireSocketUser(client)
    if (!data?.roomId) throw new WsException('roomId is required')

    const readState = await this.messaging.markRead(userId, data.roomId, data.messageId)
    ack?.({ ok: true, readState })
  }

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string') return authToken.replace(/^Bearer\s+/i, '')
    const header = client.handshake.headers.authorization
    return header ? header.replace(/^Bearer\s+/i, '') : null
  }

  private requireSocketUser(client: AuthenticatedSocket) {
    const userId = client.data.user?.id
    if (!userId) throw new WsException('Unauthorized')
    return userId
  }
}
