import type { ChatMessage, ChatRoom } from '../api/client'

type TextFn = (source: string) => string

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

export function roomTitle(room: ChatRoom, currentUserId?: string | null, text?: TextFn) {
  if (room.title) return room.title
  const peer = room.members.find((member) => member.userId !== currentUserId)?.user
  return peer?.nickname ?? text?.('消息') ?? '消息'
}

export function roomInitial(title: string) {
  return title.trim().slice(0, 1).toUpperCase() || 'M'
}

export function roomSubtitle(room: ChatRoom, text?: TextFn) {
  if (room.type === 'LOCATION') return room.homeRegion || room.geoRegion || (text?.('地域房间') ?? '地域房间')
  if (room.type === 'DIRECT') return text?.('私信') ?? '私信'
  return text?.('{count} 位成员')?.replace('{count}', String(room.members.length || 1)) ?? `${room.members.length || 1} 位成员`
}

export function roomTypeBadge(room: ChatRoom, text?: TextFn) {
  if (room.type === 'LOCATION') return text?.('地域') ?? '地域'
  if (room.type === 'DIRECT') return text?.('私信') ?? '私信'
  return text?.('房间') ?? '房间'
}

export function lastMessagePreview(message?: ChatMessage | null, text?: TextFn) {
  if (!message) return text?.('还没有消息') ?? '还没有消息'
  if (message.text?.trim()) return message.text.trim()
  return `[${message.type}]`
}
