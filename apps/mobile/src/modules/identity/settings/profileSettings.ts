import AsyncStorage from '@react-native-async-storage/async-storage'

export type TwoFactorMethod = 'off' | 'email' | 'authenticator'
export type ColorTheme = 'system' | 'ocean' | 'light' | 'dark'
export type VisibilityChoice = 'everyone' | 'friends' | 'crew' | 'private'

export interface LocalProfileSettings {
  twoFactorMethod: TwoFactorMethod
  appLockEnabled: boolean
  appLockPassword: string
  faceUnlockEnabled: boolean
  fingerprintUnlockEnabled: boolean
  colorTheme: ColorTheme
  speechLanguage: string
  uiLanguage: string
  whoCanViewMe: VisibilityChoice
  whoCanAddMe: VisibilityChoice
  searchable: boolean
  visibleFields: string[]
}

export const DEFAULT_PROFILE_SETTINGS: LocalProfileSettings = {
  twoFactorMethod: 'off',
  appLockEnabled: false,
  appLockPassword: '',
  faceUnlockEnabled: false,
  fingerprintUnlockEnabled: false,
  colorTheme: 'ocean',
  speechLanguage: 'zh-CN',
  uiLanguage: 'zh-CN',
  whoCanViewMe: 'everyone',
  whoCanAddMe: 'everyone',
  searchable: true,
  visibleFields: ['avatar', 'bio', 'region', 'badges'],
}

const PROFILE_SETTINGS_KEY = 'lazynavy:v3:profile-settings'

export async function loadProfileSettings(): Promise<LocalProfileSettings> {
  const raw = await AsyncStorage.getItem(PROFILE_SETTINGS_KEY)
  if (!raw) return DEFAULT_PROFILE_SETTINGS
  try {
    return { ...DEFAULT_PROFILE_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PROFILE_SETTINGS
  }
}

export async function saveProfileSettings(settings: LocalProfileSettings) {
  await AsyncStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(settings))
}
