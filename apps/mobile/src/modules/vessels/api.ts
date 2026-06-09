import { getJson, patchJson, postJson } from '../../services/http'

export interface VesselSetupStep {
  id: string
  key: string
  title: string
  status: string
}

export interface VesselInvitation {
  id: string
  code: string
  role: string
  status: string
  expiresAt?: string | null
}

export function listVesselRoles() {
  return getJson<Array<{ key: string; name: string; permissions: string[] }>>('/vessels/roles')
}

export function updateVessel(vesselId: string, body: { name?: string; homePort?: string; sceneTemplate?: string }) {
  return patchJson(`/vessels/${vesselId}`, body)
}

export function listSetupSteps(vesselId: string) {
  return getJson<VesselSetupStep[]>(`/vessels/${vesselId}/setup-steps`)
}

export function completeSetupStep(vesselId: string, key: string) {
  return patchJson<VesselSetupStep>(`/vessels/${vesselId}/setup-steps/${key}/complete`, {})
}

export function skipSetupStep(vesselId: string, key: string) {
  return patchJson<VesselSetupStep>(`/vessels/${vesselId}/setup-steps/${key}/skip`, {})
}

export function createInvitation(vesselId: string, role = 'crew') {
  return postJson<VesselInvitation>(`/vessels/${vesselId}/invitations`, { role, expiresInDays: 14 })
}

export function listInvitations(vesselId: string) {
  return getJson<VesselInvitation[]>(`/vessels/${vesselId}/invitations`)
}

export function joinVessel(code: string) {
  return postJson<{ vessel: { id: string; name: string }; membership: { role: string } }>('/vessels/join', { code })
}
