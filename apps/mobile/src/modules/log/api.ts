import { getJson, postJson } from '../../services/http'

export interface LogEntry {
  id: string
  vesselId: string
  voyageId?: string | null
  type: string
  title: string
  body?: string | null
  createdAt: string
}

export function listLogs() {
  return getJson<LogEntry[]>('/logs')
}

export function createLog(vesselId: string, voyageId?: string | null) {
  return postJson<LogEntry>('/logs', {
    vesselId,
    voyageId,
    type: 'note',
    title: 'Deck check',
    body: 'Quick V3 log entry from the mobile app.',
  })
}
