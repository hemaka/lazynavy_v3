import type { CaptainHudResponse } from '@lazynavy-v3/types'
import { getJson, postJson } from '../../services/http'

export function getCaptainHud(empty = false) {
  return getJson<CaptainHudResponse>(`/home/captain-hud${empty ? '?empty=1' : ''}`)
}

export function createVessel(name: string) {
  return postJson('/vessels', { name, type: 'sailboat', homePort: 'Home Marina' })
}
