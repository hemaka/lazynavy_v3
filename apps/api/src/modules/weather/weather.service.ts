import { BadRequestException, Injectable } from '@nestjs/common'

@Injectable()
export class WeatherService {
  marine(lat: number, lng: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new BadRequestException('lat/lng are required')
    const nearShore = Math.abs(lat) <= 70 && Math.abs(lng) <= 180
    return {
      lat,
      lng,
      summary: nearShore ? 'Fair coastal conditions' : 'Conditions unavailable',
      windKnots: 12,
      gustKnots: 18,
      waveFt: 2.4,
      visibilityNm: 8,
      advisory: 'Check local marine forecast before departure.',
      source: 'static-marine-default',
    }
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
