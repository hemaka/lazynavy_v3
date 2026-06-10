import type { ClientConfig } from '../../modules/identity/types'
import type { LocationContext, LocationDecision, LocationMode, LocationPoint, LocationQuality, LocationSample, PresenceStatus } from './types'

const DEFAULT_CONFIG: Required<ClientConfig> = {
  marineCondition: {
    refreshIntervalMinutes: 15,
    refreshDistanceKm: 5,
  },
  locationTracking: {
    voyage: {
      minIntervalSeconds: 5,
      minDistanceMeters: 15,
      maxIntervalSeconds: 60,
      maxAccuracyMeters: 50,
    },
    ashore: {
      minIntervalSeconds: 30,
      minDistanceMeters: 25,
      maxIntervalSeconds: 300,
      maxAccuracyMeters: 75,
    },
    vesselPresence: {
      leaveDistanceMeters: 80,
      returnDistanceMeters: 40,
      graceSeconds: 180,
    },
  },
}

export class LocationEngine {
  private lastRecorded: LocationPoint | null = null
  private lastMarineRefresh: LocationSample | null = null
  private currentPresence: PresenceStatus = 'unknown'
  private leaveCandidateSince: number | null = null

  decide(sample: LocationSample, context: LocationContext): LocationDecision {
    const config = mergeConfig(context.clientConfig)
    const modeConfig = context.mode === 'voyage' ? config.locationTracking.voyage : config.locationTracking.ashore
    const quality: LocationQuality = sample.accuracyM !== undefined && sample.accuracyM !== null && sample.accuracyM > modeConfig.maxAccuracyMeters
      ? 'low_accuracy'
      : 'good'

    if (quality === 'low_accuracy') {
      return {
        shouldRecord: false,
        shouldRefreshMarineCondition: false,
        presenceStatus: this.currentPresence,
        quality,
      }
    }

    const presenceStatus = this.detectPresence(sample, context, config)
    const shouldRecord = this.shouldRecord(sample, modeConfig.minIntervalSeconds, modeConfig.minDistanceMeters, modeConfig.maxIntervalSeconds)
    const shouldRefreshMarineCondition = context.mode === 'voyage' && this.shouldRefreshMarineCondition(sample, config)

    return {
      shouldRecord,
      shouldRefreshMarineCondition,
      presenceStatus,
      quality,
    }
  }

  markRecorded(point: LocationPoint) {
    this.lastRecorded = point
  }

  markMarineConditionRefreshed(sample: LocationSample) {
    this.lastMarineRefresh = sample
  }

  private shouldRecord(sample: LocationSample, minIntervalSeconds: number, minDistanceMeters: number, maxIntervalSeconds: number) {
    if (!this.lastRecorded) return true
    const elapsedMs = sample.recordedAt - this.lastRecorded.recordedAt
    const distanceMeters = distanceBetweenMeters(sample, this.lastRecorded)
    if (elapsedMs < minIntervalSeconds * 1000) return false
    return distanceMeters >= minDistanceMeters || elapsedMs >= maxIntervalSeconds * 1000
  }

  private shouldRefreshMarineCondition(sample: LocationSample, config: Required<ClientConfig>) {
    if (!this.lastMarineRefresh) return true
    const elapsedMs = sample.recordedAt - this.lastMarineRefresh.recordedAt
    const distanceKm = distanceBetweenMeters(sample, this.lastMarineRefresh) / 1000
    return elapsedMs >= config.marineCondition.refreshIntervalMinutes * 60 * 1000 || distanceKm >= config.marineCondition.refreshDistanceKm
  }

  private detectPresence(sample: LocationSample, context: LocationContext, config: Required<ClientConfig>): PresenceStatus {
    if (!context.vesselLocation) {
      this.currentPresence = context.mode === 'ashore' ? 'ashore' : 'unknown'
      return this.currentPresence
    }

    const distanceMeters = distanceBetweenMeters(sample, context.vesselLocation)
    const presenceConfig = config.locationTracking.vesselPresence

    if (distanceMeters <= presenceConfig.returnDistanceMeters) {
      this.leaveCandidateSince = null
      this.currentPresence = 'onboard'
      return this.currentPresence
    }

    if (distanceMeters < presenceConfig.leaveDistanceMeters) return this.currentPresence

    if (!this.leaveCandidateSince) {
      this.leaveCandidateSince = sample.recordedAt
      return this.currentPresence
    }

    if (sample.recordedAt - this.leaveCandidateSince >= presenceConfig.graceSeconds * 1000) {
      this.currentPresence = 'ashore'
    }

    return this.currentPresence
  }
}

export function distanceBetweenMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusM = 6_371_000
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const deltaLat = toRadians(b.lat - a.lat)
  const deltaLng = toRadians(b.lng - a.lng)
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function locationModeFor(voyageId?: string | null): LocationMode {
  return voyageId ? 'voyage' : 'ashore'
}

function toRadians(value: number) {
  return value * Math.PI / 180
}

function mergeConfig(config?: ClientConfig | null): Required<ClientConfig> {
  return {
    marineCondition: {
      ...DEFAULT_CONFIG.marineCondition,
      ...config?.marineCondition,
    },
    locationTracking: {
      voyage: {
        ...DEFAULT_CONFIG.locationTracking.voyage,
        ...config?.locationTracking?.voyage,
      },
      ashore: {
        ...DEFAULT_CONFIG.locationTracking.ashore,
        ...config?.locationTracking?.ashore,
      },
      vesselPresence: {
        ...DEFAULT_CONFIG.locationTracking.vesselPresence,
        ...config?.locationTracking?.vesselPresence,
      },
    },
  }
}
