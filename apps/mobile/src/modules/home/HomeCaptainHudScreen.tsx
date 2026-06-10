import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { CaptainHudResponse } from '@lazynavy-v3/types'
import { IconGlyph } from '../../shared/ui/IconGlyph'
import { colors } from '../../theme/tokens'
import { findBadge } from '../identity/badges/catalog'
import { useChatOverlay } from '../messages/ChatOverlay'
import { createVessel, getCaptainHud } from './api'
import { fallbackHud } from './fallbackHud'

const { width, height } = Dimensions.get('window')
const HOME_CONTENT_INSET = 18
const hudBackground = require('../../assets/hud_bg_2.png')
const hudBackgroundWidth = height * (2250 / 1500)

export function HomeCaptainHudScreen() {
  const insets = useSafeAreaInsets()
  const [hud, setHud] = useState<CaptainHudResponse | null>(fallbackHud)
  const [loading, setLoading] = useState(false)
  const [emptyPreview, setEmptyPreview] = useState(false)
  const [crewSheetOpen, setCrewSheetOpen] = useState(false)
  const chatOverlay = useChatOverlay()

  useEffect(() => {
    let cancelled = false
    setHud(emptyPreview ? { ...fallbackHud, user: null, currentVessel: null, activeVoyage: null, shortcuts: [], sceneTemplate: 'empty_sea' } : fallbackHud)
    setLoading(false)
    getCaptainHud(emptyPreview)
      .then((next) => {
        if (!cancelled) setHud(next)
      })
      .catch(() => {
        if (!cancelled) setHud(emptyPreview ? { ...fallbackHud, user: null, currentVessel: null, activeVoyage: null, shortcuts: [], sceneTemplate: 'empty_sea' } : fallbackHud)
      })
    return () => {
      cancelled = true
    }
  }, [emptyPreview])

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

  if (!hud) {
    return (
      <LinearGradient colors={[colors.skyTop, colors.skyBottom]} style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </LinearGradient>
    )
  }

  const hasBoat = !!hud.currentVessel
  const topArea = Math.max(insets.top, 16) + 10
  const bottomArea = Math.max(insets.bottom, 10) + 10
  const weatherTop = topArea + 76
  const sideButtonTop = topArea + 176
  const alertBottom = bottomArea + 74
  const activeBadge = findBadge(hud.user?.activeBadgeId)

  return (
    <View style={styles.screen}>
      <Scene hasBoat={hasBoat} template={hud.sceneTemplate} />
      <View style={styles.safe}>
        {hud.user && (
          <View style={[styles.playerHud, { marginTop: topArea }]}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{hud.user.nickname.slice(0, 1)}</Text></View>
            </View>
            <View style={styles.playerMain}>
              <View style={styles.playerRow}>
                <Text numberOfLines={1} style={styles.playerName}>{hud.user.nickname}</Text>
              </View>
              <Text style={styles.xpText}>Lv. {hud.user.level} · {hud.user.xp.toLocaleString()} / {hud.user.nextLevelXp.toLocaleString()} XP</Text>
            </View>
            <Pressable
              style={styles.playerBadge}
              onPress={() => router.push('/profile?panel=badges' as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="打开我的徽章"
            >
              {activeBadge ? (
                <Image source={activeBadge.image} style={styles.playerBadgeImage} resizeMode="contain" />
              ) : (
                <Text style={styles.playerBadgeIcon}>✓</Text>
              )}
            </Pressable>
          </View>
        )}
        {hud.user && (
          <Pressable style={[styles.messageButton, { top: topArea }]} onPress={chatOverlay.openChat}>
            <ChatBubbleIcon />
            <View style={styles.messageDot} />
          </Pressable>
        )}

        {hasBoat && (
          <View style={[styles.conditionRow, { top: weatherTop }]}>
            {hud.weather.slice(0, 3).map((chip) => (
              <View key={chip.key} style={styles.conditionChip}>
                <Text style={styles.conditionGlyph}>{weatherGlyph(chip.key)}</Text>
                <Text style={styles.conditionValue}>{chip.value}</Text>
              </View>
            ))}
          </View>
        )}

        {hasBoat ? (
          <>
            <View style={styles.boatNameWrap}>
              <Pressable style={styles.vesselInfoCard} onPress={() => router.push('/boat/overview')}>
                <View style={styles.vesselPhoto}>
                  <Text style={styles.vesselPhotoIcon}>◢</Text>
                </View>
                <View style={styles.vesselInfoMain}>
                  <Text numberOfLines={1} style={styles.vesselNickname}>{hud.currentVessel?.name}</Text>
                  <Text numberOfLines={1} style={styles.vesselRegisteredName}>{vesselRegisteredName(hud)}</Text>
                </View>
                <Pressable style={styles.vesselCaptainAvatar} onPress={() => setCrewSheetOpen(true)}>
                  <Text style={styles.vesselCaptainText}>{(hud.user?.nickname ?? 'C').slice(0, 1)}</Text>
                </Pressable>
              </Pressable>
            </View>

            {crewSheetOpen && (
              <CrewSheet hud={hud} bottomOffset={bottomArea} onClose={() => setCrewSheetOpen(false)} />
            )}

            <Pressable style={[styles.alert, { bottom: alertBottom }]} onPress={() => router.push('/voyage')}>
              <View style={styles.alertIconWrap}><Text style={styles.alertIcon}>✧</Text></View>
              <View style={styles.alertMain}>
                <Text style={styles.alertTitle}>Voyage plan needs review</Text>
                <Text style={styles.alertText}>● 2 changes logged</Text>
              </View>
              <View style={styles.reviewButton}><Text style={styles.reviewText}>Review 〉</Text></View>
            </Pressable>

            <View style={[styles.shortcutsLeft, { top: sideButtonTop }]}>
              {hud.shortcuts.filter((item) => item.pinned).slice(0, 2).map((item) => <Shortcut key={item.key} item={item} />)}
            </View>
            <View style={[styles.shortcutsRight, { top: sideButtonTop }]}>
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

      </View>
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

function ChatBubbleIcon() {
  return (
    <View style={styles.chatBubbleIcon}>
      <View style={styles.chatBubbleTail} />
    </View>
  )
}

function CrewSheet({ hud, bottomOffset, onClose }: { hud: CaptainHudResponse; bottomOffset: number; onClose: () => void }) {
  const isCaptain = hud.currentVessel?.userRole === 'captain'
  const captainName = isCaptain ? (hud.user?.nickname ?? 'Captain') : 'Captain'
  const crewCount = hud.currentVessel?.crewCount ?? 1
  const otherCrewCount = isCaptain ? Math.max(crewCount - 1, 0) : Math.max(crewCount - 2, 0)

  return (
    <View style={styles.crewSheetLayer}>
      <Pressable style={styles.crewSheetBackdrop} onPress={onClose} />
      <View style={[styles.crewSheet, { marginBottom: bottomOffset + 86 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Crew</Text>
          <Pressable style={styles.sheetClose} onPress={onClose}><Text style={styles.sheetCloseText}>×</Text></Pressable>
        </View>
        <View style={styles.memberRow}>
          <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{captainName.slice(0, 1)}</Text></View>
          <View style={styles.memberMain}>
            <Text numberOfLines={1} style={styles.memberName}>{captainName}</Text>
            <Text style={styles.memberRole}>{isCaptain ? 'Captain · 我自己' : 'Captain'}</Text>
          </View>
        </View>
        {!isCaptain && (
          <View style={styles.memberRow}>
            <View style={styles.memberAvatarAlt}><Text style={styles.memberAvatarText}>Y</Text></View>
            <View style={styles.memberMain}>
              <Text numberOfLines={1} style={styles.memberName}>You</Text>
              <Text style={styles.memberRole}>{roleLabel(hud.currentVessel?.userRole ?? 'guest')}</Text>
            </View>
          </View>
        )}
        {otherCrewCount > 0 && (
          <View style={styles.memberRowMuted}>
            <Text style={styles.memberMutedText}>{otherCrewCount} more crew member(s)</Text>
          </View>
        )}
        {isCaptain && (
          <Pressable
            style={styles.inviteButton}
            onPress={() => {
              onClose()
              router.push('/boat/crew')
            }}
          >
            <Text style={styles.inviteButtonText}>Invite</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function Scene({ hasBoat, template }: { hasBoat: boolean; template: string }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={hudBackground} style={[styles.hudBackgroundImage, { width: hudBackgroundWidth, left: (width - hudBackgroundWidth) / 2 }]} />
      <LinearGradient colors={['rgba(0,132,216,0.08)', 'rgba(16,174,232,0.04)', 'rgba(3,86,116,0.18)']} style={StyleSheet.absoluteFill} />
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

function roleLabel(role: string) {
  return role.split('_').map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' ')
}

function vesselRegisteredName(hud: CaptainHudResponse) {
  return hud.currentVessel?.title || hud.currentVessel?.homePort || 'Registered vessel'
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0096d8' },
  safe: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hudBackgroundImage: { position: 'absolute', top: 0, height, resizeMode: 'stretch' },
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
  playerHud: { marginLeft: HOME_CONTENT_INSET, marginRight: 80, marginTop: 18, height: 44, paddingLeft: 0, paddingRight: 4, paddingVertical: 0, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)', flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#075985', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  avatarWrap: { width: 64, height: 64 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#bfe9ff', borderWidth: 1, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#075985', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  avatarText: { color: colors.ink, fontWeight: '900', fontSize: 22 },
  playerMain: { flex: 1 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 16 },
  playerName: { color: '#071735', fontSize: 13, fontWeight: '700', maxWidth: width * 0.56 },
  playerBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#008ba5', borderWidth: 1, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  playerBadgeImage: { width: 38, height: 38 },
  playerBadgeIcon: { color: colors.white, fontSize: 19, fontWeight: '900', lineHeight: 22 },
  xpText: { color: '#071735', fontSize: 9, fontWeight: '600', marginTop: 0 },
  previewToggle: { width: 54, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,119,182,0.1)' },
  previewText: { color: colors.accent, fontWeight: '900', fontSize: 11 },
  messageButton: { position: 'absolute', right: HOME_CONTENT_INSET, top: 38, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.76)', alignItems: 'center', justifyContent: 'center' },
  chatBubbleIcon: { width: 22, height: 17, borderRadius: 9, borderWidth: 2, borderColor: colors.white },
  chatBubbleTail: { position: 'absolute', right: 2, bottom: -5, width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.white, transform: [{ rotate: '32deg' }] },
  messageDot: { position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#ff4b3e', borderWidth: 2, borderColor: colors.white },
  vesselInfoCard: { minWidth: 244, maxWidth: width - 72, minHeight: 58, paddingLeft: 8, paddingRight: 8, paddingVertical: 7, borderRadius: 29, backgroundColor: 'rgba(244,252,255,0.82)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#075985', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  vesselPhoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,139,165,0.16)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.86)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vesselPhotoIcon: { color: '#008ba5', fontSize: 24, fontWeight: '900' },
  vesselInfoMain: { flex: 1, minWidth: 0 },
  vesselNickname: { color: '#071735', fontSize: 14, fontWeight: '900' },
  vesselRegisteredName: { color: '#0786a6', fontSize: 10, fontWeight: '900', marginTop: 3 },
  vesselCaptainAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#d9f2ff', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  vesselCaptainText: { color: '#071735', fontSize: 17, fontWeight: '900' },
  conditionRow: { position: 'absolute', left: 58, right: 58, top: 94, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  conditionChip: { minWidth: 82, height: 30, paddingHorizontal: 9, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  conditionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  conditionGlyph: { color: '#0786a6', fontSize: 17, fontWeight: '900' },
  conditionValue: { color: '#071735', fontSize: 11, fontWeight: '900' },
  boatNameWrap: { position: 'absolute', left: 0, right: 0, bottom: 238, alignItems: 'center' },
  boatName: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 17, backgroundColor: 'rgba(15,148,170,0.76)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
  boatNameText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  boatNameSub: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  crewStrip: { position: 'absolute', left: 18, right: 18, bottom: 154, height: 68, alignItems: 'center', justifyContent: 'center' },
  captainPill: { height: 58, minWidth: 178, maxWidth: width - 104, paddingLeft: 8, paddingRight: 18, borderRadius: 29, backgroundColor: 'rgba(240,250,255,0.9)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.88)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, shadowColor: '#075985', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  captainPillText: { minWidth: 90, maxWidth: width - 192 },
  crewProfile: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  crewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#d9f2ff', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  crewAvatarAlt: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#cce7ee', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  crewAvatarText: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  crewLabel: { color: '#0786a6', fontSize: 11, fontWeight: '900', marginTop: 2 },
  crewValue: { color: '#071735', fontSize: 11, fontWeight: '900' },
  crewRole: { fontWeight: '700' },
  crewDivider: { width: 1, height: 44, backgroundColor: 'rgba(14,116,144,0.18)' },
  crewAction: { width: 48, alignItems: 'center', justifyContent: 'center' },
  crewActionIcon: { color: '#071735', fontSize: 24, fontWeight: '900' },
  crewActionText: { color: '#071735', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  crewSheetLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, justifyContent: 'flex-end' },
  crewSheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,18,38,0.22)' },
  crewSheet: { marginHorizontal: 18, marginBottom: 104, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderRadius: 18, backgroundColor: 'rgba(244,252,255,0.97)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#062d45', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(14,116,144,0.22)', marginBottom: 10 },
  sheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { color: '#071735', fontSize: 17, fontWeight: '900' },
  sheetClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,116,144,0.08)' },
  sheetCloseText: { color: '#071735', fontSize: 22, fontWeight: '800', lineHeight: 24 },
  memberRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(14,116,144,0.12)' },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d9f2ff', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  memberAvatarAlt: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#cce7ee', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#071735', fontSize: 17, fontWeight: '900' },
  memberMain: { flex: 1 },
  memberName: { color: '#071735', fontSize: 14, fontWeight: '900' },
  memberRole: { color: '#0786a6', fontSize: 11, fontWeight: '900', marginTop: 2 },
  memberRowMuted: { minHeight: 34, justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(14,116,144,0.12)' },
  memberMutedText: { color: 'rgba(7,23,53,0.64)', fontSize: 12, fontWeight: '800' },
  inviteButton: { height: 44, borderRadius: 12, marginTop: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#008ba5' },
  inviteButtonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  alert: { position: 'absolute', left: 18, right: 18, bottom: 92, minHeight: 56, padding: 9, borderRadius: 28, backgroundColor: 'rgba(244,252,255,0.94)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#075985', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 7 } },
  alertIconWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  alertIcon: { color: '#fb6a21', fontSize: 31, fontWeight: '900' },
  alertMain: { flex: 1 },
  alertTitle: { color: '#071735', fontSize: 13, fontWeight: '900' },
  alertText: { color: '#071735', fontSize: 11, fontWeight: '800', marginTop: 3 },
  reviewButton: { minWidth: 88, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#008ba5' },
  reviewText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  shortcutsLeft: { position: 'absolute', left: 20, top: '23%', gap: 22 },
  shortcutsRight: { position: 'absolute', right: 20, top: '23%', gap: 22 },
  shortcut: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.88)' },
  shortcutText: { color: colors.ink, fontSize: 9, fontWeight: '800', marginTop: 2, maxWidth: 50 },
  emptyActions: { position: 'absolute', left: 24, right: 24, top: '42%', alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginBottom: 18 },
  emptyButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryText: { color: colors.white, fontWeight: '900' },
  secondaryBtn: { minWidth: 132, paddingVertical: 13, alignItems: 'center', borderRadius: 14, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  secondaryText: { color: colors.accent, fontWeight: '900' },
})
