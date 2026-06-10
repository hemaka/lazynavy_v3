import { Controller, Get, Patch, Body, UseGuards, Request, Param } from '@nestjs/common'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UpdateProfileDto } from './dto/update-profile.dto'
import { SetActiveBadgeDto } from './dto/set-active-badge.dto'

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.users.findById(req.user.id)
    return this.users.safeUser(user)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/badges')
  async getMyBadges(@Request() req: any) {
    return this.users.listAvailableBadges(req.user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/badge')
  async setMyBadge(@Request() req: any, @Body() dto: SetActiveBadgeDto) {
    return this.users.setActiveBadge(req.user.id, dto.badgeId ?? null)
  }

  @Get(':id')
  async getPublicProfile(@Param('id') id: string) {
    return this.users.getPublicProfile(id)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.id, dto)
  }

}
