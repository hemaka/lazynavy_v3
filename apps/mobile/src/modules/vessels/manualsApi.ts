import { getJson, postJson } from '../../services/http'

export interface ManualDocument {
  id: string
  title: string
  type: string
  contentText?: string | null
  offlinePriority: string
}

export function listVesselManuals(vesselId: string) {
  return getJson<ManualDocument[]>(`/vessels/${vesselId}/manuals`)
}

export function createVesselManual(vesselId: string, type: 'vessel_manual' | 'certificate' | 'insurance' = 'vessel_manual') {
  return postJson<ManualDocument>('/manuals', {
    vesselId,
    type,
    title: type === 'vessel_manual' ? 'Boat Manual' : type === 'certificate' ? 'Registration Certificate' : 'Insurance Policy',
    contentText: 'Stored for offline boat access.',
    offlinePriority: type === 'vessel_manual' ? 'high' : 'normal',
  })
}

export function searchManuals(query: string) {
  return getJson<ManualDocument[]>(`/manuals/search?q=${encodeURIComponent(query)}`)
}
