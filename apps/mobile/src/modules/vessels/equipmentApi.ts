import { getJson, postJson } from '../../services/http'

export interface EquipmentItem {
  id: string
  vesselId: string
  name: string
  category: string
  status: string
  location?: string | null
  maintenanceIntervalDays?: number | null
  lastServicedAt?: string | null
  nextDueAt?: string | null
}

export function listEquipment(vesselId: string) {
  return getJson<EquipmentItem[]>(`/equipment?vesselId=${vesselId}`)
}

export function listDueEquipment(vesselId: string) {
  return getJson<EquipmentItem[]>(`/equipment/due?vesselId=${vesselId}&withinDays=45`)
}

export function createEquipment(vesselId: string) {
  return postJson<EquipmentItem>('/equipment', {
    vesselId,
    name: 'Main Engine',
    category: 'engine',
    status: 'active',
    location: 'Engine room',
    installedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
    maintenanceIntervalDays: 30,
  })
}

export function completeService(equipmentId: string) {
  return postJson(`/equipment/${equipmentId}/maintenance`, {
    type: 'service',
    status: 'done',
    title: 'Routine service',
    performedAt: new Date().toISOString(),
  })
}
