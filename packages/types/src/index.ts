export type Id = string

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
