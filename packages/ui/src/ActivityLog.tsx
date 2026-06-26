import React, { useState } from 'react'
import { useBotContext } from './BotContext'
import { LogEventType, LogEntry } from '@jij-bot/core'
import { exportActivityCSV } from '@jij-bot/core'

const ALL_TYPES: LogEventType[] = ['DCA_BUY', 'DCA_SKIP', 'DCA_STATE_CHANGE', 'TAX_RESERVE', 'GRID_FILL', 'TRAIL_SHIFT', 'ERROR']

const TYPE_COLORS: Record<LogEventType, string> = {
  DCA_BUY: 'text-purple-400',
  DCA_SKIP: 'text-gray-500',
  DCA_STATE_CHANGE: 'text-blue-400',
  TAX_RESERVE: 'text-green-400',
  GRID_FILL: 'text-blue-300',
  TRAIL_SHIFT: 'text-yellow-400',
  PROFIT_ROUTE: 'text-teal-400',
  ERROR: 'text-red-400',
  INFO: 'text-gray-400',
  SAFETY: 'text-orange-400',
}

function LogRow({ entry }: { entry: LogEntry }) {
  const d = new Date(entry.timestamp)
  return (
    <div className="flex gap-2 text-xs py-1 border-b border-gray-700/50">
      <span className="text-gray-600 shrink-0 w-16">
        {d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className={`shrink-0 w-20 font-mono ${TYPE_COLORS[entry.type] ?? 'text-gray-400'}`}>
        {entry.type}
      </span>
      <span className="text-gray-300 break-all">{entry.message}</span>
    </div>
  )
}

export function ActivityLog() {
  const { state } = useBotContext()
  const [filter, setFilter] = useState<LogEventType | 'ALL'>('ALL')

  const entries = filter === 'ALL'
    ? state.activityLog
    : state.activityLog.filter(e => e.type === filter)

  const handleExport = () => {
    const csv = exportActivityCSV(state)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'jij-activity-log.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">Activity Log</div>
        <button
          onClick={handleExport}
          disabled={state.activityLog.length === 0}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${filter === 'ALL' ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
          ALL
        </button>
        {ALL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${filter === t ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="max-h-48 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-center text-gray-600 text-xs py-4">No entries yet</div>
        ) : (
          entries.slice(0, 100).map(e => <LogRow key={e.id} entry={e} />)
        )}
      </div>

      <div className="mt-2 text-xs text-gray-600">{state.activityLog.length} total entries</div>
    </div>
  )
}
