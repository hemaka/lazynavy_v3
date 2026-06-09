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
  checklistItems?: VoyageChecklistItem[]
}

export interface VoyageChecklistItem {
  id: string
  title: string
  status: string
  completedById?: string | null
  completedAt?: string | null
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

export function listVoyageChecklist(voyageId: string) {
  return getJson<VoyageChecklistItem[]>(`/voyages/${voyageId}/checklist`)
}

export function completeVoyageChecklistItem(voyageId: string, itemId: string) {
  return patchJson<VoyageChecklistItem>(`/voyages/${voyageId}/checklist/${itemId}/complete`, {})
}

export function completeVoyage(voyageId: string) {
  return patchJson<VoyageRecord>(`/voyages/${voyageId}/complete`, {})
}
