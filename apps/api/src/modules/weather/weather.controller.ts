import { BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { WeatherService } from './weather.service'

@Controller('weather')
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('marine')
  marine(@Query('lat') lat = '0', @Query('lng') lng = '0') {
    return this.weather.marine(Number(lat), Number(lng))
  }

  @Get('marine-conditions')
  marineCondition(
    @Query('lat') lat = '0',
    @Query('lng') lng = '0',
    @Query('at') at?: string,
    @Query('source') source?: string,
    @Query('refresh') refresh?: string,
  ) {
    return this.weather.getMarineCondition({
      lat: Number(lat),
      lng: Number(lng),
      at: parseDateQuery(at),
      source,
      refresh: refresh === 'true' || refresh === '1',
    })
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

function parseDateQuery(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('at must be an ISO date')
  return date
}
