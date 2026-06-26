import { BotState, LogEntry, LogEventType } from './types'

const MAX_LOG_ENTRIES = 1000

export function logEntry(
  state: BotState,
  type: LogEventType,
  message: string,
  data?: Record<string, unknown>,
): void {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    message,
    data,
  }
  state.activityLog.unshift(entry)
  if (state.activityLog.length > MAX_LOG_ENTRIES) {
    state.activityLog = state.activityLog.slice(0, MAX_LOG_ENTRIES)
  }
}

export function exportActivityCSV(state: BotState): string {
  const lines = ['Timestamp,Type,Message']
  for (const e of [...state.activityLog].reverse()) {
    const d = new Date(e.timestamp).toISOString()
    const msg = e.message.replace(/,/g, ';')
    lines.push(`${d},${e.type},${msg}`)
  }
  return lines.join('\n')
}
