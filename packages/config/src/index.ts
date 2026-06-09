export const API_PREFIX = 'api'
export const DEFAULT_API_PORT = 9180
export const V3_DATABASE_NAME = 'lazynavy_v3'
export const MAX_HOME_SHORTCUTS = 6

export const V3_BOTTOM_NAV = [
  { key: 'voyage', label: 'Voyage', href: '/voyage', icon: 'route' },
  { key: 'map', label: 'Map', href: '/map', icon: 'map' },
  { key: 'log', label: 'Log', href: '/log', icon: 'book' },
  { key: 'toolbox', label: 'Toolbox', href: '/toolbox', icon: 'wrench' },
] as const

export const V3_BOAT_RADIAL_MENU = [
  { key: 'supplies', label: 'Supplies', href: '/boat/supplies', icon: 'box' },
  { key: 'equipment', label: 'Equipment', href: '/boat/equipment', icon: 'gear' },
  { key: 'maintenance', label: 'Maintenance', href: '/boat/maintenance', icon: 'wrench' },
  { key: 'crew', label: 'Crew', href: '/boat/crew', icon: 'crew' },
  { key: 'documents', label: 'Documents', href: '/boat/documents', icon: 'file' },
  { key: 'manuals', label: 'Manuals', href: '/boat/manuals', icon: 'book' },
  { key: 'layout', label: 'Layout', href: '/boat/layout', icon: 'layout' },
  { key: 'photos', label: 'Photos', href: '/boat/photos', icon: 'camera' },
] as const

export const XP_SOURCE_CATEGORIES = [
  'captain',
  'sailor',
  'cook',
  'engineer',
  'guest',
  'explorer',
  'logger',
] as const
