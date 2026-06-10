'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginApi, getMeApi } from './api'

export type PermKind = 'ui' | 'api'

export interface AdminSession {
  userId: string
  nickname: string
  email?: string | null
  isSuperAdmin: boolean
  perms: { ui: string[]; api: string[] }
}

interface AuthState {
  session: AdminSession | null
  ready: boolean
  /** SuperAdmin 始终返回 true */
  hasPerm: (code: string, kind: PermKind) => boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)

const TOKEN_KEY   = 'admin_token'
const SESSION_KEY = 'admin_session'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [ready, setReady]     = useState(false)
  const router = useRouter()

  const persist = useCallback((token: string, s: AdminSession) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }, [])

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }, [])

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY)
    if (!t) { setReady(true); return }

    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try { setSession(JSON.parse(saved)) } catch { /* ignore */ }
    }

    getMeApi()
      .then(fresh => setSession(fresh))
      .catch(() => clear())
      .finally(() => setReady(true))
  }, [clear])

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await loginApi(identifier, password)
    persist(res.token, res.admin)
  }, [persist])

  const logout = useCallback(() => {
    clear()
    router.push('/login')
  }, [clear, router])

  const hasPerm = useCallback(
    (code: string, kind: PermKind): boolean => {
      if (!session) return false
      if (session.isSuperAdmin) return true
      return session.perms[kind].includes(code)
    },
    [session],
  )

  const value = useMemo(
    () => ({ session, ready, hasPerm, login, logout }),
    [session, ready, hasPerm, login, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
