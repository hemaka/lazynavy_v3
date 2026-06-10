import { LinearGradient } from 'expo-linear-gradient'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { AuthModal } from '../components/AuthModal'
import { useAuth } from '../context'
import type { AuthUser } from '../types'
import { useTheme } from '../../../theme'

export function ProfileScreen() {
  const theme = useTheme()
  const { isLoggedIn, user, ready, refreshUser, logout } = useAuth()
  const [authVisible, setAuthVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const styles = useMemo(() => createStyles(theme), [theme])

  const handleRefresh = useCallback(async () => {
    if (!isLoggedIn) return
    setRefreshing(true)
    try {
      await refreshUser()
    } finally {
      setRefreshing(false)
    }
  }, [isLoggedIn, refreshUser])

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={theme.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.accent} />}
      >
        {!ready ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : isLoggedIn && user ? (
          <SignedInProfile user={user} onLogout={() => void logout()} styles={styles} />
        ) : (
          <GuestProfile onLogin={() => setAuthVisible(true)} styles={styles} />
        )}
      </ScrollView>
      <AuthModal visible={authVisible} onClose={() => setAuthVisible(false)} />
    </View>
  )
}

function SignedInProfile({ user, onLogout, styles }: { user: AuthUser; onLogout: () => void; styles: ReturnType<typeof createStyles> }) {
  const avatar = user.avatar ?? user.avatarUrl
  const location = [user.region, user.country].filter(Boolean).join(' · ')
  const level = user.level ?? 1
  const xp = user.xp ?? 0
  const mileage = user.availableMileagePoints ?? 0

  return (
    <>
      <View style={styles.hero}>
        {user.coverImage ? (
          <Image source={{ uri: user.coverImage }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#0e7490', '#38bdf8', '#f8fafc']} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.coverShade} />
        <View style={styles.profileHead}>
          <View style={styles.avatar}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initial(user.nickname)}</Text>
            )}
          </View>
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.name}>{user.nickname}</Text>
            <Text numberOfLines={1} style={styles.meta}>{location || '地区未设置'}</Text>
            <View style={styles.factRow}>
              <Text style={[styles.gender, { color: genderColor(user.gender) }]}>{genderIcon(user.gender)}</Text>
              <Text style={styles.fact}>{ageText(user.birthDate)}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.bio}>{user.bio?.trim() || '还没有填写个人简介。'}</Text>

        <View style={styles.statsRow}>
          <Stat label="等级" value={`Lv.${level}`} styles={styles} />
          <View style={styles.statDivider} />
          <Stat label="经验" value={xp.toLocaleString()} styles={styles} />
          <View style={styles.statDivider} />
          <Stat label="里程点" value={mileage.toLocaleString()} styles={styles} />
        </View>

        <View style={styles.infoPanel}>
          <InfoRow label="邮箱" value={user.email || '未设置'} styles={styles} />
          <InfoRow label="手机" value={user.phone || '未设置'} styles={styles} />
          <InfoRow label="航海经验" value={typeof user.sailingYears === 'number' ? `${user.sailingYears} 年` : '未设置'} styles={styles} />
          <InfoRow label="语言" value={user.uiLanguage || user.textLanguage || user.firstLanguage || '未设置'} styles={styles} />
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>
      </View>
    </>
  )
}

function GuestProfile({ onLogin, styles }: { onLogin: () => void; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.guestCard}>
      <View style={styles.guestAvatar}>
        <Text style={styles.guestAvatarText}>◎</Text>
      </View>
      <Text style={styles.guestTitle}>登录后查看我的资料</Text>
      <Text style={styles.guestSubtitle}>同步你的头像、昵称和账号信息，之后这里会承接 v2 的个人资料展示。</Text>
      <Pressable style={styles.loginButton} onPress={onLogin}>
        <Text style={styles.loginButtonText}>登录 / 注册</Text>
      </Pressable>
    </View>
  )
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.statItem}>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function InfoRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function initial(name?: string | null) {
  return (name?.trim().slice(0, 1) || '我').toUpperCase()
}

function genderIcon(gender?: string | null) {
  if (gender === 'male') return '♂'
  if (gender === 'female') return '♀'
  return '○'
}

function genderColor(gender?: string | null) {
  if (gender === 'male') return '#38bdf8'
  if (gender === 'female') return '#f472b6'
  return 'rgba(255,255,255,0.78)'
}

function ageText(birthDate?: string | null) {
  const age = calculateAge(birthDate)
  return age === null ? '年龄保密' : `${age} 岁`
}

function calculateAge(birthDate?: string | null) {
  const match = String(birthDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  const today = new Date()
  let age = today.getFullYear() - Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (today.getMonth() < month || (today.getMonth() === month && today.getDate() < day)) age -= 1
  return age >= 0 && age <= 120 ? age : null
}

function createStyles(t: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    content: { paddingBottom: 120 },
    loading: { minHeight: 360, alignItems: 'center', justifyContent: 'center' },
    hero: { height: 292, backgroundColor: t.elevated, overflow: 'hidden' },
    coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,20,32,0.28)' },
    profileHead: { position: 'absolute', left: 18, right: 18, bottom: 22, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.86)',
      backgroundColor: 'rgba(14,116,144,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
    identity: { flex: 1, paddingBottom: 4 },
    name: { color: '#fff', fontSize: 24, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
    meta: { color: 'rgba(255,255,255,0.84)', fontSize: 13, marginTop: 5, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 5 },
    factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    gender: { fontSize: 24, fontWeight: '900', lineHeight: 28, textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 4 },
    fact: { color: '#fff', fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.28)', textShadowRadius: 4 },
    body: { paddingHorizontal: 16, paddingTop: 16 },
    bio: { color: t.text, fontSize: 14, lineHeight: 21, marginBottom: 14 },
    statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
    statItem: { flex: 1, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4 },
    statDivider: { width: 0.5, height: 30, backgroundColor: t.border },
    statValue: { color: t.text, fontSize: 16, fontWeight: '800', maxWidth: '100%' },
    statLabel: { color: t.textDim, fontSize: 11, marginTop: 4 },
    infoPanel: { backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, borderRadius: 14, overflow: 'hidden' },
    infoRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 0.5, borderBottomColor: t.border },
    infoLabel: { width: 84, color: t.textDim, fontSize: 13 },
    infoValue: { flex: 1, color: t.text, fontSize: 14, fontWeight: '600', textAlign: 'right' },
    logoutButton: { marginTop: 14, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.28)' },
    logoutText: { color: t.danger, fontSize: 14, fontWeight: '700' },
    guestCard: {
      marginHorizontal: 16,
      marginTop: 86,
      padding: 20,
      borderRadius: 20,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    guestAvatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: t.elevated, borderWidth: 0.5, borderColor: t.border, marginBottom: 16 },
    guestAvatarText: { color: t.textDim, fontSize: 32, fontWeight: '800' },
    guestTitle: { color: t.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    guestSubtitle: { color: t.textDim, fontSize: 14, lineHeight: 21, marginBottom: 18 },
    loginButton: { alignSelf: 'flex-start', borderRadius: 12, backgroundColor: t.accent, paddingHorizontal: 20, paddingVertical: 11 },
    loginButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  })
}
