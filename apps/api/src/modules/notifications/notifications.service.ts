import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface NotificationInput {
  userId: string
  vesselId?: string | null
  sourceType: string
  sourceId: string
  type: string
  title: string
  body?: string
  severity?: string
  payload?: unknown
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, status?: string) {
    return this.prisma.notification.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async notify(input: NotificationInput) {
    return this.prisma.notification.upsert({
      where: {
        userId_sourceType_sourceId_type: {
          userId: input.userId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          type: input.type,
        },
      },
      create: {
        userId: input.userId,
        vesselId: input.vesselId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        type: input.type,
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'info',
        payload: input.payload as any,
      },
      update: {
        title: input.title,
        body: input.body,
        severity: input.severity ?? 'info',
        payload: input.payload as any,
        status: 'unread',
        readAt: null,
      },
    })
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { status: 'read', readAt: new Date() },
    })
  }
}
