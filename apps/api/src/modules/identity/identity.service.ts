import { BadRequestException, Injectable } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.service'

export interface CreateManagedAccountInput {
  nickname: string
  birthYear?: number
  guardianName?: string
}

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDevUser() {
    const existing = await this.prisma.user.findFirst({ where: { nickname: 'V3 Captain' } })
    if (existing) return existing
    return this.prisma.user.create({
      data: {
        nickname: 'V3 Captain',
        title: 'Harbor Rookie',
        level: 1,
        xp: 35,
        nextLevelXp: 120,
      },
    })
  }

  async getUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } })
  }

  listManagedAccounts(managerId: string) {
    return this.prisma.user.findMany({
      where: { managedById: managerId, accountKind: 'managed' },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createManagedAccount(managerId: string, input: CreateManagedAccountInput) {
    if (!input.nickname?.trim()) throw new BadRequestException('Nickname is required')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const internalEmail = `${randomBytes(6).toString('hex')}@managed.lazynavy.local`
      try {
        return await this.prisma.user.create({
          data: {
            nickname: input.nickname.trim(),
            accountKind: 'managed',
            internalEmail,
            managedById: managerId,
            birthYear: input.birthYear,
            guardianName: input.guardianName,
            title: 'Managed Crew',
          },
        })
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err
      }
    }
    throw new BadRequestException('Could not allocate managed account')
  }

  async bindManagedAccount(managerId: string, managedUserId: string, input: { internalEmail?: string; nickname?: string }) {
    const managed = await this.prisma.user.findFirst({ where: { id: managedUserId, managedById: managerId, accountKind: 'managed' } })
    if (!managed) throw new BadRequestException('Managed account not found')
    return this.prisma.user.update({
      where: { id: managedUserId },
      data: {
        ...(input.nickname?.trim() ? { nickname: input.nickname.trim() } : {}),
        ...(input.internalEmail?.trim() ? { internalEmail: input.internalEmail.trim() } : {}),
      },
    })
  }
}
