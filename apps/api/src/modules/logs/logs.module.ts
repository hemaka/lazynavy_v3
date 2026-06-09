import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { RewardsModule } from '../rewards/rewards.module'
import { VesselsModule } from '../vessels/vessels.module'
import { LogsController } from './logs.controller'
import { LogsService } from './logs.service'

@Module({
  imports: [IdentityModule, RewardsModule, VesselsModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
