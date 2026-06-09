import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { LogsModule } from '../logs/logs.module'
import { RewardsModule } from '../rewards/rewards.module'
import { VesselsModule } from '../vessels/vessels.module'
import { PlacesController } from './places.controller'
import { PlacesService } from './places.service'

@Module({
  imports: [IdentityModule, LogsModule, RewardsModule, VesselsModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
