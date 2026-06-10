import type { ImageSourcePropType } from 'react-native'
import { SYSTEM_ACHIEVEMENT_BADGES, type BadgeDefinition } from '@lazynavy-v3/types'

export type BadgeCatalogItem = BadgeDefinition & {
  image: ImageSourcePropType
}

const badgeImages: Record<string, ImageSourcePropType> = {
  '01_beginner': require('../../../assets/badges/system-achievement/01_beginner.png'),
  '02_deckhand': require('../../../assets/badges/system-achievement/02_deckhand.png'),
  '03_lookout': require('../../../assets/badges/system-achievement/03_lookout.png'),
  '04_helmsman': require('../../../assets/badges/system-achievement/04_helmsman.png'),
  '05_navigator': require('../../../assets/badges/system-achievement/05_navigator.png'),
  '06_cartographer': require('../../../assets/badges/system-achievement/06_cartographer.png'),
  '07_gunner': require('../../../assets/badges/system-achievement/07_gunner.png'),
  '08_boatswain': require('../../../assets/badges/system-achievement/08_boatswain.png'),
  '09_first_mate': require('../../../assets/badges/system-achievement/09_first_mate.png'),
  '10_old_sailor': require('../../../assets/badges/system-achievement/10_old_sailor.png'),
  '11_sea_wolf': require('../../../assets/badges/system-achievement/11_sea_wolf.png'),
  '12_senior_captain': require('../../../assets/badges/system-achievement/12_senior_captain.png'),
  '13_commander': require('../../../assets/badges/system-achievement/13_commander.png'),
  '14_admiral': require('../../../assets/badges/system-achievement/14_admiral.png'),
  '15_legendary_explorer': require('../../../assets/badges/system-achievement/15_legendary_explorer.png'),
}

export const SYSTEM_BADGE_CATALOG: BadgeCatalogItem[] = SYSTEM_ACHIEVEMENT_BADGES.map((badge) => ({
  ...badge,
  image: badgeImages[badge.id],
}))

export function findBadge(id?: string | null) {
  if (!id) return null
  return SYSTEM_BADGE_CATALOG.find((badge) => badge.id === id) ?? null
}
