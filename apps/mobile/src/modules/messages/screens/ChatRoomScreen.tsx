import { router, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { Socket } from 'socket.io-client'
import { AuthModal } from '../../identity/components/AuthModal'
import { useAuth } from '../../identity/public'
import type { ChatMessage, ChatRoom } from '../api/client'
import { createChatSocket, getChatRoomApi, listChatMessagesApi, markChatRoomReadApi, sendChatMessageApi } from '../api/client'
import { formatChatTime, hueForId, roomInitial, roomSubtitle, roomTitle } from '../utils/present'
import { useTheme } from '../../../theme'

function makeClientMessageId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hslColor(hue: number) {
  return `hsl(${hue}, 55%, 30%)`
}

export default function ChatRoomScreen({
  roomIdOverride,
  onBack,
  onClose,
}: {
  roomIdOverride?: string
  onBack?: () => void
  onClose?: () => void
} = {}) {
  const t = useTheme()
  const { id } = useLocalSearchParams<{ id: string }>()
  const routeRoomId = Array.isArray(id) ? id[0] : id
  const roomId = roomIdOverride ?? routeRoomId
  const { token, user, ready } = useAuth()
  const [authVisible, setAuthVisible] = useState(false)
  const [room, setRoom] = useState<ChatRoom | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [socketReady, setSocketReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<ScrollView | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const styles = useMemo(() => makeChatRoomStyles(t, socketReady), [socketReady, t])

  const load = useCallback(async () => {
    if (!roomId || !token) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextRoom, nextMessages] = await Promise.all([
        getChatRoomApi(roomId, token),
        listChatMessagesApi(roomId, token),
      ])
      setRoom(nextRoom)
      setMessages(nextMessages)
      const last = nextMessages[nextMessages.length - 1]
      if (last) void markChatRoomReadApi(roomId, token, last.id)
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }))
    } catch (err: any) {
      setError(err?.message ?? '加载聊天失败')
    } finally {
      setLoading(false)
    }
  }, [roomId, token])

  useEffect(() => {
    if (!ready) return
    if (!token) {
      setAuthVisible(true)
      setLoading(false)
      return
    }
    void load()
  }, [load, ready, token])

  useEffect(() => {
    if (!token || !roomId) return
    const socket = createChatSocket(token)
    socketRef.current = socket
    socket.on('connect', () => {
      setSocketReady(true)
      socket.emit('room:join', { roomId }, () => undefined)
    })
    socket.on('disconnect', () => setSocketReady(false))
    socket.on('message:created', (message: ChatMessage) => {
      if (message.roomId !== roomId) return
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      void markChatRoomReadApi(roomId, token, message.id)
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
    })
    return () => {
      socket.emit('room:leave', { roomId })
      socket.disconnect()
      socketRef.current = null
      setSocketReady(false)
    }
  }, [roomId, token])

  async function send() {
    const trimmed = text.trim()
    if (!trimmed || !token || !roomId || sending) return
    const clientMessageId = makeClientMessageId()
    setText('')
    setSending(true)
    try {
      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit('message:send', { roomId, clientMessageId, type: 'TEXT', text: trimmed }, (response: { message?: ChatMessage }) => {
          if (!response?.message) return
          setMessages((current) => current.some((item) => item.id === response.message!.id) ? current : [...current, response.message!])
          requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
        })
      } else {
        const created = await sendChatMessageApi({ roomId, clientMessageId, type: 'TEXT', text: trimmed }, token)
        setMessages((current) => [...current, created])
      }
    } catch (err: any) {
      setText(trimmed)
      Alert.alert('发送失败', err?.message ?? '请稍后重试')
    } finally {
      setSending(false)
    }
  }

  const title = room ? roomTitle(room, user?.id) : '聊天'

  if (!ready || loading) {
    return <StateScreen text="正在读取聊天..." styles={styles} color={t.accent} />
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>登录后查看聊天</Text>
          <Text style={styles.stateText}>聊天消息需要登录后同步。</Text>
          <Pressable style={styles.stateBtn} onPress={() => setAuthVisible(true)}>
            <Text style={styles.stateBtnText}>登录 / 注册</Text>
          </Pressable>
        </View>
        <AuthModal visible={authVisible} onClose={() => setAuthVisible(false)} />
      </SafeAreaView>
    )
  }

  if (error || !room) {
    return (
      <SafeAreaView style={styles.screen}>
        <Header title="聊天不可用" subtitle="REST" roomId={roomId ?? 'error'} styles={styles} onBack={onBack} onClose={onClose} />
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>加载失败</Text>
          <Text style={styles.stateText}>{error ?? '聊天房间不存在'}</Text>
          <Pressable style={styles.stateBtn} onPress={() => void load()}>
            <Text style={styles.stateBtnText}>重试</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={t.statusDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title={title} subtitle={socketReady ? 'LIVE · 实时连接' : `${roomSubtitle(room)} · REST`} roomId={room.id} styles={styles} onBack={onBack} onClose={onClose} />
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <View style={styles.stateWrap}>
              <Text style={styles.stateTitle}>还没有消息</Text>
              <Text style={styles.stateText}>发出第一条消息，开始这个房间的讨论。</Text>
            </View>
          ) : messages.map((message) => (
            <MessageBubble key={message.id} message={message} currentUserId={user?.id} isGroup={room.type !== 'DIRECT'} styles={styles} />
          ))}
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="发送消息..."
            placeholderTextColor={t.textSoft}
            multiline
            style={styles.input}
          />
          <Pressable style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={() => void send()} disabled={!text.trim() || sending}>
            <Text style={[styles.sendText, (!text.trim() || sending) && styles.sendTextDisabled]}>›</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

type ChatRoomStyles = ReturnType<typeof makeChatRoomStyles>

function makeChatRoomStyles(t: ReturnType<typeof useTheme>, socketReady: boolean) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderBottomWidth: 0.5, borderBottomColor: t.border },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backText: { color: t.text, fontSize: 28, lineHeight: 32 },
    avatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
    headerInfo: { flex: 1 },
    headerName: { color: t.text, fontSize: 16, fontWeight: '800' },
    onlineText: { color: socketReady ? t.success : t.textSoft, fontSize: 11, marginTop: 2, fontWeight: '700' },
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: t.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
    scroll: { flex: 1 },
    msgList: { paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    bubbleWrap: { maxWidth: '78%', gap: 4 },
    bubbleThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    bubbleMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    senderName: { color: t.textSoft, fontSize: 11 },
    bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
    bubbleTextThem: { color: t.text, fontSize: 15, lineHeight: 21 },
    bubbleTextMe: { color: '#fff', fontSize: 15, lineHeight: 21 },
    bubbleBgThem: { backgroundColor: t.elevated, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: t.border },
    bubbleBgMe: { backgroundColor: t.accent, borderBottomRightRadius: 4 },
    msgTime: { color: t.textSoft, fontSize: 10 },
    stateWrap: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
    stateTitle: { color: t.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
    stateText: { color: t.textDim, fontSize: 13, lineHeight: 20, textAlign: 'center' },
    stateBtn: { backgroundColor: t.accent, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    stateBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderTopWidth: 0.5, borderTopColor: t.border, backgroundColor: t.bg },
    input: { flex: 1, minHeight: 40, maxHeight: 96, borderRadius: 20, backgroundColor: t.surface, color: t.text, borderWidth: 0.5, borderColor: t.border, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
    sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: t.surface, borderWidth: 0.5, borderColor: t.border },
    sendText: { color: '#fff', fontSize: 20, fontWeight: '800' },
    sendTextDisabled: { color: t.textDim },
  })
}

