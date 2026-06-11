import Constants from 'expo-constants'

const fallbackApiUrl = 'http://localhost:9180/api'
const requestTimeoutMs = 8000

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  fallbackApiUrl

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export async function getJson<T>(path: string, token?: string | null): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, { headers: authHeaders(token) })
  if (!res.ok) throw await toHttpError(res, `GET ${path} failed`)
  return res.json() as Promise<T>
}

export async function postJson<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toHttpError(res, `POST ${path} failed`)
  return res.json() as Promise<T>
}

export async function patchJson<T>(path: string, body: unknown, token?: string | null): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await toHttpError(res, `PATCH ${path} failed`)
  return res.json() as Promise<T>
}

export async function deleteJson<T>(path: string, token?: string | null): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, { method: 'DELETE', headers: authHeaders(token) })
  if (!res.ok) throw await toHttpError(res, `DELETE ${path} failed`)
  return res.json() as Promise<T>
}

export async function postForm<T>(path: string, form: FormData, token?: string | null): Promise<T> {
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  })
  if (!res.ok) throw await toHttpError(res, `POST ${path} failed`)
  return res.json() as Promise<T>
}

export const http = {
  get: <T>(path: string, token?: string | null) => getJson<T>(path, token),
  post: <T>(path: string, body: unknown, token?: string | null) => postJson<T>(path, body, token),
  patch: <T>(path: string, body: unknown, token?: string | null) => patchJson<T>(path, body, token),
  del: <T>(path: string, token?: string | null) => deleteJson<T>(path, token),
  form: <T>(path: string, form: FormData, token?: string | null) => postForm<T>(path, form, token),
}

function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout))
}

function authHeaders(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function toHttpError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null) as { message?: unknown } | null
  const message = typeof body?.message === 'string' ? body.message : `${fallback}: ${res.status}`
  return new HttpError(res.status, message)
}
