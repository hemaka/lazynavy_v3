import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { AuthProvider, LoginScreen, useAuth } from '../modules/identity/public'
import { ChatOverlayProvider } from '../modules/messages/ChatOverlay'
import { useTheme } from '../theme'

function RootStack() {
  const t = useTheme()
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
  )
}

function Gate() {
  const t = useTheme()
  const { ready, isLoggedIn } = useAuth()

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ChatOverlayProvider>
        <RootStack />
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
      <Gate />
    </AuthProvider>
  )
}
