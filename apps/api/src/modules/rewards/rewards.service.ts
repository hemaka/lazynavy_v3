import { BadRequestException, Injectable } from '@nestjs/common'
import { XP_SOURCE_CATEGORIES } from '@lazynavy-v3/config'
import { PrismaService } from '../../prisma/prisma.service'

const DEFAULT_REWARD_RULES = [
  { key: 'voyage.completed', sourceCategory: 'captain', xpAmount: 80, mileageAmount: 20, mileageRequiresReview: true },
  { key: 'log.created', sourceCategory: 'logger', xpAmount: 12, mileageAmount: 0, mileageRequiresReview: false, dailyCap: 60 },
  { key: 'discovery.unlocked', sourceCategory: 'explorer', xpAmount: 45, mileageAmount: 10, mileageRequiresReview: true },
  { key: 'boat.setup.completed', sourceCategory: 'captain', xpAmount: 40, mileageAmount: 0, mileageRequiresReview: false },
  { key: 'maintenance.completed', sourceCategory: 'engineer', xpAmount: 30, mileageAmount: 0, mileageRequiresReview: false },
] as const

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults() {
    for (const rule of DEFAULT_REWARD_RULES) {
      await this.prisma.rewardRule.upsert({
        where: { key: rule.key },
        create: rule,
        update: {},
      })
    }
  }

  async listRules() {
    await this.ensureDefaults()
    return this.prisma.rewardRule.findMany({ orderBy: { key: 'asc' } })
  }

  categories() {
    return XP_SOURCE_CATEGORIES
  }

  async grant(input: {
    ruleKey: string
    userId?: string | null
    vesselId?: string | null
    sourceType: string
    sourceId: string
    anomalyScore?: number
    reviewNote?: string
  }) {
    await this.ensureDefaults()
    const rule = await this.prisma.rewardRule.findUnique({ where: { key: input.ruleKey } })
    if (!rule || !rule.enabled) throw new BadRequestException('Reward rule not found or disabled')
    if (!input.userId && !input.vesselId) throw new BadRequestException('Reward target is required')

    const idempotencyKey = [input.ruleKey, input.sourceType, input.sourceId, input.userId ?? 'none', input.vesselId ?? 'none'].join(':')
    const existing = await this.prisma.rewardLedger.findUnique({ where: { idempotencyKey } })
    if (existing) return existing

    const xpAmount = input.userId && rule.dailyCap ? await this.applyDailyCap(input.userId, rule.key, rule.xpAmount, rule.dailyCap) : rule.xpAmount
    const mileageStatus = rule.mileageAmount > 0 && rule.mileageRequiresReview ? 'pending' : 'approved'

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.rewardLedger.create({
        data: {
          idempotencyKey,
          userId: input.userId ?? null,
          vesselId: input.vesselId ?? null,
          ruleKey: rule.key,
          sourceCategory: rule.sourceCategory,
          xpAmount,
          mileageAmount: rule.mileageAmount,
          mileageStatus,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          anomalyScore: input.anomalyScore,
          reviewNote: input.reviewNote,
          settledAt: mileageStatus === 'approved' ? new Date() : null,
        },
      })

      if (input.userId && xpAmount > 0) {
        const user = await tx.user.findUnique({ where: { id: input.userId } })
        if (user) {
          const leveled = nextProgress(user.xp + xpAmount, user.level, user.nextLevelXp)
          await tx.user.update({
            where: { id: input.userId },
            data: {
              xp: leveled.xp,
              level: leveled.level,
              nextLevelXp: leveled.nextLevelXp,
              ...(rule.mileageAmount > 0
                ? mileageStatus === 'approved'
                  ? { availableMileagePoints: { increment: rule.mileageAmount } }
                  : { pendingMileagePoints: { increment: rule.mileageAmount } }
                : {}),
            },
          })
        }
      }

      if (input.vesselId && xpAmount > 0) {
        const vessel = await tx.vessel.findUnique({ where: { id: input.vesselId } })
        if (vessel) {
          const leveled = nextProgress(vessel.xp + xpAmount, vessel.level, vessel.nextLevelXp)
          await tx.vessel.update({
            where: { id: input.vesselId },
            data: {
              xp: leveled.xp,
              level: leveled.level,
              nextLevelXp: leveled.nextLevelXp,
              ...(rule.mileageAmount > 0
                ? mileageStatus === 'approved'
                  ? { availableMileagePoints: { increment: rule.mileageAmount } }
                  : { pendingMileagePoints: { increment: rule.mileageAmount } }
                : {}),
            },
          })
        }
      }

      return ledger
    })
  }

  async settleMileage(ledgerId: string, input: { approved: boolean; reviewNote?: string }) {
    const ledger = await this.prisma.rewardLedger.findUnique({ where: { id: ledgerId } })
    if (!ledger) throw new BadRequestException('Reward ledger not found')
    if (ledger.mileageStatus !== 'pending') return ledger

    return this.prisma.$transaction(async (tx) => {
      const nextStatus = input.approved ? 'approved' : 'rejected'
      const updated = await tx.rewardLedger.update({
        where: { id: ledger.id },
        data: {
          mileageStatus: nextStatus,
          reviewNote: input.reviewNote,
          settledAt: new Date(),
        },
      })
      if (ledger.mileageAmount > 0) {
        if (ledger.userId) {
          await tx.user.update({
            where: { id: ledger.userId },
            data: {
              pendingMileagePoints: { decrement: ledger.mileageAmount },
              ...(input.approved ? { availableMileagePoints: { increment: ledger.mileageAmount } } : {}),
            },
          })
        }
        if (ledger.vesselId) {
          await tx.vessel.update({
            where: { id: ledger.vesselId },
            data: {
              pendingMileagePoints: { decrement: ledger.mileageAmount },
              ...(input.approved ? { availableMileagePoints: { increment: ledger.mileageAmount } } : {}),
            },
          })
        }
      }
      return updated
    })
  }

  listLedger(filters: { userId?: string; vesselId?: string } = {}) {
    return this.prisma.rewardLedger.findMany({
      where: {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.vesselId ? { vesselId: filters.vesselId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  private async applyDailyCap(userId: string, ruleKey: string, amount: number, dailyCap: number) {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    const aggregate = await this.prisma.rewardLedger.aggregate({
      where: { userId, ruleKey, createdAt: { gte: since } },
      _sum: { xpAmount: true },
    })
    const used = aggregate._sum.xpAmount ?? 0
    return Math.max(0, Math.min(amount, dailyCap - used))
  }
}

function nextProgress(totalXp: number, level: number, nextLevelXp: number) {
  let xp = totalXp
  let currentLevel = level
  let threshold = nextLevelXp
  while (xp >= threshold) {
    xp -= threshold
    currentLevel += 1
    threshold = Math.round(threshold * 1.35 + 30)
  }
  return { xp, level: currentLevel, nextLevelXp: threshold }
}
