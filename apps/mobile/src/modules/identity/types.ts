export type UserRole = 'CREW' | 'CAPTAIN' | 'OWNER' | 'MERCHANT' | string

export interface AuthUser {
  id: string
  phone?: string | null
  email?: string | null
  nickname: string
  accountKind?: string
  internalEmail?: string | null
  managedById?: string | null
  birthYear?: number | null
  guardianName?: string | null
  claimedAt?: string | null
  avatar?: string | null
  avatarUrl?: string | null
  coverImage?: string | null
  bio?: string | null
  region?: string | null
  country?: string | null
  firstLanguage?: string | null
  currency?: string | null
  timezone?: string | null
  textLanguage?: string | null
  uiLanguage?: string | null
  gender?: 'male' | 'female' | 'private' | string
  birthDate?: string | null
  sailingYears?: number | null
  title?: string
  level?: number
  xp?: number
  nextLevelXp?: number
  availableMileagePoints?: number
  pendingMileagePoints?: number
  activeBadgeId?: string | null
  roles?: UserRole[]
  verifiedRoles?: UserRole[]
  isPublic?: boolean
  locationPolicy?: 'exact' | 'region' | 'hidden' | string
  currentVesselId?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}
