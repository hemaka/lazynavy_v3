import type { PropsWithChildren } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'

export type Region = {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain' | 'none' | 'mutedStandard'

type MapViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>
  onRegionChangeComplete?: (region: Region) => void
}>

export const PROVIDER_GOOGLE = 'google'

export function Marker({ children }: PropsWithChildren<Record<string, unknown>>) {
  return <>{children}</>
}

export function Callout({ children }: PropsWithChildren<Record<string, unknown>>) {
  return <>{children}</>
}

export default function MapView({ children, style }: MapViewProps) {
  return <View style={style}>{children}</View>
}
