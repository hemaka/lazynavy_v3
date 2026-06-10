import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthUser } from '../types'

const SESSION_KEY = '@lazynavy-v3/session'

export interface ActiveSession {
  user: AuthUser
  token: string
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ActiveSession
    if (!parsed?.token || !parsed?.user?.id) return null
    return parsed
  } catch {
    await AsyncStorage.removeItem(SESSION_KEY)
    return null
  }
}

export async function setActiveSession(user: AuthUser, token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }))
}

export async function updateActiveUser(user: AuthUser): Promise<void> {
  const session = await getActiveSession()
  if (!session) return
  await setActiveSession(user, session.token)
}

export async function clearActiveSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY)
}
