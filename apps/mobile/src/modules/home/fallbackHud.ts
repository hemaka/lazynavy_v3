import type { CaptainHudResponse } from '@lazynavy-v3/types'

export const fallbackHud: CaptainHudResponse = {
  user: {
    id: 'local-demo',
    nickname: 'V3 Captain',
    title: 'Harbor Rookie',
    level: 1,
    xp: 35,
    nextLevelXp: 120,
    currentVesselId: 'local-vessel',
  },
  currentVessel: {
    id: 'local-vessel',
    name: 'Morning Star',
    type: 'sailboat',
    homePort: 'Home Marina',
    title: 'First Wake',
    level: 1,
    xp: 62,
    nextLevelXp: 180,
    crewCount: 3,
    userRole: 'captain',
    sceneTemplate: 'marina',
  },
  vessels: [],
  activeVoyage: {
    id: 'local-voyage',
    vesselId: 'local-vessel',
    status: 'planned',
    name: 'Saturday Bay Run',
    departureName: 'Home Marina',
    destinationName: 'Blue Point',
    plannedStartAt: null,
    needsConfirmation: true,
  },
  sceneTemplate: 'marina',
  weather: [
    { key: 'wind', label: 'Wind', value: '8 kt SW' },
    { key: 'sea', label: 'Sea', value: 'Calm' },
  ],
  shortcuts: [
    { key: 'supplies', label: 'Supplies', href: '/boat/supplies', icon: 'box', pinned: true },
    { key: 'equipment', label: 'Equipment', href: '/boat/equipment', icon: 'gear', pinned: true },
    { key: 'crew', label: 'Crew', href: '/boat/crew', icon: 'crew', pinned: true },
    { key: 'manuals', label: 'Manuals', href: '/boat/manuals', icon: 'book', pinned: true },
  ],
}
