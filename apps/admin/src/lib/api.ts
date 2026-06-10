const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:9080/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).message ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// --- Auth ---
export interface AdminSession {
  userId: string
  nickname: string
  email?: string | null
  isSuperAdmin: boolean
  perms: { ui: string[]; api: string[] }
}

export interface AdminLoginResponse {
  token: string
  admin: AdminSession
}

export function loginApi(identifier: string, password: string) {
  return api.post<AdminLoginResponse>('/admin/auth/login', { identifier, password })
}

export function getMeApi() {
  return api.get<AdminSession>('/admin/auth/me')
}

// --- Types ---
export interface AdminUser {
  id: string
  nickname: string
  email?: string
  phone?: string
  roles: string[]
  isPublic: boolean
  createdAt: string
  deletedAt?: string | null
}

export interface AdminPost {
  id: string
  content: string
  authorId: string
  author?: { id: string; nickname: string }
  tags: string[]
  displayType: string
  isArchived: boolean
  createdAt: string
  deletedAt?: string | null
  media?: { url: string; sortOrder: number }[]
  _count?: { likes: number; comments: number; saves: number }
}

export interface AdminPoi {
  id: string
  name: string
  kind: string
  type: string
  category: string
  subtype: string
  status: string
  lat: number
  lng: number
  country?: string
  region?: string
  rating?: number
  commentsCount: number
}

export interface AdminInventoryTemplate {
  id: string
  name: string
  description?: string | null
  ownershipType: string
  visibility: string
  notesJson?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
  _count?: { items: number }
}

export interface AdminInventoryTemplateItem {
  id: string
  vesselId: string
  kind: string
  category?: string | null
  name: string
  unit?: string | null
  warnBelow?: number | null
  status: string
  sourceMode: string
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

// --- API calls ---
export function listUsersApi(params?: { q?: string; page?: number }) {
  const p = new URLSearchParams()
  if (params?.q) p.set('q', params.q)
  if (params?.page) p.set('page', String(params.page))
  const qs = p.toString()
  return api.get<AdminUser[]>(qs ? `/admin/users?${qs}` : '/admin/users')
}

export function listPostsAdminApi(params?: { archived?: boolean; page?: number }) {
  const p = new URLSearchParams()
  if (params?.archived != null) p.set('archived', String(params.archived))
  if (params?.page) p.set('page', String(params.page))
  const qs = p.toString()
  return api.get<AdminPost[]>(qs ? `/posts?${qs}` : '/posts')
}

export function archivePostAdminApi(id: string) {
  return api.patch<AdminPost>(`/posts/${id}/archive`, {})
}

export function deletePostAdminApi(id: string) {
  return api.del<{ ok: true }>(`/posts/${id}`)
}

export function listPoisAdminApi(params?: { q?: string; status?: string }) {
  const p = new URLSearchParams()
  if (params?.q) p.set('q', params.q)
  if (params?.status) p.set('status', params.status)
  const qs = p.toString()
  return api.get<AdminPoi[]>(qs ? `/pois?${qs}` : '/pois?limit=100')
}

export function listInventoryTemplatesApi() {
  return api.get<AdminInventoryTemplate[]>('/admin/inventory-templates')
}

export function createInventoryTemplateApi(body: { id?: string; name: string; locale?: string; description?: string }) {
  return api.post<AdminInventoryTemplate>('/admin/inventory-templates', body)
}

export function updateInventoryTemplateApi(id: string, body: { name?: string; description?: string; visibility?: string }) {
  return api.patch<AdminInventoryTemplate>(`/admin/inventory-templates/${id}`, body)
}

export function deleteInventoryTemplateApi(id: string) {
  return api.del<{ ok: true }>(`/admin/inventory-templates/${id}`)
}

export function listInventoryTemplateItemsApi(templateId: string) {
  return api.get<AdminInventoryTemplateItem[]>(`/admin/inventory-templates/${templateId}/items`)
}

export function createInventoryTemplateItemApi(templateId: string, body: {
  category: string
  groupKey?: string
  name: string
  unit?: string
  warnBelow?: number
  status?: string
  templateKey?: string
}) {
  return api.post<AdminInventoryTemplateItem>(`/admin/inventory-templates/${templateId}/items`, body)
}

export function updateInventoryTemplateItemApi(id: string, body: {
  category?: string
  groupKey?: string
  name?: string
  unit?: string
  warnBelow?: number
  status?: string
  templateKey?: string
}) {
  return api.patch<AdminInventoryTemplateItem>(`/admin/inventory-template-items/${id}`, body)
}

export function deleteInventoryTemplateItemApi(id: string) {
  return api.del<{ ok: true }>(`/admin/inventory-template-items/${id}`)
}
