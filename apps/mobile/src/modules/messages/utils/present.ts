import type { ChatMessage, ChatRoom } from '../api/client'

export function formatChatTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function hueForId(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360
  return hash
}

export function roomTitle(room: ChatRoom, currentUserId?: string | null) {
  if (room.title) return room.title
  const peer = room.members.find((member) => member.userId !== currentUserId)?.user
  return peer?.nickname ?? '消息'
}

export function roomInitial(title: string) {
  return title.trim().slice(0, 1).toUpperCase() || 'M'
}

export function roomSubtitle(room: ChatRoom) {
  if (room.type === 'LOCATION') return room.homeRegion || room.geoRegion || '地域房间'
  if (room.type === 'DIRECT') return '私信'
  return `${room.members.length || 1} 位成员`
}

export function roomTypeBadge(room: ChatRoom) {
  if (room.type === 'LOCATION') return '地域'
  if (room.type === 'DIRECT') return '私信'
  return '房间'
}

export function lastMessagePreview(message?: ChatMessage | null) {
  if (!message) return '还没有消息'
  if (message.text?.trim()) return message.text.trim()
  return `[${message.type}]`
}
