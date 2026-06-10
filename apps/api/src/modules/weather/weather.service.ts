import { BadRequestException, Injectable } from '@nestjs/common'
import type { MarineCondition } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { OpenMeteoMarineConditionProvider } from './providers/open-meteo.provider'
import type { MarineConditionProvider } from './providers/marine-condition-provider'

export interface GetMarineConditionInput {
  lat: number
  lng: number
  at?: Date
  source?: string
  refresh?: boolean
}

@Injectable()
export class WeatherService {
  private readonly providers: Map<string, MarineConditionProvider>

  constructor(
    private readonly prisma: PrismaService,
    openMeteo: OpenMeteoMarineConditionProvider,
  ) {
    this.providers = new Map([[openMeteo.source, openMeteo]])
  }

  async marine(lat: number, lng: number) {
    const condition = await this.getMarineCondition({ lat, lng })
    const windKnots = condition.windSpeed === null ? undefined : condition.windSpeed * 1.943844
    const gustKnots = condition.windGust === null ? undefined : condition.windGust * 1.943844
    const waveFt = condition.waveHeight === null ? undefined : condition.waveHeight * 3.28084
    const visibilityNm = condition.visibility === null ? undefined : condition.visibility / 1852

    return {
      lat,
      lng,
      summary: summaryFor(condition),
      windKnots: roundMaybe(windKnots, 1),
      gustKnots: roundMaybe(gustKnots, 1),
      waveFt: roundMaybe(waveFt, 1),
      visibilityNm: roundMaybe(visibilityNm, 1),
      advisory: 'Check local marine forecast before departure.',
      source: condition.source,
      condition,
    }
  }

  async getMarineCondition(input: GetMarineConditionInput) {
    validateLatLng(input.lat, input.lng)
    const at = input.at ?? new Date()
    const latBucket = toCoordBucket(input.lat)
    const lngBucket = toCoordBucket(input.lng)
    const timeBucket = toTimeBucket(at)
    const source = input.source ?? process.env.MARINE_CONDITION_SOURCE ?? 'open_meteo'
    const provider = this.providers.get(source)
    if (!provider) throw new BadRequestException(`Unsupported marine condition source: ${source}`)

    if (!input.refresh) {
      const existing = await this.prisma.marineCondition.findUnique({
        where: { latBucket_lngBucket_timeBucket_source: { latBucket, lngBucket, timeBucket, source } },
      })
      if (existing) return toMarineConditionDto(existing)
    }

    const fetched = await provider.fetchCondition({ lat: input.lat, lng: input.lng, at })
    const condition = await this.prisma.marineCondition.upsert({
      where: { latBucket_lngBucket_timeBucket_source: { latBucket, lngBucket, timeBucket, source } },
      create: {
        latBucket,
        lngBucket,
        timeBucket,
        source,
        observedAt: fetched.observedAt,
        fetchedAt: new Date(),
        temperature: fetched.temperature,
        pressure: fetched.pressure,
        humidity: fetched.humidity,
        visibility: fetched.visibility,
        precipitation: fetched.precipitation,
        weatherCode: fetched.weatherCode,
        windSpeed: fetched.windSpeed,
        windDirection: fetched.windDirection,
        windGust: fetched.windGust,
        waveHeight: fetched.waveHeight,
        waveDirection: fetched.waveDirection,
        wavePeriod: fetched.wavePeriod,
        windWaveHeight: fetched.windWaveHeight,
        windWaveDirection: fetched.windWaveDirection,
        windWavePeriod: fetched.windWavePeriod,
        swellWaveHeight: fetched.swellWaveHeight,
        swellWaveDirection: fetched.swellWaveDirection,
        swellWavePeriod: fetched.swellWavePeriod,
        seaSurfaceTemperature: fetched.seaSurfaceTemperature,
        rawData: fetched.rawData,
      },
      update: {
        observedAt: fetched.observedAt,
        fetchedAt: new Date(),
        temperature: fetched.temperature,
        pressure: fetched.pressure,
        humidity: fetched.humidity,
        visibility: fetched.visibility,
        precipitation: fetched.precipitation,
        weatherCode: fetched.weatherCode,
        windSpeed: fetched.windSpeed,
        windDirection: fetched.windDirection,
        windGust: fetched.windGust,
        waveHeight: fetched.waveHeight,
        waveDirection: fetched.waveDirection,
        wavePeriod: fetched.wavePeriod,
        windWaveHeight: fetched.windWaveHeight,
        windWaveDirection: fetched.windWaveDirection,
        windWavePeriod: fetched.windWavePeriod,
        swellWaveHeight: fetched.swellWaveHeight,
        swellWaveDirection: fetched.swellWaveDirection,
        swellWavePeriod: fetched.swellWavePeriod,
        seaSurfaceTemperature: fetched.seaSurfaceTemperature,
        rawData: fetched.rawData,
      },
    })

    return toMarineConditionDto(condition)
  }

  crewContext(input: { phoneLat?: number; phoneLng?: number; vesselStatus?: string }) {
    const onLandLikely = input.vesselStatus === 'docked'
    return {
      suggestedCrewStatus: onLandLikely ? 'ashore' : 'onboard',
      confidence: onLandLikely ? 0.7 : 0.45,
      reminder: onLandLikely ? 'Boat is docked; confirm crew status if boarding.' : 'Confirm onboard crew before departure.',
    }
  }
}

function validateLatLng(lat: number, lng: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('lat/lng are required')
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new BadRequestException('lat/lng are out of range')
}

function toCoordBucket(value: number) {
  return Math.round(value * 100) / 100
}

function toTimeBucket(date: Date) {
  const bucketMs = 15 * 60 * 1000
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs)
}

function toMarineConditionDto(condition: MarineCondition) {
  return {
    id: condition.id,
    latBucket: condition.latBucket,
    lngBucket: condition.lngBucket,
    timeBucket: condition.timeBucket.toISOString(),
    source: condition.source,
    observedAt: condition.observedAt?.toISOString() ?? null,
    fetchedAt: condition.fetchedAt.toISOString(),
    temperature: condition.temperature,
    pressure: condition.pressure,
    humidity: condition.humidity,
    visibility: condition.visibility,
    precipitation: condition.precipitation,
    weatherCode: condition.weatherCode,
    windSpeed: condition.windSpeed,
    windDirection: condition.windDirection,
    windGust: condition.windGust,
    waveHeight: condition.waveHeight,
    waveDirection: condition.waveDirection,
    wavePeriod: condition.wavePeriod,
    windWaveHeight: condition.windWaveHeight,
    windWaveDirection: condition.windWaveDirection,
    windWavePeriod: condition.windWavePeriod,
    swellWaveHeight: condition.swellWaveHeight,
    swellWaveDirection: condition.swellWaveDirection,
    swellWavePeriod: condition.swellWavePeriod,
    seaSurfaceTemperature: condition.seaSurfaceTemperature,
  }
}

function summaryFor(condition: Awaited<ReturnType<WeatherService['getMarineCondition']>>) {
  const wave = condition.waveHeight
  const wind = condition.windSpeed
  if (wave !== null && wave >= 2.5) return 'Rough marine conditions'
  if (wind !== null && wind >= 10.8) return 'Fresh winds expected'
  if (wave !== null || wind !== null) return 'Marine conditions available'
  return 'Conditions unavailable'
}

function roundMaybe(value: number | undefined, digits: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
