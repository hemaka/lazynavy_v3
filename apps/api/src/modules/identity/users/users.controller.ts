import { Controller, Get, Patch, Body, UseGuards, Request, Param } from '@nestjs/common'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UpdateProfileDto } from './dto/update-profile.dto'

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.users.findById(req.user.id)
    return this.users.safeUser(user)
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
