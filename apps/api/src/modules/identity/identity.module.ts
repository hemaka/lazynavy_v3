import { Module } from '@nestjs/common'
import { IdentityController } from './identity.controller'
import { IdentityService } from './identity.service'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [IdentityController],
  providers: [IdentityService],
  exports: [IdentityService, AuthModule, UsersModule],
})
export class IdentityModule {}
