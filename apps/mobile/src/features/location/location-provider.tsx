import * as Location from 'expo-location'
import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { AppState } from 'react-native'
import { getCaptainHud } from '../../modules/home/api'
import { useAuth } from '../../modules/identity/public'
import { LocationEngine, locationModeFor } from './location-engine'
import { getMarineCondition } from './marine-condition-api'
import { LocationStore } from './location-store'
import type { LocationContext, LocationPoint, LocationSample } from './types'

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn } = useAuth()
  const engine = useMemo(() => new LocationEngine(), [])
  const contextRef = useRef<LocationContext | null>(null)

  useEffect(() => {
    let cancelled = false
    let subscription: Location.LocationSubscription | null = null

    async function start() {
      if (!isLoggedIn || !user?.id || process.env.EXPO_OS === 'web') return

      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== Location.PermissionStatus.GRANTED || cancelled) return

      const store = await LocationStore.forUser(user.id)
      const latest = await store.latestPoint()
      if (latest) engine.markRecorded(latest)

      await refreshContext(user.id)
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5_000,
          distanceInterval: 5,
        },
        (location) => {
          void handleLocation(store, location)
        },
      )
    }

    async function refreshContext(userId: string) {
      try {
        const hud = await getCaptainHud()
        const voyageId = hud.activeVoyage?.status === 'active' ? hud.activeVoyage.id : null
        contextRef.current = {
          userId,
          vesselId: hud.currentVessel?.id ?? user?.currentVesselId ?? null,
          voyageId,
          mode: locationModeFor(voyageId),
          clientConfig: user?.clientConfig,
        }
      } catch {
        contextRef.current = {
          userId,
          vesselId: user?.currentVesselId ?? null,
          voyageId: null,
          mode: 'ashore',
          clientConfig: user?.clientConfig,
        }
      }
    }

    async function handleLocation(store: LocationStore, location: Location.LocationObject) {
      const context = contextRef.current
      if (!context) return

      const sample: LocationSample = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        accuracyM: location.coords.accuracy,
        speedMps: location.coords.speed,
        heading: location.coords.heading,
        altitude: location.coords.altitude,
        recordedAt: location.timestamp,
      }
      const decision = engine.decide(sample, context)

      if (decision.shouldRecord) {
        const point: LocationPoint = {
          ...sample,
          id: nextId(),
          userId: context.userId,
          vesselId: context.vesselId,
          voyageId: context.voyageId,
          mode: context.mode,
          presenceStatus: decision.presenceStatus,
          quality: decision.quality,
        }
        await store.insertPoint(point)
        engine.markRecorded(point)
      }

      if (decision.shouldRefreshMarineCondition) {
        try {
          await getMarineCondition(sample.lat, sample.lng)
          engine.markMarineConditionRefreshed(sample)
        } catch {
          // Location recording must continue even when network weather fetches fail.
        }
      }
    }

    void start()

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user?.id) void refreshContext(user.id)
    })

    return () => {
      cancelled = true
      appStateSubscription.remove()
      subscription?.remove()
    }
  }, [engine, isLoggedIn, user])

  return <>{children}</>
}

function nextId() {
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
