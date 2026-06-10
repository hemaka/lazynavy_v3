import { http } from '../../../services/http'
import type { AuthResponse, AuthUser } from '../types'

export interface UserBadgeItem {
  id: string
  kind: string
  status: string
  title: string
  description?: string | null
  imageKey?: string | null
  sortOrder: number
  userBadgeStatus: string
  source: string
  grantedAt: string
}

export interface UserBadgesResponse {
  activeBadgeId?: string | null
  badges: UserBadgeItem[]
}

export function registerApi(data: {
  nickname: string
  password: string
  email?: string
  phone?: string
}) {
  return http.post<AuthResponse>('/auth/register', data)
}

export function loginApi(identifier: string, password: string) {
  return http.post<AuthResponse>('/auth/login', { identifier, password })
}

export function getMeApi(token: string) {
  return http.get<AuthUser>('/users/me', token)
}

export function getUserProfileApi(id: string, token?: string | null) {
  return http.get<AuthUser>(`/users/${id}`, token)
}

export function updateProfileApi(token: string, patch: Partial<AuthUser>) {
  return http.patch<AuthUser>('/users/me', patch, token)
}

export function getMyBadgesApi(token: string) {
  return http.get<UserBadgesResponse>('/users/me/badges', token)
}

export function setActiveBadgeApi(token: string, badgeId: string | null) {
  return http.patch<{ activeBadgeId: string | null; badge: UserBadgeItem | null }>('/users/me/badge', { badgeId }, token)
}
