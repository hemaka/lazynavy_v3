import type { CaptainHudResponse } from '@lazynavy-v3/types'
import { getJson, postJson } from '../../services/http'

export function getCaptainHud(empty = false, userId?: string | null) {
  const params = new URLSearchParams()
  if (empty) params.set('empty', '1')
  if (userId) params.set('userId', userId)
  const query = params.toString()
  return getJson<CaptainHudResponse>(`/home/captain-hud${query ? `?${query}` : ''}`)
}

export function createVessel(name: string) {
  return postJson('/vessels', { name, type: 'sailboat', homePort: 'Home Marina' })
}
