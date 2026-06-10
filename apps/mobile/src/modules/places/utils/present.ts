import type { POI, PoiCategory } from '@lazynavy-v3/types'

export const POI_TYPES: { id: PoiCategory | 'all'; label: string; color: string | null }[] = [
  { id: 'all', label: '全部', color: null },
  { id: 'marina', label: '码头', color: '#0ea5e9' },
  { id: 'anchorage', label: '锚地', color: '#34d399' },
  { id: 'dry_dock', label: '干船坞', color: '#ef4444' },
  { id: 'buoy_mooring', label: '浮标泊位', color: '#f59e0b' },
  { id: 'public_quay', label: '公共泊靠', color: '#a78bfa' },
  { id: 'hazard', label: '限制/风险', color: '#f87171' },
]

// 地标类型字形(适配地图 marker 的彩色圆点,单字符)。键覆盖 category 与可能的 subtype/kind 细分。
export const TYPE_ICONS: Record<string, string> = {
  marina: 'M',
  anchorage: 'A',
  dry_dock: 'D',
  buoy_mooring: 'B',
  public_quay: 'Q',
  hazard: '!',
  // 后端细化 subtype/kind 后即生效的细分字形:
  fuel: 'F',
  yacht_club: 'Y',
  slipway: 'S',
  customs: 'C',
  repair: 'R',
  other: '•',
}

// 地标类型图标:优先 subtype(更细),其次 category、kind,最后 other —— 按 category/subtype 区分。
export function iconForPoi(poi: Pick<POI, 'category' | 'subtype' | 'kind'>): string {
  return (
    (poi.subtype && poi.subtype !== poi.category ? TYPE_ICONS[poi.subtype] : undefined) ??
    TYPE_ICONS[poi.category] ??
    (poi.kind ? TYPE_ICONS[poi.kind] : undefined) ??
    TYPE_ICONS.other
  )
}

// 颜色也优先按 subtype 区分,回退 category。
export function colorForPoi(poi: Pick<POI, 'category' | 'subtype'>): string {
  return colorForCategory((poi.subtype as PoiCategory) ?? poi.category) ?? colorForCategory(poi.category)
}

export function colorForCategory(category: PoiCategory | 'all') {
  return POI_TYPES.find((item) => item.id === category)?.color ?? '#0ea5e9'
}

export function labelForCategory(category: PoiCategory, text: (source: string) => string = (source) => source) {
  const label = POI_TYPES.find((item) => item.id === category)?.label ?? '其他'
  return text(label)
}

export function shortInfoOf(poi: POI, text: (source: string, vars?: Record<string, string | number>) => string = (source) => source) {
  const pieces: string[] = []
  if (poi.region) pieces.push(poi.region)
  if (poi.maxDraft) pieces.push(text('吃水 {draft}m', { draft: poi.maxDraft }))
  if (poi.maxLength) pieces.push(text('船长 {length}m', { length: poi.maxLength }))
  if (poi.seabeds.length) pieces.push(poi.seabeds.slice(0, 2).map((value) => localizeSeabed(value, text)).join('/'))
  if (poi.bookable) pieces.push(text('可预订'))
  return pieces.slice(0, 2).join(' · ') || text('基础地标资料已同步')
}

export function coordinateLabel(poi: POI) {
  return `${poi.location.lat.toFixed(4)}, ${poi.location.lng.toFixed(4)}`
}

export function metaTagsOf(poi: POI, text: (source: string) => string = (source) => source) {
  const tags: string[] = []
  if (poi.bookable) tags.push(text('可预订'))
  if (poi.multihullFriendly) tags.push(text('双体友好'))
  if (poi.country) tags.push(poi.country)
  if (poi.timezone) tags.push(poi.timezone)
  return tags
}

const SEABED_LABELS: Record<string, string> = {
  sand: '沙底',
  mud: '泥底',
  rock: '岩底',
  coral: '珊瑚底',
  weed: '海草底',
  shell: '贝壳底',
  gravel: '砾底',
  clay: '黏土底',
}

const MOORING_LABELS: Record<string, string> = {
  mooring: '锚泊',
  anchor: '抛锚',
  med_moor: '地中海系泊',
  alongside: '靠泊',
  stern_to: '船尾靠泊',
  buoy: '浮球系泊',
  dock: '码头泊靠',
  quay: '岸壁靠泊',
}

function prettifyPoiTerm(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function localizeSeabed(value: string, text: (source: string) => string = (source) => source) {
  const key = value.trim().toLowerCase()
  return SEABED_LABELS[key] ? text(SEABED_LABELS[key]) : prettifyPoiTerm(value)
}

export function localizeMooring(value: string, text: (source: string) => string = (source) => source) {
  const key = value.trim().toLowerCase()
  return MOORING_LABELS[key] ? text(MOORING_LABELS[key]) : prettifyPoiTerm(value)
}
