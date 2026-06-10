import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OpenMeteoMarineConditionProvider } from './providers/open-meteo.provider'
import { WeatherController } from './weather.controller'
import { WeatherService } from './weather.service'

@Module({
  imports: [PrismaModule],
  controllers: [WeatherController],
  providers: [OpenMeteoMarineConditionProvider, WeatherService],
})
export class WeatherModule {}
