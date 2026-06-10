import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { requireJwtSecret } from '../../../../config/jwt-secret'
import { UsersService } from '../../users/users.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // tokens have no exp; we revoke via tokenVersion
      secretOrKey: requireJwtSecret(),
    })
  }

  async validate(payload: { sub: string; nickname: string; ver?: number }) {
    // Tokens are revoked by bumping User.tokenVersion (e.g. on password change
    // or "logout all devices"). A token without `ver` is from before this
    // mechanism — treat as version 0 to keep the validation symmetric.
    const user = await this.users.findById(payload.sub)
    if (!user) throw new UnauthorizedException('用户不存在')
    if ((payload.ver ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('登录已失效,请重新登录')
    }
    return { id: payload.sub, nickname: payload.nickname }
  }
}
