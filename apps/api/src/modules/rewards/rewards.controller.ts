import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
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

  @Get('ledger')
  ledger(@Query('userId') userId?: string, @Query('vesselId') vesselId?: string) {
    return this.rewards.listLedger({ userId, vesselId })
  }

  @Post('grant')
  grant(@Body() body: Parameters<RewardsService['grant']>[0]) {
    return this.rewards.grant(body)
  }

  @Patch('ledger/:id/settle-mileage')
  settleMileage(@Param('id') id: string, @Body() body: { approved: boolean; reviewNote?: string }) {
    return this.rewards.settleMileage(id, body)
  }
}
