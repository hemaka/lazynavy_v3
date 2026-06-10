import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { HttpError } from '../../services/http'
import { getMeApi, loginApi, registerApi } from './api/client'
import { clearActiveSession, getActiveSession, setActiveSession, updateActiveUser } from './storage/accountStore'
import type { AuthUser } from './types'

export interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoggedIn: boolean
  ready: boolean
  register: (nickname: string, identifier: string, password: string) => Promise<void>
  login: (identifier: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const persist = useCallback(async (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken)
    setUser(nextUser)
    await setActiveSession(nextUser, nextToken)
  }, [])

  const wipeSession = useCallback(async () => {
    setToken(null)
    setUser(null)
    await clearActiveSession()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restore() {
      const session = await getActiveSession()
      if (!session || cancelled) return

      setToken(session.token)
      setUser(session.user)

      try {
        const freshUser = await getMeApi(session.token)
        if (cancelled) return
        setUser(freshUser)
        await updateActiveUser(freshUser)
      } catch (error) {
        if (cancelled) return
        if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
          await wipeSession()
        }
      }
    }

    restore().finally(() => {
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [wipeSession])

  const refreshUser = useCallback(async () => {
    if (!token) return
    try {
      const freshUser = await getMeApi(token)
      await persist(token, freshUser)
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        await wipeSession()
      }
    }
  }, [persist, token, wipeSession])

  const register = useCallback(async (nickname: string, identifier: string, password: string) => {
    const cleanIdentifier = identifier.trim()
    const isEmail = cleanIdentifier.includes('@')
    const response = await registerApi({
      nickname: nickname.trim(),
      password,
      ...(isEmail ? { email: cleanIdentifier } : { phone: cleanIdentifier }),
    })
    await persist(response.token, response.user)
  }, [persist])

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await loginApi(identifier.trim(), password)
    await persist(response.token, response.user)
  }, [persist])

  const logout = useCallback(async () => {
    await wipeSession()
  }, [wipeSession])

  const value = useMemo<AuthState>(() => ({
    user,
    token,
    isLoggedIn: !!user,
    ready,
    register,
    login,
    refreshUser,
    logout,
  }), [login, logout, ready, refreshUser, register, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
