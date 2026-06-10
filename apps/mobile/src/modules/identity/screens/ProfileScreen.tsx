import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { getMyBadgesApi, setActiveBadgeApi } from '../api/client'
import { findBadge, SYSTEM_BADGE_CATALOG, type BadgeCatalogItem } from '../badges/catalog'
import { useTheme } from '../../../theme'

export function ProfileScreen() {
  const theme = useTheme()
  const params = useLocalSearchParams<{ panel?: string }>()
  const { isLoggedIn, user, ready, refreshUser, logout, token } = useAuth()
  const [authVisible, setAuthVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const openBadgePanel = params.panel === 'badges'

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
          <SignedInProfile
            user={user}
            token={token}
            autoOpenBadges={openBadgePanel}
            onUpdated={refreshUser}
            onLogout={() => void logout()}
            styles={styles}
          />
        ) : (
          <GuestProfile onLogin={() => setAuthVisible(true)} styles={styles} />
        )}
      </ScrollView>
      <AuthModal visible={authVisible} onClose={() => setAuthVisible(false)} />
    </View>
  )
}

function SignedInProfile({
  user,
  token,
  autoOpenBadges,
  onUpdated,
  onLogout,
  styles,
}: {
  user: AuthUser
  token: string | null
  autoOpenBadges: boolean
  onUpdated: () => Promise<void>
  onLogout: () => void
  styles: ReturnType<typeof createStyles>
}) {
  const avatar = user.avatar ?? user.avatarUrl
  const location = [user.region, user.country].filter(Boolean).join(' · ')
  const level = user.level ?? 1
  const xp = user.xp ?? 0
  const mileage = user.availableMileagePoints ?? 0
  const activeBadge = findBadge(user.activeBadgeId)
  const [badgeSheetVisible, setBadgeSheetVisible] = useState(false)
  const [savingBadgeId, setSavingBadgeId] = useState<string | null>(null)
  const [badgeError, setBadgeError] = useState<string | null>(null)
  const [availableBadgeIds, setAvailableBadgeIds] = useState<string[] | null>(null)
  const [loadingBadges, setLoadingBadges] = useState(false)

  const openBadgeSheet = useCallback(async () => {
    setBadgeSheetVisible(true)
    if (!token) return
    setLoadingBadges(true)
    setBadgeError(null)
    try {
      const response = await getMyBadgesApi(token)
      setAvailableBadgeIds(response.badges.map((badge) => badge.id))
    } catch {
      setBadgeError('徽章列表加载失败，请稍后再试。')
      setAvailableBadgeIds(null)
    } finally {
      setLoadingBadges(false)
    }
  }, [token])

  useEffect(() => {
    if (!autoOpenBadges) return
    void openBadgeSheet()
  }, [autoOpenBadges, openBadgeSheet])

  const selectBadge = useCallback(async (badgeId: string | null) => {
    if (!token) return
    setSavingBadgeId(badgeId ?? 'none')
    setBadgeError(null)
    try {
      await setActiveBadgeApi(token, badgeId)
      await onUpdated()
      setBadgeSheetVisible(false)
    } catch {
      setBadgeError('徽章保存失败，请稍后再试。')
    } finally {
      setSavingBadgeId(null)
    }
  }, [onUpdated, token])

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
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.name}>{user.nickname}</Text>
              {activeBadge && <Image source={activeBadge.image} style={styles.heroBadge} resizeMode="contain" />}
            </View>
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
          <MenuRow
            label="我的徽章"
            value={activeBadge?.title ?? '未佩戴'}
            accent={!!activeBadge}
            styles={styles}
            onPress={openBadgeSheet}
          />
          <InfoRow label="邮箱" value={user.email || '未设置'} styles={styles} />
          <InfoRow label="手机" value={user.phone || '未设置'} styles={styles} />
          <InfoRow label="航海经验" value={typeof user.sailingYears === 'number' ? `${user.sailingYears} 年` : '未设置'} styles={styles} />
          <InfoRow label="语言" value={user.uiLanguage || user.textLanguage || user.firstLanguage || '未设置'} styles={styles} />
        </View>

        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>退出登录</Text>
        </Pressable>
      </View>
      <BadgeSheet
        visible={badgeSheetVisible}
        activeBadgeId={user.activeBadgeId ?? null}
        availableBadgeIds={availableBadgeIds}
        loading={loadingBadges}
        savingBadgeId={savingBadgeId}
        error={badgeError}
        styles={styles}
        onClose={() => setBadgeSheetVisible(false)}
        onSelect={selectBadge}
      />
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

function MenuRow({
  label,
  value,
  accent,
  styles,
  onPress,
}: {
  label: string
  value: string
  accent?: boolean
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  return (
    <Pressable style={styles.infoRow} onPress={onPress}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.menuValueWrap}>
        <Text numberOfLines={1} style={[styles.infoValue, accent && styles.infoValueAccent]}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  )
}

