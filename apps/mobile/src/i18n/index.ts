type Vars = Record<string, string | number>

function interpolate(source: string, vars?: Vars) {
  if (!vars) return source
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    source,
  )
}

export function useI18n() {
  return {
    locale: 'zh-CN',
    setLocale: () => {},
    tr: (key: string, vars?: Vars) => interpolate(key, vars),
    text: (source: string, vars?: Vars) => interpolate(source, vars),
  }
}

