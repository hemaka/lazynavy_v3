import { getJson, patchJson, postJson } from '../../services/http'

export interface PoiRecord {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  confirmCount: number
}

export interface DiscoveryPointRecord {
  id: string
  name: string
  type: string
  lat: number
  lng: number
  radiusM: number
}

export function listPois() {
  return getJson<PoiRecord[]>('/pois')
}

export function createPoi() {
  return postJson<PoiRecord>('/pois', {
    name: 'Harbor Light',
    type: 'lighthouse',
    scope: 'public',
    lat: 37.8001,
    lng: -122.4101,
    description: 'A visible harbor landmark.',
  })
}

export function confirmPoi(id: string) {
  return patchJson(`/pois/${id}/confirm`, {})
}

export function listDiscoveryPoints() {
  return getJson<DiscoveryPointRecord[]>('/discovery-points')
}

export function createDiscoveryPoint(poiId?: string) {
  return postJson<DiscoveryPointRecord>('/discovery-points', {
    poiId,
    name: 'Harbor Light Discovery',
    type: 'lighthouse',
    lat: 37.8001,
    lng: -122.4101,
    radiusM: 300,
    description: 'Demo discovery point near the harbor.',
  })
}

export function unlockDiscovery(pointId: string, voyageId: string) {
  return postJson('/discovery-unlocks', {
    pointId,
    voyageId,
    photoUrl: 'https://example.com/v3-discovery.jpg',
    lat: 37.80011,
    lng: -122.41009,
  })
}