function BadgeSheet({
  visible,
  activeBadgeId,
  availableBadgeIds,
  loading,
  savingBadgeId,
  error,
  styles,
  onClose,
  onSelect,
}: {
  visible: boolean
  activeBadgeId: string | null
  availableBadgeIds: string[] | null
  loading: boolean
  savingBadgeId: string | null
  error: string | null
  styles: ReturnType<typeof createStyles>
  onClose: () => void
  onSelect: (badgeId: string | null) => Promise<void>
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.badgeModalLayer}>
        <Pressable style={styles.badgeBackdrop} onPress={onClose} />
        <View style={styles.badgeSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.badgeSheetHeader}>
            <View>
              <Text style={styles.badgeSheetTitle}>我的徽章</Text>
              <Text style={styles.badgeSheetSubtitle}>选择一个已启用徽章展示在资料和需要露出的地方。</Text>
            </View>
            <Pressable style={styles.sheetClose} onPress={onClose}><Text style={styles.sheetCloseText}>×</Text></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.badgeList}>
            <BadgeCategory title="系统成就徽章" caption="当前开放" />
            {loading && <Text style={styles.badgeLoading}>正在同步徽章列表...</Text>}
            <View style={styles.badgeGrid}>
              {SYSTEM_BADGE_CATALOG.filter((badge) => !availableBadgeIds || availableBadgeIds.includes(badge.id)).map((badge) => (
                <BadgeOption
                  key={badge.id}
                  badge={badge}
                  active={activeBadgeId === badge.id}
                  saving={savingBadgeId === badge.id}
                  styles={styles}
                  onPress={() => void onSelect(badge.id)}
                />
              ))}
            </View>

            <Pressable style={styles.clearBadgeButton} onPress={() => void onSelect(null)} disabled={savingBadgeId === 'none'}>
              <Text style={styles.clearBadgeText}>{savingBadgeId === 'none' ? '保存中...' : '不佩戴徽章'}</Text>
            </Pressable>

            {error && <Text style={styles.badgeError}>{error}</Text>}

            <BadgeCategory title="用户自定义徽章" caption="上传与后台审批后开放" muted />
            <BadgeCategory title="组织徽章" caption="组织、旗帜和多人体系后续接入" muted />
            <BadgeCategory title="特殊徽章" caption="粉丝会、奖励和活动徽章会逐步加入" muted />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function BadgeCategory({ title, caption, muted }: { title: string; caption: string; muted?: boolean }) {
  return (
    <View style={{ marginTop: muted ? 14 : 0, marginBottom: 10 }}>
      <Text style={{ color: muted ? '#7c8a96' : '#123047', fontSize: 15, fontWeight: '900' }}>{title}</Text>
      <Text style={{ color: muted ? '#9aa8b4' : '#5f7d90', fontSize: 12, fontWeight: '600', marginTop: 3 }}>{caption}</Text>
    </View>
  )
}

function BadgeOption({
  badge,
  active,
  saving,
  styles,
  onPress,
}: {
  badge: BadgeCatalogItem
  active: boolean
  saving: boolean
  styles: ReturnType<typeof createStyles>
  onPress: () => void
}) {
  return (
    <Pressable style={[styles.badgeOption, active && styles.badgeOptionActive]} onPress={onPress} disabled={saving}>
      <Image source={badge.image} style={styles.badgeOptionImage} resizeMode="contain" />
      <Text numberOfLines={1} style={styles.badgeOptionTitle}>{badge.title}</Text>
      <Text numberOfLines={2} style={styles.badgeOptionDesc}>{badge.description}</Text>
      <View style={[styles.badgeState, active && styles.badgeStateActive]}>
        <Text style={[styles.badgeStateText, active && styles.badgeStateTextActive]}>{saving ? '保存中' : active ? '佩戴中' : '选择'}</Text>
      </View>
    </Pressable>
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
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    name: { flexShrink: 1, color: '#fff', fontSize: 24, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
    heroBadge: { width: 42, height: 42 },
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
    infoValueAccent: { color: t.accent, fontWeight: '800' },
    menuValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minWidth: 0 },
    chevron: { color: t.textDim, fontSize: 24, fontWeight: '600', lineHeight: 26 },
    logoutButton: { marginTop: 14, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 0.5, borderColor: 'rgba(248,113,113,0.28)' },
    logoutText: { color: t.danger, fontSize: 14, fontWeight: '700' },
    badgeModalLayer: { flex: 1, justifyContent: 'flex-end' },
    badgeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7, 20, 32, 0.38)' },
    badgeSheet: {
      maxHeight: '86%',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.border,
    },
    sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: t.borderStrong, marginBottom: 12 },
    badgeSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14 },
    badgeSheetTitle: { color: t.text, fontSize: 22, fontWeight: '900' },
    badgeSheetSubtitle: { color: t.textDim, fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 260 },
    sheetClose: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surfaceAlt },
    sheetCloseText: { color: t.text, fontSize: 22, fontWeight: '800', lineHeight: 24 },
    badgeList: { paddingBottom: 14 },
    badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    badgeOption: {
      width: '48%',
      minHeight: 188,
      padding: 10,
      borderRadius: 14,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
    },
    badgeOptionActive: { borderColor: t.accent, backgroundColor: 'rgba(0,119,182,0.08)' },
    badgeOptionImage: { width: 72, height: 72, marginBottom: 7 },
    badgeOptionTitle: { color: t.text, fontSize: 13, fontWeight: '900', maxWidth: '100%' },
    badgeOptionDesc: { color: t.textDim, fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 4, minHeight: 30 },
    badgeState: { marginTop: 9, minWidth: 62, height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,48,71,0.08)' },
    badgeStateActive: { backgroundColor: t.accent },
    badgeStateText: { color: t.textDim, fontSize: 11, fontWeight: '800' },
    badgeStateTextActive: { color: '#fff' },
    clearBadgeButton: { marginTop: 12, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,48,71,0.06)', borderWidth: 0.5, borderColor: t.border },
    clearBadgeText: { color: t.text, fontSize: 13, fontWeight: '800' },
    badgeError: { color: t.danger, fontSize: 12, fontWeight: '700', marginTop: 10 },
    badgeLoading: { color: t.textDim, fontSize: 12, fontWeight: '700', marginBottom: 10 },
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
