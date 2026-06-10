import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { UsersService } from '../users/users.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('邮箱或手机号至少填一个')
    }

    if (dto.email && await this.users.findByEmail(dto.email)) {
      throw new BadRequestException('该邮箱已注册')
    }

    if (dto.phone && await this.users.findByPhone(dto.phone)) {
      throw new BadRequestException('该手机号已注册')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = await this.users.create({
      nickname: dto.nickname,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
    })

    return { token: this.signToken(user), user: this.users.safeUser(user) }
  }

  async login(dto: LoginDto) {
    const user = dto.identifier.includes('@')
      ? await this.users.findByEmail(dto.identifier)
      : await this.users.findByPhone(dto.identifier)

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('账号或密码错误')
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('账号或密码错误')

    return { token: this.signToken(user), user: this.users.safeUser(user) }
  }

  private signToken(user: { id: string; nickname: string; tokenVersion: number }) {
    // No expiresIn — token revocation goes through User.tokenVersion instead.
    // See JwtStrategy.validate. This matches the "offline-friendly" requirement:
    // a device can be offline arbitrarily long without losing its session.
    return this.jwt.sign({ sub: user.id, nickname: user.nickname, ver: user.tokenVersion })
  }
}