function StateScreen({ text, styles, color }: { text: string; styles: ChatRoomStyles; color: string }) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.stateWrap}>
        <ActivityIndicator color={color} />
        <Text style={styles.stateText}>{text}</Text>
      </View>
    </SafeAreaView>
  )
}

function Header({
  title,
  subtitle,
  roomId,
  styles,
  onBack,
  onClose,
}: {
  title: string
  subtitle: string
  roomId: string
  styles: ChatRoomStyles
  onBack?: () => void
  onClose?: () => void
}) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.backBtn} onPress={onBack ?? (() => router.push('/chat'))}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={[styles.avatar, { backgroundColor: hslColor(hueForId(roomId)) }]}>
        <Text style={styles.avatarText}>{roomInitial(title)}</Text>
      </View>
      <View style={styles.headerInfo}>
        <Text style={styles.headerName} numberOfLines={1}>{title}</Text>
        <Text style={styles.onlineText}>{subtitle}</Text>
      </View>
      <Pressable style={styles.closeBtn} onPress={onClose ?? (() => router.replace('/'))}>
        <Text style={styles.closeText}>×</Text>
      </Pressable>
    </View>
  )
}

function MessageBubble({ message, currentUserId, isGroup, styles }: { message: ChatMessage; currentUserId?: string | null; isGroup: boolean; styles: ChatRoomStyles }) {
  const me = !!currentUserId && message.senderId === currentUserId
  return (
    <View style={[styles.bubbleWrap, me ? styles.bubbleMe : styles.bubbleThem]}>
      {!me && isGroup ? <Text style={styles.senderName}>{message.sender?.nickname ?? '成员'}</Text> : null}
      <View style={[styles.bubble, me ? styles.bubbleBgMe : styles.bubbleBgThem]}>
        <Text style={me ? styles.bubbleTextMe : styles.bubbleTextThem}>{message.text || `[${message.type}]`}</Text>
      </View>
      <Text style={styles.msgTime}>{formatChatTime(message.createdAt)}</Text>
    </View>
  )
}
