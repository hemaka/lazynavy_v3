import { ModuleScreen } from '../../shared/ui/ModuleScreen'

export function VoyageScreen() {
  return (
    <ModuleScreen
      kicker="VOYAGE"
      title="Current Voyage"
      body="Voyage planning, participant confirmation, active trip state, and audit trail will live here. This module stays separate from boat management."
    />
  )
}
