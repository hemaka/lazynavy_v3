import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { CaptainHudResponse } from '@lazynavy-v3/types'
import { SyncStatusBar } from '../../features/offline/SyncStatusBar'
import { bottomNav } from '../../navigation/navConfig'
import { IconGlyph } from '../../shared/ui/IconGlyph'
import { colors } from '../../theme/tokens'
import { createVessel, getCaptainHud } from './api'
import { fallbackHud } from './fallbackHud'

const { width } = Dimensions.get('window')

export function HomeCaptainHudScreen() {
  const [hud, setHud] = useState<CaptainHudResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [emptyPreview, setEmptyPreview] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCaptainHud(emptyPreview)
      .then((next) => {
        if (!cancelled) setHud(next)
      })
      .catch(() => {
        if (!cancelled) setHud(emptyPreview ? { ...fallbackHud, user: null, currentVessel: null, activeVoyage: null, shortcuts: [], sceneTemplate: 'empty_sea' } : fallbackHud)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [emptyPreview])

  const xpPercent = useMemo(() => {
    if (!hud?.user) return 0
    return Math.min(1, hud.user.xp / Math.max(hud.user.nextLevelXp, 1))
  }, [hud])

  async function handleCreateBoat() {
    try {
      await createVessel('Morning Star')
      setEmptyPreview(false)
      setHud(await getCaptainHud(false))
    } catch {
      setHud(fallbackHud)
      setEmptyPreview(false)
    }
  }

  if (!hud || loading) {
    return (
      <LinearGradient colors={[colors.skyTop, colors.skyBottom]} style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </LinearGradient>
    )
  }

  const hasBoat = !!hud.currentVessel

  return (
    <View style={styles.screen}>
      <Scene hasBoat={hasBoat} template={hud.sceneTemplate} />
      <SafeAreaView style={styles.safe}>
        {hud.user && (
          <View style={styles.playerHud}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{hud.user.nickname.slice(0, 1)}</Text></View>
              <View style={styles.rankBadge}><Text style={styles.rankText}>⚓</Text></View>
            </View>
            <View style={styles.playerMain}>
              <View style={styles.playerRow}>
                <Text numberOfLines={1} style={styles.playerName}>{hud.user.nickname}</Text>
                <Text style={styles.level}>Lv. {hud.user.level}</Text>
              </View>
              <Text style={styles.xpText}>{hud.user.xp.toLocaleString()} / {hud.user.nextLevelXp.toLocaleString()} XP</Text>
              <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpPercent * 100}%` }]} /></View>
            </View>
          </View>
        )}
        {hud.user && (
          <Pressable style={styles.messageButton} onPress={() => router.push('/boat/crew')}>
            <Text style={styles.messageIcon}>▱</Text>
            <View style={styles.messageDot} />
          </Pressable>
        )}

        {hasBoat ? (
          <>
            <View style={styles.boatNameWrap}>
              <Pressable style={styles.boatName} onPress={() => router.push('/boat/overview')}>
                <Text style={styles.boatNameText}>{hud.currentVessel?.name}⌄</Text>
              </Pressable>
            </View>

            <View style={styles.conditionRow}>
              {hud.weather.slice(0, 3).map((chip) => (
                <View key={chip.key} style={styles.conditionChip}>
                  <Text style={styles.conditionGlyph}>{weatherGlyph(chip.key)}</Text>
                  <Text style={styles.conditionValue}>{chip.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.crewStrip}>
              <View style={styles.crewProfile}>
                <View style={styles.crewAvatar}><Text style={styles.crewAvatarText}>⚓</Text></View>
                <View>
                  <Text style={styles.crewValue}>Captain {hud.user?.nickname ?? 'You'}</Text>
                  <Text style={styles.crewLabel}>Captain</Text>
                </View>
              </View>
              <View style={styles.crewDivider} />
              <View style={styles.crewProfile}>
                <View style={styles.crewAvatarAlt}><Text style={styles.crewAvatarText}>◌</Text></View>
                <View>
                  <Text style={styles.crewValue}>You: <Text style={styles.crewRole}>{hud.currentVessel?.userRole}</Text></Text>
                  <Text style={styles.crewLabel}>♨</Text>
                </View>
              </View>
              <View style={styles.crewDivider} />
              <Pressable style={styles.crewAction} onPress={() => router.push('/boat/crew')}>
                <Text style={styles.crewActionIcon}>♙</Text>
                <Text style={styles.crewActionText}>{hud.currentVessel?.crewCount} crew</Text>
              </Pressable>
              <View style={styles.crewDivider} />
              <Pressable style={styles.crewAction} onPress={() => router.push('/boat/crew')}>
                <Text style={styles.crewActionIcon}>＋</Text>
                <Text style={styles.crewActionText}>Invite</Text>
              </Pressable>
            </View>

            {hud.activeVoyage?.needsConfirmation && (
              <Pressable style={styles.alert} onPress={() => router.push('/voyage')}>
                <View style={styles.alertIconWrap}><Text style={styles.alertIcon}>✧</Text></View>
                <View style={styles.alertMain}>
                  <Text style={styles.alertTitle}>Voyage plan needs review</Text>
                  <Text style={styles.alertText}>● 2 changes logged</Text>
                </View>
                <View style={styles.reviewButton}><Text style={styles.reviewText}>Review 〉</Text></View>
              </Pressable>
            )}

            <View style={styles.shortcutsLeft}>
              {hud.shortcuts.filter((item) => item.pinned).slice(0, 2).map((item) => <Shortcut key={item.key} item={item} />)}
            </View>
            <View style={styles.shortcutsRight}>
              {hud.shortcuts.filter((item) => item.pinned).slice(2, 4).map((item) => <Shortcut key={item.key} item={item} />)}
            </View>
            <View style={styles.syncWrap}><SyncStatusBar /></View>
          </>
        ) : (
          <View style={styles.emptyActions}>
            <Text style={styles.emptyTitle}>Open sea is ready</Text>
            <View style={styles.emptyButtons}>
              <Pressable style={styles.primaryBtn} onPress={handleCreateBoat}><Text style={styles.primaryText}>Create Boat</Text></Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push('/boat/join')}><Text style={styles.secondaryText}>Join Boat</Text></Pressable>
            </View>
          </View>
        )}

        <View style={styles.bottomNav}>
          {bottomNav.slice(0, 3).map((item) => (
            <Pressable key={item.key} style={styles.navItem} onPress={() => router.push(item.href as never)}>
              <IconGlyph name={item.icon} color={colors.accent} size={26} />
              <Text style={styles.navText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  )
}

function Shortcut({ item }: { item: { href: string; icon: string; label: string } }) {
  return (
    <Pressable style={styles.shortcut} onPress={() => router.push(item.href as never)}>
      <IconGlyph name={item.icon} color={colors.white} size={30} />
    </Pressable>
  )
}

function Scene({ hasBoat, template }: { hasBoat: boolean; template: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#0084d8', '#10aee8', '#7de3ff']} style={styles.sky} />
      <View style={[styles.sun, template === 'maintenance_yard' && styles.sunDim]} />
      <View style={[styles.cloud, styles.cloudOne]}><View style={styles.cloudPuffA} /><View style={styles.cloudPuffB} /><View style={styles.cloudPuffC} /></View>
      <View style={[styles.cloud, styles.cloudTwo]}><View style={styles.cloudPuffA} /><View style={styles.cloudPuffB} /><View style={styles.cloudPuffC} /></View>
      <Text style={styles.gullOne}>⌁</Text>
      <Text style={styles.gullTwo}>⌁</Text>
      <View style={styles.coastBack} />
      <View style={styles.coastFront} />
      <View style={styles.harborTown}>
        {Array.from({ length: 9 }).map((_, index) => <View key={index} style={[styles.house, { left: index * 36, top: index % 3 * 13 }]} />)}
      </View>
      <LinearGradient colors={['#18c4dc', '#03a7cb', '#087a96']} style={styles.water} />
      <View style={styles.waterShineA} />
      <View style={styles.waterShineB} />
      <View style={styles.waterShineC} />
      <View style={styles.waveOne} />
      <View style={styles.waveTwo} />
      {hasBoat && (
        <View style={styles.boat}>
          <View style={styles.mast} />
          <View style={styles.riggingLeft} />
          <View style={styles.riggingRight} />
          <View style={styles.sail} />
          <View style={styles.sailSmall} />
          <View style={styles.cabin} />
          <View style={styles.hull} />
        </View>
      )}
    </View>
  )
}

function weatherGlyph(key: string) {
  if (key.includes('wind')) return '≋'
  if (key.includes('wave')) return '≋'
  if (key.includes('rain')) return '☂'
  return '☼'
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0096d8' },
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: '62%' },
  sun: { position: 'absolute', top: 96, right: 44, width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,246,173,0.72)' },
  sunDim: { opacity: 0.45 },
  cloud: { position: 'absolute', width: 116, height: 42 },
  cloudOne: { top: '20%', right: 28 },
  cloudTwo: { top: '28%', left: 122, transform: [{ scale: 0.72 }] },
  cloudPuffA: { position: 'absolute', left: 0, bottom: 0, width: 56, height: 28, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.86)' },
  cloudPuffB: { position: 'absolute', left: 33, bottom: 6, width: 48, height: 36, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.94)' },
  cloudPuffC: { position: 'absolute', left: 68, bottom: 0, width: 48, height: 25, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.86)' },
  gullOne: { position: 'absolute', top: '27%', left: '29%', color: colors.white, fontSize: 34, fontWeight: '900', transform: [{ rotate: '-18deg' }] },
  gullTwo: { position: 'absolute', top: '33%', right: '34%', color: 'rgba(255,255,255,0.86)', fontSize: 22, fontWeight: '900', transform: [{ rotate: '12deg' }] },
  coastBack: { position: 'absolute', top: '39%', left: -42, width: width * 0.82, height: 118, borderTopRightRadius: 160, backgroundColor: '#2f8e54', transform: [{ rotate: '-4deg' }] },
  coastFront: { position: 'absolute', top: '44%', left: -30, width: width * 0.92, height: 96, borderTopRightRadius: 140, backgroundColor: '#87b76b', transform: [{ rotate: '-3deg' }] },
  harborTown: { position: 'absolute', top: '43%', left: 0, width: width, height: 90 },
  house: { position: 'absolute', width: 28, height: 24, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.92)', borderTopWidth: 6, borderTopColor: '#f97316' },
  water: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  waterShineA: { position: 'absolute', bottom: '35%', left: -30, width: width * 0.95, height: 70, borderRadius: 35, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '-8deg' }] },
  waterShineB: { position: 'absolute', bottom: '26%', right: -60, width: width * 1.05, height: 86, borderRadius: 43, borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '8deg' }] },
  waterShineC: { position: 'absolute', bottom: '18%', left: -80, width: width * 1.2, height: 92, borderRadius: 46, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', transform: [{ rotate: '-5deg' }] },
  waveOne: { position: 'absolute', bottom: '31%', left: 28, width: 154, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.34)' },
  waveTwo: { position: 'absolute', bottom: '23%', right: 48, width: 190, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  boat: { position: 'absolute', left: width * 0.25, bottom: '34%', width: width * 0.5, height: 238 },
  mast: { position: 'absolute', left: '50%', bottom: 48, width: 2, height: 205, backgroundColor: 'rgba(255,255,255,0.96)' },
  riggingLeft: { position: 'absolute', left: '29%', bottom: 48, width: 1, height: 182, backgroundColor: 'rgba(255,255,255,0.78)', transform: [{ rotate: '10deg' }] },
  riggingRight: { position: 'absolute', right: '28%', bottom: 48, width: 1, height: 188, backgroundColor: 'rgba(255,255,255,0.78)', transform: [{ rotate: '-10deg' }] },
  sail: { position: 'absolute', left: '50%', bottom: 66, width: 0, height: 0, borderLeftWidth: 0, borderRightWidth: 58, borderBottomWidth: 112, borderRightColor: 'transparent', borderBottomColor: 'rgba(255,255,255,0.92)' },
  sailSmall: { position: 'absolute', left: '24%', bottom: 66, width: 0, height: 0, borderLeftWidth: 48, borderRightWidth: 0, borderBottomWidth: 94, borderLeftColor: 'transparent', borderBottomColor: 'rgba(232,247,255,0.94)' },
  cabin: { position: 'absolute', left: '34%', right: '24%', bottom: 42, height: 22, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)' },
  hull: { position: 'absolute', bottom: 26, left: '18%', right: '11%', height: 30, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 4, borderBottomColor: '#0f5471' },
  playerHud: { marginLeft: 18, marginRight: 92, marginTop: 8, minHeight: 68, paddingLeft: 66, paddingRight: 12, paddingVertical: 9, borderRadius: 22, backgroundColor: 'rgba(235,248,255,0.88)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.82)', flexDirection: 'row', alignItems: 'center', shadowColor: '#075985', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  avatarWrap: { position: 'absolute', left: -6, top: -7, width: 76, height: 76 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#bfe9ff', borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#075985', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  avatarText: { color: colors.ink, fontWeight: '900', fontSize: 26 },
  rankBadge: { position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 9, backgroundColor: colors.ink, borderWidth: 3, borderColor: '#fbbf24', alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#fbbf24', fontSize: 16, fontWeight: '900' },
  playerMain: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
  playerName: { color: '#071735', fontSize: 16, fontWeight: '900', maxWidth: width * 0.22 },
  level: { color: '#071735', fontSize: 11, fontWeight: '900', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(18,48,71,0.18)', overflow: 'hidden' },
  xpText: { color: '#071735', fontSize: 12, fontWeight: '900', marginTop: 3 },
  xpTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(14,116,144,0.22)', overflow: 'hidden', marginTop: 6, maxWidth: width * 0.44 },
  xpFill: { height: '100%', backgroundColor: '#10b8bd', borderRadius: 2 },
  previewToggle: { width: 54, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,119,182,0.1)' },
  previewText: { color: colors.accent, fontWeight: '900', fontSize: 11 },
  messageButton: { position: 'absolute', right: 22, top: 18, width: 54, height: 54, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.35)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.86)', alignItems: 'center', justifyContent: 'center' },
  messageIcon: { color: colors.white, fontSize: 30, fontWeight: '900', transform: [{ rotate: '90deg' }] },
  messageDot: { position: 'absolute', right: -4, top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff4b3e', borderWidth: 2, borderColor: colors.white },
  conditionRow: { position: 'absolute', left: 72, right: 72, bottom: 197, flexDirection: 'row', justifyContent: 'center', gap: 14 },
  conditionChip: { minWidth: 102, height: 37, paddingHorizontal: 12, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  conditionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  conditionGlyph: { color: '#0786a6', fontSize: 22, fontWeight: '900' },
  conditionValue: { color: '#071735', fontSize: 13, fontWeight: '900' },
  boatNameWrap: { position: 'absolute', left: 0, right: 0, bottom: 244, alignItems: 'center' },
  boatName: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 7, borderRadius: 18, backgroundColor: 'rgba(15,148,170,0.76)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  boatNameText: { color: colors.white, fontSize: 18, fontWeight: '900' },
  boatNameSub: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  crewStrip: { position: 'absolute', left: 18, right: 18, bottom: 112, minHeight: 72, paddingHorizontal: 10, borderRadius: 20, backgroundColor: 'rgba(240,250,255,0.92)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#075985', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  crewProfile: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  crewAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#d9f2ff', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  crewAvatarAlt: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#cce7ee', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  crewAvatarText: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  crewLabel: { color: '#0786a6', fontSize: 12, fontWeight: '900', marginTop: 2 },
  crewValue: { color: '#071735', fontSize: 12, fontWeight: '900' },
  crewRole: { fontWeight: '700' },
  crewDivider: { width: 1, height: 44, backgroundColor: 'rgba(14,116,144,0.18)' },
  crewAction: { width: 48, alignItems: 'center', justifyContent: 'center' },
  crewActionIcon: { color: '#071735', fontSize: 24, fontWeight: '900' },
  crewActionText: { color: '#071735', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  alert: { position: 'absolute', left: 18, right: 18, bottom: 24 + 76 + 12, minHeight: 62, padding: 10, borderRadius: 18, backgroundColor: 'rgba(244,252,255,0.94)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#075985', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  alertIconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  alertIcon: { color: '#fb6a21', fontSize: 34, fontWeight: '900' },
  alertMain: { flex: 1 },
  alertTitle: { color: '#071735', fontSize: 14, fontWeight: '900' },
  alertText: { color: '#071735', fontSize: 12, fontWeight: '800', marginTop: 3 },
  reviewButton: { minWidth: 98, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#008ba5' },
  reviewText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  shortcutsLeft: { position: 'absolute', left: 20, top: '22%', gap: 30 },
  shortcutsRight: { position: 'absolute', right: 20, top: '22%', gap: 30 },
  shortcut: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.88)' },
  shortcutText: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 2, maxWidth: 50 },
  syncWrap: { position: 'absolute', left: 2, right: 2, bottom: 184, opacity: 0.78 },
  emptyActions: { position: 'absolute', left: 24, right: 24, top: '42%', alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 18 },
  emptyButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.accent, fontWeight: '900' },
  bottomNav: { position: 'absolute', left: 18, right: 18, bottom: 18, height: 76, borderRadius: 20, backgroundColor: 'rgba(244,252,255,0.94)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.88)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#075985', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  navItem: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 3, borderRightWidth: 1, borderRightColor: 'rgba(14,116,144,0.16)' },
  navText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
})
