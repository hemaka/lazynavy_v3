import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { UsersModule } from '../users/users.module'
import { requireJwtSecret } from '../../../config/jwt-secret'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireJwtSecret(),
      // No expiresIn — tokens are revoked via User.tokenVersion bump instead
      // (changes password / "logout all devices"). See auth.service.signToken.
    }),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
