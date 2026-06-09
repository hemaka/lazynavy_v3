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
            <View style={styles.avatar}><Text style={styles.avatarText}>{hud.user.nickname.slice(0, 1)}</Text></View>
            <View style={styles.playerMain}>
              <View style={styles.playerRow}>
                <Text style={styles.playerName}>{hud.user.nickname}</Text>
                <Text style={styles.level}>LV {hud.user.level}</Text>
              </View>
              <View style={styles.xpTrack}><View style={[styles.xpFill, { width: `${xpPercent * 100}%` }]} /></View>
              <Text style={styles.title}>{hud.user.title} · {hud.user.availableMileagePoints} mi · {hud.user.pendingMileagePoints} pending</Text>
            </View>
            <Pressable style={styles.previewToggle} onPress={() => setEmptyPreview((value) => !value)}>
              <Text style={styles.previewText}>{emptyPreview ? 'HUD' : 'Empty'}</Text>
            </Pressable>
          </View>
        )}

        {hasBoat ? (
          <>
            <View style={styles.conditionRow}>
              {hud.weather.map((chip) => (
                <View key={chip.key} style={styles.conditionChip}>
                  <Text style={styles.conditionLabel}>{chip.label}</Text>
                  <Text style={styles.conditionValue}>{chip.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.boatNameWrap}>
              <Pressable style={styles.boatName} onPress={() => router.push('/boat/overview')}>
              <Text style={styles.boatNameText}>{hud.currentVessel?.name}</Text>
                <Text style={styles.boatNameSub}>LV {hud.currentVessel?.level} · {hud.currentVessel?.pendingMileagePoints ?? 0} pending miles</Text>
              </Pressable>
            </View>

            <View style={styles.crewStrip}>
              <Text style={styles.crewLabel}>Captain</Text>
              <Text style={styles.crewValue}>{hud.user?.nickname ?? 'You'}</Text>
              <View style={styles.crewDivider} />
              <Text style={styles.crewLabel}>Role</Text>
              <Text style={styles.crewValue}>{hud.currentVessel?.userRole}</Text>
              <View style={styles.crewDivider} />
              <Text style={styles.crewLabel}>Crew</Text>
              <Text style={styles.crewValue}>{hud.currentVessel?.crewCount}</Text>
            </View>

            {hud.activeVoyage?.needsConfirmation && (
              <Pressable style={styles.alert} onPress={() => router.push('/voyage')}>
                <Text style={styles.alertTitle}>Voyage plan needs confirmation</Text>
                <Text style={styles.alertText}>{hud.activeVoyage.name}</Text>
              </Pressable>
            )}

            <View style={styles.shortcutsLeft}>
              {hud.shortcuts.filter((item) => item.pinned).slice(0, 2).map((item) => <Shortcut key={item.key} item={item} />)}
            </View>
            <View style={styles.shortcutsRight}>
              {hud.shortcuts.filter((item) => item.pinned).slice(2, 4).map((item) => <Shortcut key={item.key} item={item} />)}
            </View>
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
          {bottomNav.map((item) => (
            <Pressable key={item.key} style={styles.navItem} onPress={() => router.push(item.href as never)}>
              <IconGlyph name={item.icon} color={colors.accent} size={16} />
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
      <IconGlyph name={item.icon} color={colors.accent} size={18} />
      <Text numberOfLines={1} style={styles.shortcutText}>{item.label}</Text>
    </Pressable>
  )
}

function Scene({ hasBoat, template }: { hasBoat: boolean; template: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[colors.skyTop, colors.skyBottom]} style={styles.sky} />
      <View style={[styles.sun, template === 'maintenance_yard' && styles.sunDim]} />
      <View style={styles.coastBack} />
      <View style={styles.coastFront} />
      <LinearGradient colors={[colors.sea, colors.seaDeep]} style={styles.water} />
      <View style={styles.waveOne} />
      <View style={styles.waveTwo} />
      {hasBoat && (
        <View style={styles.boat}>
          <View style={styles.sail} />
          <View style={styles.sailSmall} />
          <View style={styles.hull} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.skyBottom },
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sky: { position: 'absolute', top: 0, left: 0, right: 0, height: '58%' },
  sun: { position: 'absolute', top: 86, right: 34, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ffe58a', opacity: 0.9 },
  sunDim: { opacity: 0.45 },
  coastBack: { position: 'absolute', top: '42%', left: -20, width: width * 0.7, height: 84, borderTopRightRadius: 90, backgroundColor: colors.coast },
  coastFront: { position: 'absolute', top: '48%', right: -20, width: width * 0.72, height: 62, borderTopLeftRadius: 80, backgroundColor: colors.sand },
  water: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' },
  waveOne: { position: 'absolute', bottom: '31%', left: 28, width: 140, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.34)' },
  waveTwo: { position: 'absolute', bottom: '23%', right: 48, width: 180, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  boat: { position: 'absolute', left: width * 0.31, bottom: '31%', width: width * 0.38, height: 128 },
  sail: { position: 'absolute', left: 50, bottom: 44, width: 0, height: 0, borderLeftWidth: 0, borderRightWidth: 58, borderBottomWidth: 94, borderRightColor: 'transparent', borderBottomColor: colors.white },
  sailSmall: { position: 'absolute', left: 16, bottom: 44, width: 0, height: 0, borderLeftWidth: 34, borderRightWidth: 0, borderBottomWidth: 74, borderLeftColor: 'transparent', borderBottomColor: '#e8f7ff' },
  hull: { position: 'absolute', bottom: 22, left: 6, right: 0, height: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: '#f97316' },
  playerHud: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 18, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '900', fontSize: 18 },
  playerMain: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  level: { color: colors.accent, fontSize: 12, fontWeight: '900' },
  xpTrack: { height: 7, borderRadius: 4, backgroundColor: 'rgba(0,119,182,0.15)', overflow: 'hidden', marginTop: 5 },
  xpFill: { height: '100%', backgroundColor: colors.orange, borderRadius: 4 },
  title: { color: colors.muted, fontSize: 11, marginTop: 4, fontWeight: '700' },
  previewToggle: { width: 54, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,119,182,0.1)' },
  previewText: { color: colors.accent, fontWeight: '900', fontSize: 11 },
  conditionRow: { marginTop: 12, marginHorizontal: 16, flexDirection: 'row', gap: 8 },
  conditionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  conditionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  conditionValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  boatNameWrap: { position: 'absolute', left: 0, right: 0, top: '45%', alignItems: 'center' },
  boatName: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  boatNameText: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  boatNameSub: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  crewStrip: { position: 'absolute', left: 16, right: 16, bottom: 118, padding: 12, borderRadius: 18, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  crewLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  crewValue: { color: colors.ink, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  crewDivider: { width: 1, height: 20, backgroundColor: colors.line },
  alert: { position: 'absolute', left: 20, right: 20, bottom: 180, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,251,235,0.94)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)' },
  alertTitle: { color: colors.orange, fontSize: 12, fontWeight: '900' },
  alertText: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 2 },
  shortcutsLeft: { position: 'absolute', left: 14, top: '33%', gap: 10 },
  shortcutsRight: { position: 'absolute', right: 14, top: '33%', gap: 10 },
  shortcut: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  shortcutText: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 2, maxWidth: 50 },
  emptyActions: { position: 'absolute', left: 24, right: 24, top: '42%', alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 18 },
  emptyButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.accent, fontWeight: '900' },
  bottomNav: { position: 'absolute', left: 16, right: 16, bottom: 22, height: 70, borderRadius: 26, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { width: 72, height: 52, alignItems: 'center', justifyContent: 'center', gap: 4 },
  navText: { color: colors.ink, fontSize: 10, fontWeight: '900' },
})
