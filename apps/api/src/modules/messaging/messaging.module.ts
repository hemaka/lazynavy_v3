import { Module } from '@nestjs/common'
import { IdentityModule } from '../identity/identity.module'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'

@Module({
  imports: [IdentityModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
