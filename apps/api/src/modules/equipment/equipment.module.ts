import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { RewardsModule } from '../rewards/rewards.module'
import { VesselsModule } from '../vessels/vessels.module'
import { EquipmentController } from './equipment.controller'
import { EquipmentService } from './equipment.service'

@Module({
  imports: [IdentityModule, NotificationsModule, RewardsModule, VesselsModule],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
