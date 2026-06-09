import { getJson, postJson } from '../../services/http'

export interface ChatThread {
  id: string
  vesselId?: string | null
  title: string
  members?: Array<{ id: string; userId: string; role: string }>
}

export interface ChatMessage {
  id: string
  threadId: string
  senderId: string
  body: string
  createdAt: string
}

export function listChatThreads() {
  return getJson<ChatThread[]>('/messages/threads')
}

export function listChatMessages(threadId: string) {
  return getJson<ChatMessage[]>(`/messages/threads/${threadId}`)
}

export function sendChatMessage(threadId: string, body: string) {
  return postJson<ChatMessage>(`/messages/threads/${threadId}/messages`, { body })
}
