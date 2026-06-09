import { Controller, Get, Query } from '@nestjs/common'
import { HomeService } from './home.service'

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('captain-hud')
  captainHud(@Query('userId') userId?: string, @Query('empty') empty?: string) {
    return this.home.captainHud({ userId, empty: empty === '1' || empty === 'true' })
  }
}
