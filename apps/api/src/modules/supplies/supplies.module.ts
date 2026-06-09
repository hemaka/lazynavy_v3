import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { VesselsModule } from '../vessels/vessels.module'
import { SuppliesController } from './supplies.controller'
import { SuppliesService } from './supplies.service'

@Module({
  imports: [IdentityModule, VesselsModule],
  controllers: [SuppliesController],
  providers: [SuppliesService],
})
export class SuppliesModule {}
