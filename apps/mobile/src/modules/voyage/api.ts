import { getJson, patchJson, postJson } from '../../services/http'

export interface VoyageRecord {
  id: string
  vesselId: string
  name: string
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  departureName?: string | null
  destinationName?: string | null
  needsConfirmation: boolean
  participants?: Array<{ id: string; userId: string; role: string; status: string }>
}

export function listVoyages() {
  return getJson<VoyageRecord[]>('/voyages')
}

export function createVoyagePlan(vesselId: string) {
  return postJson<VoyageRecord>('/voyages', {
    vesselId,
    name: 'Harbor Practice Run',
    departureName: 'Home Marina',
    destinationName: 'Blue Point',
    needsConfirmation: false,
  })
}

export function startVoyage(voyageId: string) {
  return patchJson<VoyageRecord>(`/voyages/${voyageId}/start`, {})
}

export function completeVoyage(voyageId: string) {
  return patchJson<VoyageRecord>(`/voyages/${voyageId}/complete`, {})
}
