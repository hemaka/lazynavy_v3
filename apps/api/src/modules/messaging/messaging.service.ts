import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ChatRealtimeService } from './chat-realtime.service'

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: ChatRealtimeService,
  ) {}

  async ensureBoatThread(vesselId: string, title: string, ownerId: string) {
    const thread = await this.prisma.chatThread.upsert({
      where: { vesselId_type: { vesselId, type: 'boat' } },
      create: {
        vesselId,
        type: 'boat',
        title,
        members: { create: { userId: ownerId, role: 'captain' } },
      },
      update: { title },
      include: { members: true },
    })
    if (!thread.members.some((member) => member.userId === ownerId)) {
      await this.addMember(thread.id, ownerId, 'captain')
    }
    return thread
  }

  async addBoatMember(vesselId: string, userId: string, role = 'member') {
    const vessel = await this.prisma.vessel.findUnique({ where: { id: vesselId } })
    if (!vessel) throw new BadRequestException('Vessel not found')
    const thread = await this.ensureBoatThread(vesselId, `${vessel.name} Crew`, vessel.ownerId)
    return this.addMember(thread.id, userId, role)
  }

  listThreads(userId: string) {
    return this.prisma.chatThread.findMany({
      where: { members: { some: { userId, status: 'active' } } },
      include: { members: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async listMessages(userId: string, threadId: string) {
    await this.ensureThreadMember(userId, threadId)
    return this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })
  }

  async send(userId: string, threadId: string, input: { body: string; kind?: string; metadata?: unknown }) {
    await this.ensureThreadMember(userId, threadId)
    if (!input.body?.trim()) throw new BadRequestException('Message body is required')
    const message = await this.prisma.chatMessage.create({
      data: {
        threadId,
        senderId: userId,
        body: input.body.trim(),
        kind: input.kind ?? 'text',
        metadata: input.metadata as any,
      },
    })
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } })
    return message
  }

  async listRooms(userId: string) {
    const members = await this.prisma.chatMember.findMany({
      where: { userId, status: 'active' },
      include: {
        thread: {
          include: {
            members: {
              where: { status: 'active' },
              include: { user: { select: { id: true, nickname: true, avatar: true } } },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: { id: true, nickname: true, avatar: true } } },
            },
          },
        },
      },
      orderBy: { thread: { updatedAt: 'desc' } },
    })

    return members.map((member) => this.serializeRoom(member.thread, member))
  }

  async getRoomForUser(userId: string, roomId: string) {
    const member = await this.ensureThreadMember(userId, roomId)
    const room = await this.prisma.chatThread.findUnique({
      where: { id: roomId },
      include: {
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, nickname: true, avatar: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, nickname: true, avatar: true } } },
        },
      },
    })
    if (!room) throw new NotFoundException('Chat room not found')
    return this.serializeRoom(room, member)
  }

  async getOrCreateLocationRoom(userId: string, dto: { sourceType: string; sourceId: string; title?: string; homeRegion?: string; geoRegion?: string }) {
    const type = `location:${dto.sourceType}:${dto.sourceId}`
    const existing = await this.prisma.chatThread.findFirst({
      where: { type, vesselId: null },
      include: {
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, nickname: true, avatar: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, nickname: true, avatar: true } } },
        },
      },
    })

    if (existing) {
      const member = await this.addMember(existing.id, userId, 'member')
      return this.serializeRoom(existing, member)
    }

    const room = await this.prisma.chatThread.create({
      data: {
        type,
        title: dto.title?.trim() || dto.sourceId,
        members: { create: { userId, role: 'member', status: 'active' } },
      },
      include: {
        members: {
          where: { status: 'active' },
          include: { user: { select: { id: true, nickname: true, avatar: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, nickname: true, avatar: true } } },
        },
      },
    })
    const member = room.members.find((item) => item.userId === userId) ?? null
    return this.serializeRoom(room, member)
  }

  async listRoomMessages(userId: string, roomId: string, cursor?: string, limit = 50) {
    await this.ensureThreadMember(userId, roomId)
    const take = Math.max(1, Math.min(limit, 100))
    const messages = await this.prisma.chatMessage.findMany({
      where: { threadId: roomId, ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      include: { sender: { select: { id: true, nickname: true, avatar: true } } },
    })
    return messages.reverse().map((message) => this.serializeMessage(message))
  }

  async sendRoomMessage(userId: string, roomId: string, input: { clientMessageId?: string; type?: string; text?: string; payload?: Record<string, unknown> }) {
    await this.ensureThreadMember(userId, roomId)
    const text = input.text?.trim()
    if (!text && !input.payload) throw new BadRequestException('Message body is required')

    const message = await this.prisma.chatMessage.create({
      data: {
        threadId: roomId,
        senderId: userId,
        body: text || '',
        kind: input.type ?? 'TEXT',
        metadata: {
          ...(input.payload ? { payload: input.payload } : {}),
          ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
        } as Prisma.InputJsonValue,
      },
      include: { sender: { select: { id: true, nickname: true, avatar: true } } },
    })
    await this.prisma.chatThread.update({ where: { id: roomId }, data: { updatedAt: new Date() } })

    const serialized = this.serializeMessage(message)
    this.realtime.emitToRoom(roomId, 'message:created', serialized)

    const members = await this.prisma.chatMember.findMany({
      where: { threadId: roomId, status: 'active', userId: { not: userId } },
      select: { userId: true },
    })
    members.forEach((member) => this.realtime.emitToUser(member.userId, 'room:updated', { roomId }))
    return serialized
  }

  async markRead(userId: string, roomId: string, messageId?: string) {
    await this.ensureThreadMember(userId, roomId)
    const payload = { roomId, userId, lastReadMessageId: messageId ?? null, lastReadAt: new Date() }
    this.realtime.emitToRoom(roomId, 'message:read_updated', payload)
    return payload
  }

  private addMember(threadId: string, userId: string, role: string) {
    return this.prisma.chatMember.upsert({
      where: { threadId_userId: { threadId, userId } },
      create: { threadId, userId, role, status: 'active' },
      update: { role, status: 'active' },
    })
  }

  private async ensureThreadMember(userId: string, threadId: string) {
    const member = await this.prisma.chatMember.findUnique({ where: { threadId_userId: { threadId, userId } } })
    if (!member || member.status !== 'active') throw new ForbiddenException('Chat thread not accessible')
    return member
  }

  private serializeRoom(room: any, membership: any) {
    const lastMessage = room.messages?.[0] ? this.serializeMessage(room.messages[0]) : null
    const source = this.parseLocationType(room.type)
    return {
      id: room.id,
      type: source ? 'LOCATION' : room.type === 'boat' ? 'USER_GROUP' : 'USER_GROUP',
      title: room.title,
      avatarUrl: null,
      visibility: source ? 'PUBLIC' : 'PRIVATE',
      sourceType: source?.sourceType ?? null,
      sourceId: source?.sourceId ?? null,
      homeRegion: source?.sourceId ?? null,
      geoRegion: source?.sourceId ?? null,
      dataRegion: null,
      translationLanguages: null,
      createdById: null,
      lastMessage,
      membership: membership ? {
        role: membership.role === 'captain' ? 'OWNER' : 'MEMBER',
        status: 'ACTIVE',
        muted: false,
        pinned: false,
        translationLanguage: null,
        lastReadMessageId: null,
        lastReadAt: null,
      } : null,
      members: (room.members ?? []).map((member: any) => ({
        userId: member.userId,
        role: member.role === 'captain' ? 'OWNER' : 'MEMBER',
        status: 'ACTIVE',
        user: member.user,
        displayUser: member.user,
      })),
      unreadCount: 0,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    }
  }

  private serializeMessage(message: any) {
    const metadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {}
    const payload = 'payload' in metadata ? metadata.payload : metadata
    return {
      id: message.id,
      roomId: message.threadId,
      senderId: message.senderId,
      sender: message.sender,
      type: String(message.kind ?? 'TEXT').toUpperCase(),
      text: message.body,
      payload,
      actions: [],
      clientMessageId: typeof metadata.clientMessageId === 'string' ? metadata.clientMessageId : null,
      createdAt: message.createdAt,
      updatedAt: message.createdAt,
    }
  }

  private parseLocationType(type: string) {
    if (!type.startsWith('location:')) return null
    const [, sourceType, ...rest] = type.split(':')
    return { sourceType, sourceId: rest.join(':') }
  }
}
