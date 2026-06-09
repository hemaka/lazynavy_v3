import { useLocalSearchParams } from 'expo-router'
import { ModuleScreen } from '../../shared/ui/ModuleScreen'

const labels: Record<string, string> = {
  overview: 'Boat Overview',
  supplies: 'Supplies',
  equipment: 'Equipment',
  maintenance: 'Maintenance',
  crew: 'Crew',
  documents: 'Documents',
  manuals: 'Manuals',
  layout: 'Layout',
  photos: 'Photos',
  join: 'Join Boat',
}

export function BoatSectionScreen() {
  const params = useLocalSearchParams<{ section?: string }>()
  const section = typeof params.section === 'string' ? params.section : 'overview'
  const title = labels[section] ?? 'Boat Module'
  return (
    <ModuleScreen
      kicker="BOAT"
      title={title}
      body="Boat-related modules open as full-screen secondary screens. The home boat/radial menu controls entry and pinned shortcuts decide what appears on the HUD."
    />
  )
}
