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
