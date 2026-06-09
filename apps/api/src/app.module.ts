import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { EquipmentModule } from './modules/equipment/equipment.module'
import { HomeModule } from './modules/home/home.module'
import { IdentityModule } from './modules/identity/identity.module'
import { LogsModule } from './modules/logs/logs.module'
import { ManualsModule } from './modules/manuals/manuals.module'
import { MessagingModule } from './modules/messaging/messaging.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { PlacesModule } from './modules/places/places.module'
import { RewardsModule } from './modules/rewards/rewards.module'
import { SuppliesModule } from './modules/supplies/supplies.module'
import { ToolboxModule } from './modules/toolbox/toolbox.module'
import { VesselsModule } from './modules/vessels/vessels.module'
import { VoyagesModule } from './modules/voyages/voyages.module'

@Module({
  imports: [PrismaModule, HealthModule, IdentityModule, VesselsModule, VoyagesModule, RewardsModule, LogsModule, PlacesModule, SuppliesModule, EquipmentModule, ManualsModule, MessagingModule, NotificationsModule, ToolboxModule, HomeModule],
})
export class AppModule {}
