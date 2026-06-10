import type { Prisma } from '@prisma/client'

export interface MarineConditionRequest {
  lat: number
  lng: number
  at?: Date
}

export interface MarineConditionData {
  source: string
  observedAt?: Date
  temperature?: number
  pressure?: number
  humidity?: number
  visibility?: number
  precipitation?: number
  weatherCode?: string
  windSpeed?: number
  windDirection?: number
  windGust?: number
  waveHeight?: number
  waveDirection?: number
  wavePeriod?: number
  windWaveHeight?: number
  windWaveDirection?: number
  windWavePeriod?: number
  swellWaveHeight?: number
  swellWaveDirection?: number
  swellWavePeriod?: number
  seaSurfaceTemperature?: number
  rawData: Prisma.InputJsonValue
}

export interface MarineConditionProvider {
  readonly source: string
  fetchCondition(input: MarineConditionRequest): Promise<MarineConditionData>
}
