export type Id = string

export * from './inventory/template'

export type BoatSceneTemplateKey =
  | 'empty_sea'
  | 'open_sea'
  | 'anchorage'
  | 'marina'
  | 'yacht_club'
  | 'maintenance_yard'
  | 'in_voyage'

export type CrewRole = 'captain' | 'first_mate' | 'engineer' | 'navigator' | 'cook' | 'guest'
export type XpSourceCategory = 'captain' | 'sailor' | 'cook' | 'engineer' | 'guest' | 'explorer' | 'logger'
export type RewardSettlementStatus = 'pending' | 'approved' | 'rejected' | 'manual_review'
export type VoyageStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type BadgeKind = 'system_achievement' | 'user_custom' | 'organization' | 'special' | 'reward' | 'fan_club'

export interface BadgeDefinition {
  id: string
  title: string
  kind: BadgeKind
  description: string
  enabled: boolean
}

export const SYSTEM_ACHIEVEMENT_BADGES = [
  { id: '01_beginner', title: '初学者', kind: 'system_achievement', description: '刚刚登船，航海故事从这里开始。', enabled: true },
  { id: '02_deckhand', title: '甲板水手', kind: 'system_achievement', description: '熟悉甲板、绳结和船上的基本节奏。', enabled: true },
  { id: '03_lookout', title: '瞭望手', kind: 'system_achievement', description: '能在浪线和云影之间发现方向。', enabled: true },
  { id: '04_helmsman', title: '舵手', kind: 'system_achievement', description: '开始掌握船舵和航向。', enabled: true },
  { id: '05_navigator', title: '领航员', kind: 'system_achievement', description: '会用罗盘、海图和经验判断航路。', enabled: true },
  { id: '06_cartographer', title: '制图师', kind: 'system_achievement', description: '记录水域、港口和新的发现。', enabled: true },
  { id: '07_gunner', title: '炮手', kind: 'system_achievement', description: '沉稳、精准，负责关键时刻的火力。', enabled: true },
  { id: '08_boatswain', title: '水手长', kind: 'system_achievement', description: '能把一支船员队伍组织得井井有条。', enabled: true },
  { id: '09_first_mate', title: '大副', kind: 'system_achievement', description: '船长身边最可靠的执行者。', enabled: true },
  { id: '10_old_sailor', title: '老水手', kind: 'system_achievement', description: '见过风暴，也懂得什么时候该等风。', enabled: true },
  { id: '11_sea_wolf', title: '海狼', kind: 'system_achievement', description: '有锋芒，也有对海的直觉。', enabled: true },
  { id: '12_senior_captain', title: '高级船长', kind: 'system_achievement', description: '能独立判断航线、船况和船员节奏。', enabled: true },
  { id: '13_commander', title: '舰队指挥官', kind: 'system_achievement', description: '开始承担更大规模的组织和调度。', enabled: true },
  { id: '14_admiral', title: '海军上将', kind: 'system_achievement', description: '威望、经验和判断力都已抵达深水区。', enabled: true },
  { id: '15_legendary_explorer', title: '传奇探险家', kind: 'system_achievement', description: '把未知海域变成别人航海图上的名字。', enabled: true },
] satisfies BadgeDefinition[]

export interface UserSummary {
  id: Id
  nickname: string
  avatarUrl?: string | null
  title: string
  level: number
  xp: number
  nextLevelXp: number
  availableMileagePoints: number
  pendingMileagePoints: number
  activeBadgeId?: string | null
  currentVesselId?: Id | null
}

export interface VesselSummary {
  id: Id
  name: string
  type?: string | null
  homePort?: string | null
  title: string
  level: number
  xp: number
  nextLevelXp: number
  badges: string[]
  availableMileagePoints: number
  pendingMileagePoints: number
  crewCount: number
  userRole: CrewRole
  sceneTemplate: BoatSceneTemplateKey
}

export interface VoyageSummary {
  id: Id
  vesselId: Id
  status: VoyageStatus
  name: string
  departureName?: string | null
  destinationName?: string | null
  plannedStartAt?: string | null
  needsConfirmation: boolean
}

export interface HudShortcut {
  key: string
  label: string
  href: string
  icon: string
  pinned: boolean
}

export interface EnvironmentChip {
  key: string
  label: string
  value: string
}

export interface CaptainHudResponse {
  user: UserSummary | null
  currentVessel: VesselSummary | null
  vessels: VesselSummary[]
  activeVoyage: VoyageSummary | null
  sceneTemplate: BoatSceneTemplateKey
  weather: EnvironmentChip[]
  shortcuts: HudShortcut[]
}

export interface Location {
  lat: number
  lng: number
}

export type PoiCategoryGroup = 'berthing' | 'service' | 'hazard' | 'other'

export type PoiCategory =
  | 'marina'
  | 'anchorage'
  | 'dry_dock'
  | 'buoy_mooring'
  | 'public_quay'
  | 'hazard'
  | 'other'

export type PoiStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'temporarily_closed'
  | 'restricted'
  | 'archived'

export type PoiNoteType = 'info' | 'caution' | 'warning' | 'restriction'
export type PoiNoteStatus = 'draft' | 'pending_review' | 'published' | 'highlighted' | 'rejected' | 'archived'

export interface PoiReview {
  id: string
  poiId: string
  userId: string
  rating: number
  comment?: string
  createdAt: string
  updatedAt: string
  user?: { id: string; nickname: string; avatar?: string | null }
}

export interface PoiNote {
  id: string
  status: PoiNoteStatus
  noteType: PoiNoteType
  text: string
  isPinned: boolean
  isConfirmed: boolean
  confirmedAt?: string
  confirmedBy?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  createdByRole?: string
}

export interface POI {
  id: string
  version: number
  name: string
  category: PoiCategory
  categoryGroup: PoiCategoryGroup
  subtype: PoiCategory
  status: PoiStatus
  kind: string
  type: string
  slug: string
  location: Location
  region?: string
  country?: string
  address?: string
  description?: string
  rating?: number
  commentsCount: number
  phone?: string
  sourceUrl?: string
  picture?: string
  timezone?: string
  maxDraft?: number
  maxLength?: number
  maxBeam?: number
  bookable?: boolean
  overnightAllowed?: boolean
  stayLimit?: string
  feeInfo?: string
  multihullFriendly?: boolean
  seabeds: string[]
  protections: string[]
  berthingTypes: string[]
  mooringTypes: string[]
  bestMonths: number[]
  hasWater?: boolean
  hasPower?: boolean
  hasFuel?: boolean
  hasRepair?: boolean
  hasWasteDisposal?: boolean
  notes: PoiNote[]
  warningNotes: PoiNote[]
  photos: string[]
}

export interface PoiRegionSummary {
  id: string
  location: Location
  count: number
  topCategory: PoiCategory
  categories: Partial<Record<PoiCategory, number>>
  region?: string
}
