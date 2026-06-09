import { Module } from '@nestjs/common'
import { EquipmentModule } from '../equipment/equipment.module'
import { IdentityModule } from '../identity/identity.module'
import { VesselsModule } from '../vessels/vessels.module'
import { ManualsController } from './manuals.controller'
import { ManualsService } from './manuals.service'

@Module({
  imports: [IdentityModule, VesselsModule, EquipmentModule],
  controllers: [ManualsController],
  providers: [ManualsService],
  exports: [ManualsService],
})
export class ManualsModule {}
