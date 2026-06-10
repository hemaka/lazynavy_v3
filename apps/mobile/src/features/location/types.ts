import type { ClientConfig } from '../../modules/identity/types'

export type LocationMode = 'voyage' | 'ashore'
export type PresenceStatus = 'onboard' | 'ashore' | 'unknown'
export type LocationQuality = 'good' | 'low_accuracy'

export interface LocationSample {
  lat: number
  lng: number
  accuracyM?: number | null
  speedMps?: number | null
  heading?: number | null
  altitude?: number | null
  recordedAt: number
}

export interface LocationPoint extends LocationSample {
  id: string
  userId: string
  vesselId?: string | null
  voyageId?: string | null
  mode: LocationMode
  presenceStatus: PresenceStatus
  quality: LocationQuality
}

export interface LocationContext {
  userId: string
  vesselId?: string | null
  voyageId?: string | null
  mode: LocationMode
  vesselLocation?: { lat: number; lng: number } | null
  clientConfig?: ClientConfig | null
}

export interface LocationDecision {
  shouldRecord: boolean
  shouldRefreshMarineCondition: boolean
  presenceStatus: PresenceStatus
  quality: LocationQuality
}
