import { Injectable } from '@nestjs/common'
import { XP_SOURCE_CATEGORIES } from '@lazynavy-v3/config'
import { PrismaService } from '../../prisma/prisma.service'

const DEFAULT_REWARD_RULES = [
  { key: 'voyage.completed', sourceCategory: 'captain', xpAmount: 80, mileageAmount: 20, mileageRequiresReview: true },
  { key: 'log.created', sourceCategory: 'logger', xpAmount: 12, mileageAmount: 0, mileageRequiresReview: false, dailyCap: 60 },
  { key: 'discovery.unlocked', sourceCategory: 'explorer', xpAmount: 45, mileageAmount: 10, mileageRequiresReview: true },
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
}
