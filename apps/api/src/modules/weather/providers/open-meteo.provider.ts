import { BadGatewayException, Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import type { MarineConditionData, MarineConditionProvider, MarineConditionRequest } from './marine-condition-provider'

interface OpenMeteoHourly {
  time?: string[]
  temperature_2m?: Array<number | null>
  pressure_msl?: Array<number | null>
  relative_humidity_2m?: Array<number | null>
  visibility?: Array<number | null>
  precipitation?: Array<number | null>
  weather_code?: Array<number | null>
  wind_speed_10m?: Array<number | null>
  wind_direction_10m?: Array<number | null>
  wind_gusts_10m?: Array<number | null>
  wave_height?: Array<number | null>
  wave_direction?: Array<number | null>
  wave_period?: Array<number | null>
  wind_wave_height?: Array<number | null>
  wind_wave_direction?: Array<number | null>
  wind_wave_period?: Array<number | null>
  swell_wave_height?: Array<number | null>
  swell_wave_direction?: Array<number | null>
  swell_wave_period?: Array<number | null>
  sea_surface_temperature?: Array<number | null>
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly
  reason?: string
  error?: boolean
}

@Injectable()
export class OpenMeteoMarineConditionProvider implements MarineConditionProvider {
  readonly source = 'open_meteo'

  async fetchCondition(input: MarineConditionRequest): Promise<MarineConditionData> {
    const target = input.at ?? new Date()
    const [weather, marine] = await Promise.all([
      fetchOpenMeteoJson(this.weatherUrl(input.lat, input.lng, target)),
      fetchOpenMeteoJson(this.marineUrl(input.lat, input.lng, target)),
    ])

    const weatherPick = pickNearestHour(weather.hourly, target)
    const marinePick = pickNearestHour(marine.hourly, target)
    const observedAt = weatherPick.time ?? marinePick.time ?? target

    return {
      source: this.source,
      observedAt,
      temperature: weatherPick.value('temperature_2m'),
      pressure: weatherPick.value('pressure_msl'),
      humidity: weatherPick.value('relative_humidity_2m'),
      visibility: weatherPick.value('visibility'),
      precipitation: weatherPick.value('precipitation'),
      weatherCode: stringifyNumber(weatherPick.value('weather_code')),
      windSpeed: weatherPick.value('wind_speed_10m'),
      windDirection: weatherPick.value('wind_direction_10m'),
      windGust: weatherPick.value('wind_gusts_10m'),
      waveHeight: marinePick.value('wave_height'),
      waveDirection: marinePick.value('wave_direction'),
      wavePeriod: marinePick.value('wave_period'),
      windWaveHeight: marinePick.value('wind_wave_height'),
      windWaveDirection: marinePick.value('wind_wave_direction'),
      windWavePeriod: marinePick.value('wind_wave_period'),
      swellWaveHeight: marinePick.value('swell_wave_height'),
      swellWaveDirection: marinePick.value('swell_wave_direction'),
      swellWavePeriod: marinePick.value('swell_wave_period'),
      seaSurfaceTemperature: marinePick.value('sea_surface_temperature'),
      rawData: toJsonValue({ weather, marine }),
    }
  }

  private weatherUrl(lat: number, lng: number, at: Date) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: [
        'temperature_2m',
        'pressure_msl',
        'relative_humidity_2m',
        'visibility',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
      wind_speed_unit: 'ms',
      timezone: 'UTC',
      start_date: isoDate(at),
      end_date: isoDate(at),
    })

    const host = isOlderThanRecentForecastWindow(at) ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast'
    return `${host}?${params.toString()}`
  }

  private marineUrl(lat: number, lng: number, at: Date) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: [
        'wave_height',
        'wave_direction',
        'wave_period',
        'wind_wave_height',
        'wind_wave_direction',
        'wind_wave_period',
        'swell_wave_height',
        'swell_wave_direction',
        'swell_wave_period',
        'sea_surface_temperature',
      ].join(','),
      timezone: 'UTC',
      start_date: isoDate(at),
      end_date: isoDate(at),
    })

    return `https://marine-api.open-meteo.com/v1/marine?${params.toString()}`
  }
}

async function fetchOpenMeteoJson(url: string): Promise<OpenMeteoResponse> {
  const res = await fetch(url)
  const body = (await res.json()) as OpenMeteoResponse
  if (!res.ok || body.error) {
    throw new BadGatewayException(body.reason ?? `Open-Meteo request failed with ${res.status}`)
  }
  return body
}

function pickNearestHour(hourly: OpenMeteoHourly | undefined, target: Date) {
  const times = hourly?.time ?? []
  let bestIndex = 0
  let bestDelta = Number.POSITIVE_INFINITY

  for (let index = 0; index < times.length; index += 1) {
    const delta = Math.abs(Date.parse(`${times[index]}Z`) - target.getTime())
    if (delta < bestDelta) {
      bestDelta = delta
      bestIndex = index
    }
  }

  return {
    time: times[bestIndex] ? new Date(`${times[bestIndex]}Z`) : undefined,
    value(name: keyof OpenMeteoHourly) {
      const values = hourly?.[name]
      if (!Array.isArray(values)) return undefined
      const value = values[bestIndex]
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined
    },
  }
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function stringifyNumber(value: number | undefined) {
  return value === undefined ? undefined : String(value)
}

function isOlderThanRecentForecastWindow(date: Date) {
  const tenDaysMs = 10 * 24 * 60 * 60 * 1000
  return date.getTime() < Date.now() - tenDaysMs
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
