import type { POI, PoiCategory, PoiNote, PoiRegionSummary, PoiReview } from '@lazynavy-v3/types'
import { http } from '../../../services/http'

// ---- 地标评价/评分 (#53) ----
export function listPoiReviewsApi(poiId: string) {
  return http.get<PoiReview[]>(`/pois/${poiId}/reviews`)
}
export function getMyPoiReviewApi(poiId: string, token: string) {
  return http.get<PoiReview | null>(`/pois/${poiId}/reviews/me`, token)
}
export function upsertPoiReviewApi(poiId: string, body: { rating: number; comment?: string }, token: string) {
  return http.post<PoiReview>(`/pois/${poiId}/reviews`, body, token)
}
export function deletePoiReviewApi(poiId: string, token: string) {
  return http.del<{ ok: true }>(`/pois/${poiId}/reviews/me`, token)
}

// ---- 地标收藏/喜欢 (#54) ----
export function isPoiFavoritedApi(poiId: string, token: string) {
  return http.get<{ favorited: boolean }>(`/pois/${poiId}/favorite`, token)
}
export function addPoiFavoriteApi(poiId: string, token: string) {
  return http.post<{ favorited: boolean }>(`/pois/${poiId}/favorite`, {}, token)
}
export function removePoiFavoriteApi(poiId: string, token: string) {
  return http.del<{ favorited: boolean }>(`/pois/${poiId}/favorite`, token)
}
export function listFavoritePoisApi(token: string) {
  return http.get<POI[]>('/pois/mine/favorites', token)
}

// ---- 地标备注 (#52,任何登录用户可加,分 普通/警告) ----
export function listPoiNotesApi(poiId: string) {
  return http.get<PoiNote[]>(`/pois/${poiId}/notes`)
}
export function addPoiNoteApi(poiId: string, body: { text: string; noteType?: 'info' | 'warning' }, token: string) {
  return http.post<PoiNote>(`/pois/${poiId}/notes`, body, token)
}
export function deletePoiNoteApi(poiId: string, noteId: string, token: string) {
  return http.del<{ ok: true }>(`/pois/${poiId}/notes/${noteId}`, token)
}

export function listPoisApi(filters?: {
  category?: PoiCategory | 'all'
  q?: string
  limit?: number
  lat?: number
  lng?: number
  zoom?: number
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
}) {
  const params = new URLSearchParams()
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category)
  if (filters?.q?.trim()) params.set('q', filters.q.trim())
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (typeof filters?.lat === 'number') params.set('lat', String(filters.lat))
  if (typeof filters?.lng === 'number') params.set('lng', String(filters.lng))
  if (typeof filters?.zoom === 'number') params.set('zoom', String(filters.zoom))
  if (typeof filters?.minLat === 'number') params.set('minLat', String(filters.minLat))
  if (typeof filters?.maxLat === 'number') params.set('maxLat', String(filters.maxLat))
  if (typeof filters?.minLng === 'number') params.set('minLng', String(filters.minLng))
  if (typeof filters?.maxLng === 'number') params.set('maxLng', String(filters.maxLng))
  const query = params.toString()
  return http.get<POI[]>(query ? `/pois?${query}` : '/pois')
}

export function getPoiApi(id: string) {
  return http.get<POI>(`/pois/${id}`)
}

export function listPoiSummariesApi(filters?: {
  category?: PoiCategory | 'all'
  q?: string
  limit?: number
  lat?: number
  lng?: number
  zoom?: number
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
}) {
  const params = new URLSearchParams()
  if (filters?.category && filters.category !== 'all') params.set('category', filters.category)
  if (filters?.q?.trim()) params.set('q', filters.q.trim())
  if (filters?.limit) params.set('limit', String(filters.limit))
  if (typeof filters?.lat === 'number') params.set('lat', String(filters.lat))
  if (typeof filters?.lng === 'number') params.set('lng', String(filters.lng))
  if (typeof filters?.zoom === 'number') params.set('zoom', String(filters.zoom))
  if (typeof filters?.minLat === 'number') params.set('minLat', String(filters.minLat))
  if (typeof filters?.maxLat === 'number') params.set('maxLat', String(filters.maxLat))
  if (typeof filters?.minLng === 'number') params.set('minLng', String(filters.minLng))
  if (typeof filters?.maxLng === 'number') params.set('maxLng', String(filters.maxLng))
  const query = params.toString()
  return http.get<PoiRegionSummary[]>(query ? `/pois/summary?${query}` : '/pois/summary')
}
