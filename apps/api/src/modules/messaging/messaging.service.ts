import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

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
}
