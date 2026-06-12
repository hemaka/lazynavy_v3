import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../modules/identity/public'
import { DEFAULT_LOCALE, TRANSLATIONS, normalizeLocale, translateSourceText, type TranslationKey, type UiLocale } from './translations'

interface I18nContextValue {
  locale: UiLocale
  setLocale: (locale: string) => void
  tr: (key: TranslationKey, vars?: Record<string, string | number>) => string
  text: (source: string, vars?: Record<string, string | number>) => string
}

const STORAGE_KEY = '@lazynavy/ui-language'

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  tr: (key) => TRANSLATIONS[DEFAULT_LOCALE][key],
  text: (source) => source,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [locale, setLocaleState] = useState<UiLocale>(normalizeLocale(user?.uiLanguage))

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (user?.uiLanguage) return
      setLocaleState(normalizeLocale(saved))
    })
  }, [user?.uiLanguage])

  useEffect(() => {
    if (user?.uiLanguage) setLocaleState(normalizeLocale(user.uiLanguage))
  }, [user?.uiLanguage])

  const setLocale = useCallback((next: string) => {
    const normalized = normalizeLocale(next)
    setLocaleState(normalized)
    void AsyncStorage.setItem(STORAGE_KEY, normalized)
  }, [])

  const tr = useCallback((key: TranslationKey, vars?: Record<string, string | number>) => {
    let text = TRANSLATIONS[locale][key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
      }
    }
    return text
  }, [locale])
  const text = useCallback((source: string, vars?: Record<string, string | number>) => translateSourceText(locale, source, vars), [locale])

  const value = useMemo(() => ({ locale, setLocale, tr, text }), [locale, setLocale, text, tr])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
