import { Module } from '@nestjs/common'
import { VesselsController } from './vessels.controller'
import { VesselsService } from './vessels.service'
import { IdentityModule } from '../identity/identity.module'

@Module({
  imports: [IdentityModule],
  controllers: [VesselsController],
  providers: [VesselsService],
  exports: [VesselsService],
})
export class VesselsModule {}
