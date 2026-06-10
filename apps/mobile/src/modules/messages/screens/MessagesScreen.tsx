import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { AuthModal } from '../../identity/components/AuthModal'
import { useAuth } from '../../identity/public'
import type { ChatRoom } from '../api/client'
import { getOrCreateLocationRoomApi, listChatRoomsApi, NEARBY_LOCATION_ROOMS } from '../api/client'
import { formatChatTime, hueForId, lastMessagePreview, roomInitial, roomSubtitle, roomTitle, roomTypeBadge } from '../utils/present'
import { useTheme } from '../../../theme'

function hslColor(hue: number) {
  return `hsl(${hue}, 55%, 30%)`
}

export default function MessagesScreen({
  onClose,
  onOpenRoom,
  floating = false,
}: {
  onClose?: () => void
  onOpenRoom?: (roomId: string) => void
  floating?: boolean
} = {}) {
  const t = useTheme()
  const { token, user, ready } = useAuth()
  const [authVisible, setAuthVisible] = useState(false)
  const [rooms, setRooms] = useState<ChatRoom[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const totalUnread = useMemo(() => rooms.reduce((sum, room) => sum + room.unreadCount, 0), [rooms])
  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: floating ? 18 : 16, paddingBottom: 14 },
    headerMain: { flex: 1, minWidth: 0 },
    title: { color: t.text, fontSize: 28, fontWeight: '800' },
    subtitle: { color: t.textSoft, fontSize: 11, fontWeight: '700', marginTop: 4 },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border },
    closeText: { color: t.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
    sectionLabel: { color: t.textDim, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginHorizontal: 16, marginBottom: 10 },
    nearbyList: { paddingHorizontal: 16, gap: 10, paddingBottom: 18 },
    nearbyCard: { width: 168, minHeight: 104, padding: 14, borderRadius: 16, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border },
    nearbyPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: t.accentSoft, marginBottom: 8 },
    nearbyPillText: { color: t.accent, fontSize: 10, fontWeight: '800' },
    nearbyTitle: { color: t.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
    nearbyMeta: { color: t.textDim, fontSize: 12, marginTop: 8 },
    roomCard: { marginHorizontal: 12, borderRadius: 18, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    avatarWrap: { position: 'relative', marginRight: 12 },
    avatar: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    unreadDot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: t.danger, borderWidth: 2, borderColor: t.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    unreadText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    rowBody: { flex: 1, minWidth: 0 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    badge: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: t.accentSoft },
    badgeText: { color: t.accent, fontSize: 10, fontWeight: '800' },
    rowName: { flex: 1, color: t.text, fontSize: 15, fontWeight: '800' },
    rowTime: { color: t.textSoft, fontSize: 10 },
    rowLast: { color: t.textDim, fontSize: 13, marginTop: 4 },
    divider: { height: 0.5, backgroundColor: t.border, marginLeft: 74 },
    stateWrap: { marginHorizontal: 12, padding: 24, borderRadius: 18, backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border, alignItems: 'center', gap: 12 },
    stateTitle: { color: t.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
    stateText: { color: t.textDim, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    stateBtn: { backgroundColor: t.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    stateBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    bottomSpacer: { height: floating ? 18 : 28 },
  }), [t])

  async function load(mode: 'initial' | 'refresh' = 'initial') {
    if (!token) {
      setRooms([])
      return
    }
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      setRooms(await listChatRoomsApi(token))
    } catch (err: any) {
      setError(err?.message ?? '聊天加载失败')
    } finally {
      if (mode === 'refresh') setRefreshing(false)
      else setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => {
    if (ready && token) void load('initial')
  }, [ready, token]))

  async function openNearby(item: (typeof NEARBY_LOCATION_ROOMS)[number]) {
    if (!token) {
      setAuthVisible(true)
      return
    }
    setOpeningId(item.sourceId)
    try {
      const room = await getOrCreateLocationRoomApi(token, item)
      if (onOpenRoom) onOpenRoom(room.id)
      else router.push(`/chat/${room.id}`)
    } catch (err: any) {
      Alert.alert('进入房间失败', err?.message ?? '请稍后重试')
    } finally {
      setOpeningId(null)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={t.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.title}>消息</Text>
            <Text style={styles.subtitle}>{token ? `${rooms.length} ROOMS · ${totalUnread} NEW` : 'SIGN IN TO CHAT'}</Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose ?? (() => router.replace('/'))}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        {!ready || loading ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={t.accent} />
            <Text style={styles.stateText}>正在读取聊天房间...</Text>
          </View>
        ) : !token ? (
          <View style={styles.stateWrap}>
            <Text style={styles.stateTitle}>登录后开启聊天</Text>
            <Text style={styles.stateText}>进入地域房间，和船友同步航行协作消息。</Text>
            <Pressable style={styles.stateBtn} onPress={() => setAuthVisible(true)}>
              <Text style={styles.stateBtnText}>登录 / 注册</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>ROOMS · 地域房间</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyList}>
              {NEARBY_LOCATION_ROOMS.map((item) => (
                <Pressable key={item.sourceId} style={styles.nearbyCard} onPress={() => void openNearby(item)}>
                  <View style={styles.nearbyPill}><Text style={styles.nearbyPillText}>{item.geoRegion?.toUpperCase()}</Text></View>
                  <Text style={styles.nearbyTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.nearbyMeta}>{openingId === item.sourceId ? 'opening...' : '进入房间'}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>RECENT · 最近</Text>
            {error ? (
              <View style={styles.stateWrap}>
                <Text style={styles.stateTitle}>聊天加载失败</Text>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable style={styles.stateBtn} onPress={() => void load('initial')}>
                  <Text style={styles.stateBtnText}>重试</Text>
                </Pressable>
              </View>
            ) : rooms.length === 0 ? (
              <View style={styles.stateWrap}>
                <Text style={styles.stateTitle}>还没有聊天</Text>
                <Text style={styles.stateText}>从上方地域房间进入一个频道，开始第一条消息。</Text>
              </View>
            ) : (
              <View style={styles.roomCard}>
                {rooms.map((room, index) => {
                  const title = roomTitle(room, user?.id)
                  return (
                    <View key={room.id}>
                      <Pressable style={styles.row} onPress={() => onOpenRoom ? onOpenRoom(room.id) : router.push(`/chat/${room.id}`)}>
                        <View style={styles.avatarWrap}>
                          <View style={[styles.avatar, { backgroundColor: hslColor(hueForId(room.id)) }]}>
                            <Text style={styles.avatarText}>{roomInitial(title)}</Text>
                          </View>
                          {room.unreadCount > 0 && (
                            <View style={styles.unreadDot}>
                              <Text style={styles.unreadText}>{room.unreadCount > 99 ? '99+' : room.unreadCount}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.rowBody}>
                          <View style={styles.rowTop}>
                            <View style={styles.badge}><Text style={styles.badgeText}>{roomTypeBadge(room)}</Text></View>
                            <Text numberOfLines={1} style={styles.rowName}>{title}</Text>
                            <Text style={styles.rowTime}>{formatChatTime(room.lastMessage?.createdAt ?? room.updatedAt)}</Text>
                          </View>
                          <Text numberOfLines={1} style={styles.rowLast}>{roomSubtitle(room)} · {lastMessagePreview(room.lastMessage)}</Text>
                        </View>
                      </Pressable>
                      {index < rooms.length - 1 && <View style={styles.divider} />}
                    </View>
                  )
                })}
              </View>
            )}
          </>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <AuthModal visible={authVisible} onClose={() => setAuthVisible(false)} />
    </SafeAreaView>
  )
}
