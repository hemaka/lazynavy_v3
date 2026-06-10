import { V3_BOTTOM_NAV } from '@lazynavy-v3/config'

export const bottomNav = V3_BOTTOM_NAV

export function isBottomNavActive(pathname: string, href: string) {
  const current = normalizePath(pathname)
  const target = normalizePath(href)

  if (target === '/') return current === '/'
  return current === target || current.startsWith(`${target}/`)
}

export function bottomNavIndexForPath(pathname: string) {
  return bottomNav.findIndex((item) => isBottomNavActive(pathname, item.href))
}

function normalizePath(path: string) {
  const [withoutQuery] = path.split(/[?#]/)
  if (!withoutQuery || withoutQuery === '/') return '/'
  return withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery
}
