import { Module } from '@nestjs/common'
import { VesselsController } from './vessels.controller'
import { VesselsService } from './vessels.service'
import { IdentityModule } from '../identity/identity.module'
import { RewardsModule } from '../rewards/rewards.module'

@Module({
  imports: [IdentityModule, RewardsModule],
  controllers: [VesselsController],
  providers: [VesselsService],
  exports: [VesselsService],
})
export class VesselsModule {}
