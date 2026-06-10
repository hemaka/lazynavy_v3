import { Injectable } from '@nestjs/common'
import type { Server } from 'socket.io'

@Injectable()
export class ChatRealtimeService {
  private server?: Server

  setServer(server: Server) {
    this.server = server
  }

  roomChannel(roomId: string) {
    return `room:${roomId}`
  }

  userChannel(userId: string) {
    return `user:${userId}`
  }

  emitToRoom(roomId: string, event: string, payload: unknown) {
    this.server?.to(this.roomChannel(roomId)).emit(event, payload)
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(this.userChannel(userId)).emit(event, payload)
  }
}
