import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class VoyagesService {
  constructor(private readonly prisma: PrismaService) {}

  activeForUser(userId: string, vesselId?: string | null) {
    return this.prisma.voyage.findFirst({
      where: {
        ownerId: userId,
        ...(vesselId ? { vesselId } : {}),
        status: { in: ['active', 'planned'] },
      },
      orderBy: [{ status: 'asc' }, { plannedStartAt: 'asc' }],
    })
  }
}
