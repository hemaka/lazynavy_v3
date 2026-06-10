import { io, type Socket } from 'socket.io-client'
import { API_URL, http } from '../../../services/http'

export type ChatRoomType = 'DIRECT' | 'CONTACT_REQUEST' | 'USER_GROUP' | 'LOCATION' | 'EVENT' | 'SYSTEM'
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'SYSTEM' | string

export type ChatUser = {
  id: string
  nickname: string
  avatar?: string | null
}

export type ChatMessage = {
  id: string
  roomId: string
  senderId: string | null
  sender?: ChatUser | null
  type: ChatMessageType
  text?: string | null
  payload?: any
  clientMessageId?: string | null
  createdAt: string
  updatedAt: string
}

export type ChatRoom = {
  id: string
  type: ChatRoomType
  title?: string | null
  avatarUrl?: string | null
  visibility: 'PRIVATE' | 'PUBLIC' | 'GEO_GATED' | 'UNLISTED'
  sourceType?: string | null
  sourceId?: string | null
  homeRegion?: string | null
  geoRegion?: string | null
  lastMessage?: ChatMessage | null
  membership?: {
    role: string
    status: string
    muted: boolean
    pinned: boolean
    lastReadMessageId?: string | null
    lastReadAt?: string | null
  } | null
  members: Array<{
    userId: string
    role: string
    status: string
    user?: ChatUser | null
  }>
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export type SendMessageInput = {
  roomId: string
  clientMessageId?: string
  type?: ChatMessageType
  text?: string
  payload?: Record<string, unknown>
}

export const NEARBY_LOCATION_ROOMS = [
  { sourceType: 'REGION', sourceId: 'sanya', title: '三亚湾船友房间', homeRegion: '三亚', geoRegion: 'sanya' },
  { sourceType: 'REGION', sourceId: 'hongkong', title: '香港泊位与补给', homeRegion: '香港', geoRegion: 'hongkong' },
  { sourceType: 'REGION', sourceId: 'okinawa', title: '冲绳航线交流', homeRegion: '冲绳', geoRegion: 'okinawa' },
]

export function listChatRoomsApi(token: string) {
  return http.get<ChatRoom[]>('/chat/rooms', token)
}

export function getChatRoomApi(roomId: string, token: string) {
  return http.get<ChatRoom>(`/chat/rooms/${roomId}`, token)
}

export function listChatMessagesApi(roomId: string, token: string, cursor?: string, limit = 50) {
  const query = `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  return http.get<ChatMessage[]>(`/chat/rooms/${roomId}/messages${query}`, token)
}

export function sendChatMessageApi(input: SendMessageInput, token: string) {
  return http.post<ChatMessage>(`/chat/rooms/${input.roomId}/messages`, {
    clientMessageId: input.clientMessageId,
    type: input.type,
    text: input.text,
    payload: input.payload,
  }, token)
}

export function markChatRoomReadApi(roomId: string, token: string, messageId?: string) {
  return http.post<{ roomId: string; userId: string; lastReadMessageId?: string | null; lastReadAt?: string | null }>(
    `/chat/rooms/${roomId}/read`,
    { messageId },
    token,
  )
}

export function getOrCreateLocationRoomApi(token: string, input: {
  sourceType: string
  sourceId: string
  title: string
  homeRegion?: string
  geoRegion?: string
}) {
  return http.post<ChatRoom>('/chat/locations', input, token)
}

export function createChatSocket(token: string): Socket {
  return io(API_URL.replace(/\/api$/, ''), {
    auth: { token },
    transports: ['websocket', 'polling'],
    forceNew: true,
  })
}
