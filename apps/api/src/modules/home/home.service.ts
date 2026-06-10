import { Injectable } from '@nestjs/common'
import { MAX_HOME_SHORTCUTS, V3_BOAT_RADIAL_MENU } from '@lazynavy-v3/config'
import type { BoatSceneTemplateKey, CaptainHudResponse, CrewRole, VesselSummary } from '@lazynavy-v3/types'
import { IdentityService } from '../identity/identity.service'
import { VesselsService } from '../vessels/vessels.service'
import { VoyagesService } from '../voyages/voyages.service'

@Injectable()
export class HomeService {
  constructor(
    private readonly identity: IdentityService,
    private readonly vessels: VesselsService,
    private readonly voyages: VoyagesService,
  ) {}

  async captainHud(opts: { userId?: string; empty?: boolean }): Promise<CaptainHudResponse> {
    if (opts.empty) return this.emptyHud()
    const user = opts.userId ? await this.identity.getUser(opts.userId) : await this.identity.getOrCreateDevUser()
    if (!user) return this.emptyHud()

    const vessels = await this.vessels.listForUser(user.id)
    const current = vessels.find((v) => v.id === user.currentVesselId) ?? vessels[0] ?? null
    const activeVoyage = current ? await this.voyages.activeForUser(user.id, current.id) : null
    const summaries = vessels.map((v): VesselSummary => {
      const membership = v.memberships.find((m) => m.userId === user.id)
      return {
        id: v.id,
        name: v.name,
        type: v.type,
        homePort: v.homePort,
        title: v.title,
        level: v.level,
        xp: v.xp,
        nextLevelXp: v.nextLevelXp,
        badges: parseBadges(v.badgesJson),
        availableMileagePoints: v.availableMileagePoints,
        pendingMileagePoints: v.pendingMileagePoints,
        crewCount: v.memberships.length,
        userRole: (membership?.role ?? 'captain') as CrewRole,
        sceneTemplate: normalizeScene(v.sceneTemplate),
      }
    })
    const currentSummary = current ? summaries.find((v) => v.id === current.id) ?? null : null

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        title: user.title,
        level: user.level,
        xp: user.xp,
        nextLevelXp: user.nextLevelXp,
        availableMileagePoints: user.availableMileagePoints,
        pendingMileagePoints: user.pendingMileagePoints,
        activeBadgeId: user.activeBadgeId,
        currentVesselId: user.currentVesselId,
      },
      currentVessel: currentSummary,
      vessels: summaries,
      activeVoyage: activeVoyage
        ? {
            id: activeVoyage.id,
            vesselId: activeVoyage.vesselId,
            status: activeVoyage.status as never,
            name: activeVoyage.name,
            departureName: activeVoyage.departureName,
            destinationName: activeVoyage.destinationName,
            plannedStartAt: activeVoyage.plannedStartAt?.toISOString() ?? null,
            needsConfirmation: activeVoyage.needsConfirmation,
          }
        : null,
      sceneTemplate: currentSummary?.sceneTemplate ?? 'empty_sea',
      weather: [
        { key: 'wind', label: 'Wind', value: '8 kt SW' },
        { key: 'sea', label: 'Sea', value: 'Calm' },
      ],
      shortcuts: currentSummary
        ? V3_BOAT_RADIAL_MENU.slice(0, MAX_HOME_SHORTCUTS).map((item, index) => ({
            key: item.key,
            label: item.label,
            href: item.href,
            icon: item.icon,
            pinned: index < 4,
          }))
        : [],
    }
  }

  private emptyHud(): CaptainHudResponse {
    return {
      user: null,
      currentVessel: null,
      vessels: [],
      activeVoyage: null,
      sceneTemplate: 'empty_sea',
      weather: [{ key: 'sea', label: 'Sea', value: 'Open' }],
      shortcuts: [],
    }
  }
}

function normalizeScene(value: string): BoatSceneTemplateKey {
  const allowed: BoatSceneTemplateKey[] = ['empty_sea', 'open_sea', 'anchorage', 'marina', 'yacht_club', 'maintenance_yard', 'in_voyage']
  return allowed.includes(value as BoatSceneTemplateKey) ? (value as BoatSceneTemplateKey) : 'open_sea'
}

function parseBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}
