import { http } from '../../../services/http'
import type { AuthResponse, AuthUser } from '../types'

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
