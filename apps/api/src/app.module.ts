import { Module } from '@nestjs/common'
import { HealthModule } from './health/health.module'
import { PrismaModule } from './prisma/prisma.module'
import { HomeModule } from './modules/home/home.module'
import { IdentityModule } from './modules/identity/identity.module'
import { RewardsModule } from './modules/rewards/rewards.module'
import { VesselsModule } from './modules/vessels/vessels.module'
import { VoyagesModule } from './modules/voyages/voyages.module'

@Module({
  imports: [PrismaModule, HealthModule, IdentityModule, VesselsModule, VoyagesModule, RewardsModule, HomeModule],
})
export class AppModule {}
