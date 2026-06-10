import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { LocationProvider } from '../features/location/location-provider'
import { AuthProvider, LoginScreen, useAuth } from '../modules/identity/public'
import { ChatOverlayProvider } from '../modules/messages/ChatOverlay'
import { BottomNavTransitionProvider, useBottomNavTransition } from '../navigation/bottomNavTransition'
import { bottomNavIndexForPath } from '../navigation/navConfig'
import { BottomTabBar } from '../shared/ui/BottomTabBar'
import { useTheme } from '../theme'

function RootStack() {
  const t = useTheme()
  const pathname = usePathname()
  const { animation, resetAnimation } = useBottomNavTransition()

  useEffect(() => {
    if (animation === 'default') return
    const timer = setTimeout(resetAnimation, 450)
    return () => clearTimeout(timer)
  }, [animation, pathname, resetAnimation])

  return (
    <Stack screenOptions={{ headerShown: false, animation, contentStyle: { backgroundColor: t.bg } }} />
  )
}

function Gate() {
  const t = useTheme()
  const pathname = usePathname()
  const { ready, isLoggedIn } = useAuth()
  const showBottomNav = bottomNavIndexForPath(pathname) >= 0

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ChatOverlayProvider>
        <BottomNavTransitionProvider>
          <RootStack />
          {showBottomNav && <BottomTabBar />}
        </BottomNavTransitionProvider>
      </ChatOverlayProvider>
      {ready && !isLoggedIn && (
        <View style={StyleSheet.absoluteFill}>
          <LoginScreen />
        </View>
      )}
      {!ready && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', backgroundColor: t.bg, justifyContent: 'center' }]}>
          <ActivityIndicator color={t.accent} />
        </View>
      )}
    </View>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" translucent />
      <LocationProvider>
        <Gate />
      </LocationProvider>
    </AuthProvider>
  )
}
