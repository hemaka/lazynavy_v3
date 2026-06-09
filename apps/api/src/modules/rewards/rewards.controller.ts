import { Controller, Get } from '@nestjs/common'
import { RewardsService } from './rewards.service'

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  @Get('rules')
  rules() {
    return this.rewards.listRules()
  }

  @Get('categories')
  categories() {
    return this.rewards.categories()
  }
}
