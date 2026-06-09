import { Controller, Get, Query } from '@nestjs/common'
import { ToolboxService } from './toolbox.service'

@Controller('toolbox')
export class ToolboxController {
  constructor(private readonly toolbox: ToolboxService) {}

  @Get('units')
  units(@Query('value') value = '0', @Query('from') from = 'nm', @Query('to') to = 'km') {
    return this.toolbox.convertUnit(Number(value), from, to)
  }

  @Get('currency')
  currency(@Query('amount') amount = '0', @Query('from') from = 'USD', @Query('to') to = 'EUR') {
    return this.toolbox.convertCurrency(Number(amount), from, to)
  }

  @Get('region')
  region(@Query('code') code = 'US') {
    return this.toolbox.region(code)
  }
}
