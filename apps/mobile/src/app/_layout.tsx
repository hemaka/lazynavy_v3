import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as LocalAuthentication from 'expo-local-authentication'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { LocationProvider } from '../features/location/location-provider'
import { AuthProvider, LoginScreen, useAuth } from '../modules/identity/public'
import { loadProfileSettings } from '../modules/identity/settings/profileSettings'
import { ChatOverlayProvider } from '../modules/messages/ChatOverlay'
import { BottomNavTransitionProvider, useBottomNavTransition } from '../navigation/bottomNavTransition'
import { bottomNavIndexForPath } from '../navigation/navConfig'
import { BottomTabBar } from '../shared/ui/BottomTabBar'
import { useTheme } from '../theme'
import { I18nProvider, useI18n } from '../i18n'

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
      {ready && isLoggedIn && <AppLockGate />}
    </View>
  )
}

function AppLockGate() {
  const t = useTheme()
  const { text } = useI18n()
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [expectedPassword, setExpectedPassword] = useState('')
  const [error, setError] = useState('')
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const lockedRef = useRef(false)
  const authenticatingRef = useRef(false)
  const ignoreNextActiveRef = useRef(false)

  function setLockState(nextLocked: boolean) {
    lockedRef.current = nextLocked
    setLocked(nextLocked)
  }

  useEffect(() => {
    let lastState = AppState.currentState
    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (lastState.match(/inactive|background/) && nextState === 'active') {
        if (ignoreNextActiveRef.current || authenticatingRef.current || lockedRef.current) {
          ignoreNextActiveRef.current = false
          lastState = nextState
          return
        }
        const settings = await loadProfileSettings()
        const shouldLock = settings.appLockEnabled && settings.appLockPassword.trim().length > 0
        setExpectedPassword(settings.appLockPassword)
        setBiometricEnabled(settings.faceUnlockEnabled || settings.fingerprintUnlockEnabled)
        setPassword('')
        setError('')
        setLockState(shouldLock)
      }
      lastState = nextState
    })
    return () => subscription.remove()
  }, [])

  async function unlockWithBiometric() {
    if (authenticatingRef.current) return
    const hasHardware = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    if (!hasHardware || !enrolled) {
      setError(text('当前设备暂不支持可用的生物识别。'))
      return
    }
    authenticatingRef.current = true
    ignoreNextActiveRef.current = true
    setError('')
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: text('解锁 LazyNavy') })
      if (result.success) {
        setPassword('')
        setLockState(false)
      } else {
        setError(text('面部/指纹解锁未完成，请重试或输入保护密码。'))
      }
    } finally {
      authenticatingRef.current = false
      setTimeout(() => {
        ignoreNextActiveRef.current = false
      }, 700)
    }
  }

  function unlockWithPassword() {
    if (password === expectedPassword) {
      setLockState(false)
      setPassword('')
      return
    }
    setError(text('保护密码不正确'))
  }

  return (
    <Modal visible={locked} transparent animationType="fade">
      <View style={lockStyles.layer}>
        <View style={[lockStyles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[lockStyles.title, { color: t.text }]}>{text('输入保护密码')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={text('保护密码')}
            placeholderTextColor={t.textDim}
            style={[lockStyles.input, { backgroundColor: t.surfaceAlt, borderColor: t.border, color: t.text }]}
            onSubmitEditing={unlockWithPassword}
          />
          {error ? <Text style={[lockStyles.error, { color: t.danger }]}>{error}</Text> : null}
          <Pressable style={[lockStyles.primary, { backgroundColor: t.accent }]} onPress={unlockWithPassword}>
            <Text style={lockStyles.primaryText}>{text('解锁')}</Text>
          </Pressable>
          {biometricEnabled && (
            <Pressable style={[lockStyles.secondary, { borderColor: t.border }]} onPress={() => void unlockWithBiometric()}>
              <Text style={[lockStyles.secondaryText, { color: t.text }]}>{text('使用面部/指纹解锁')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <I18nProvider>
        <StatusBar style="dark" translucent />
        <LocationProvider>
          <Gate />
        </LocationProvider>
      </I18nProvider>
    </AuthProvider>
  )
}

const lockStyles = StyleSheet.create({
  layer: { flex: 1, backgroundColor: 'rgba(5,18,28,0.48)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 18, borderWidth: 0.5, padding: 18 },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 14 },
  input: { height: 46, borderRadius: 12, borderWidth: 0.5, paddingHorizontal: 12, fontSize: 16 },
  error: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  primary: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  secondary: { height: 44, borderRadius: 12, borderWidth: 0.5, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secondaryText: { fontSize: 14, fontWeight: '800' },
})
