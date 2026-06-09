import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { RewardsModule } from '../rewards/rewards.module'
import { VesselsModule } from '../vessels/vessels.module'
import { VoyagesController } from './voyages.controller'
import { VoyagesService } from './voyages.service'

@Module({
  imports: [IdentityModule, NotificationsModule, RewardsModule, VesselsModule],
  controllers: [VoyagesController],
  providers: [VoyagesService],
  exports: [VoyagesService],
})
export class VoyagesModule {}
