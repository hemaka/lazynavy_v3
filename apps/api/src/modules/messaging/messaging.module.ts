import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { requireJwtSecret } from '../../config/jwt-secret'
import { IdentityModule } from '../identity/identity.module'
import { UsersModule } from '../identity/users/users.module'
import { ChatController } from './chat.controller'
import { ChatGateway } from './chat.gateway'
import { ChatRealtimeService } from './chat-realtime.service'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'

@Module({
  imports: [
    IdentityModule,
    UsersModule,
    JwtModule.register({
      secret: requireJwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [MessagingController, ChatController],
  providers: [MessagingService, ChatRealtimeService, ChatGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
