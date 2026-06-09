import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { VesselsModule } from '../vessels/vessels.module'
import { SyncController } from './sync.controller'
import { SyncService } from './sync.service'

@Module({
  imports: [IdentityModule, VesselsModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
