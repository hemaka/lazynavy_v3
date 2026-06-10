import { getJson } from '../../services/http'

export interface MarineConditionResponse {
  id: string
  latBucket: number
  lngBucket: number
  timeBucket: string
  source: string
  observedAt: string | null
  fetchedAt: string
  windSpeed: number | null
  windDirection: number | null
  windGust: number | null
  waveHeight: number | null
  waveDirection: number | null
  wavePeriod: number | null
}

export function getMarineCondition(lat: number, lng: number) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  })
  return getJson<MarineConditionResponse>(`/weather/marine-conditions?${params.toString()}`)
}
