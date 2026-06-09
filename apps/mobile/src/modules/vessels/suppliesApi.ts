import { getJson, patchJson, postJson } from '../../services/http'

export interface SupplyItem {
  id: string
  vesselId: string
  name: string
  category: string
  unit: string
  quantity: number
  capacity?: number | null
  warnBelow?: number | null
}

export function listSupplies(vesselId: string, low = false) {
  return getJson<SupplyItem[]>(`/vessels/${vesselId}/supplies${low ? '?low=1' : ''}`)
}

export function createSupply(vesselId: string) {
  return postJson<SupplyItem>(`/vessels/${vesselId}/supplies`, {
    name: 'Fresh Water',
    category: 'water',
    unit: 'L',
    quantity: 40,
    capacity: 200,
    warnBelow: 50,
  })
}

export function adjustSupply(vesselId: string, itemId: string, delta: number) {
  return patchJson<SupplyItem>(`/vessels/${vesselId}/supplies/${itemId}/adjust`, { delta })
}
