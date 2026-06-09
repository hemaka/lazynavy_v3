import { Controller, Get, Query } from '@nestjs/common'
import { WeatherService } from './weather.service'

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('marine')
  marine(@Query('lat') lat = '0', @Query('lng') lng = '0') {
    return this.weather.marine(Number(lat), Number(lng))
  }

  @Get('crew-context')
  crewContext(@Query('phoneLat') phoneLat?: string, @Query('phoneLng') phoneLng?: string, @Query('vesselStatus') vesselStatus?: string) {
    return this.weather.crewContext({
      phoneLat: phoneLat ? Number(phoneLat) : undefined,
      phoneLng: phoneLng ? Number(phoneLng) : undefined,
      vesselStatus,
    })
  }
}
