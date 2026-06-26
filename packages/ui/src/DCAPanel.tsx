import React, { useState } from 'react'
import { useBotContext } from './BotContext'
import { getDCAScheduledTimeLabel, dcaAvgCostBasis } from '@jij-bot/core'

export function DCAPanel() {
  const { state, setDCAStatus, updateConfig } = useBotContext()
  const { dcaStatus, dcaPool, totalDCABuys, totalJIJviaDCA, dcaBuyHistory, lastSolUsdPrice, config } = state
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitDraft, setLimitDraft] = useState('')

  const scheduledLabel = getDCAScheduledTimeLabel(state)
  const avgCost = dcaAvgCostBasis(state)
  const poolUSD = dcaPool * lastSolUsdPrice
  const lastBuy = dcaBuyHistory[0]

  const handleDeactivate = () => {
    setDCAStatus('deactivated')
    setShowDeactivateConfirm(false)
  }

  const handleReactivate = () => {
    setDCAStatus('off')
  }

  const startEditLimit = () => {
    setLimitDraft(String(config.dailyDCALimitUSD))
    setEditingLimit(true)
  }

  const confirmEditLimit = () => {
    const val = parseFloat(limitDraft)
    if (!isNaN(val) && val > 0) updateConfig({ dailyDCALimitUSD: val })
    setEditingLimit(false)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">DCA Bot</div>
        <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          dcaStatus === 'on' ? 'bg-green-500/20 text-green-400' :
          dcaStatus === 'off' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {dcaStatus.toUpperCase()}
        </div>
      </div>

      {/* State controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setDCAStatus('on')}
          disabled={dcaStatus === 'on' || dcaStatus === 'deactivated'}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            dcaStatus === 'on'
              ? 'bg-green-600 text-white cursor-default'
              : 'bg-gray-700 hover:bg-green-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          ON
        </button>
        <button
          onClick={() => setDCAStatus('off')}
          disabled={dcaStatus === 'off' || dcaStatus === 'deactivated'}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            dcaStatus === 'off'
              ? 'bg-yellow-600 text-white cursor-default'
              : 'bg-gray-700 hover:bg-yellow-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          OFF
        </button>
        {dcaStatus !== 'deactivated' ? (
          <button
            onClick={() => setShowDeactivateConfirm(true)}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold border border-red-700 text-red-400 hover:bg-red-900/30 transition-colors"
          >
            DEACTIVATE
          </button>
        ) : (
          <button
            onClick={handleReactivate}
            className="flex-1 py-1.5 rounded-lg text-sm font-semibold border border-blue-600 text-blue-400 hover:bg-blue-900/30 transition-colors"
          >
            REACTIVATE
          </button>
        )}
      </div>

      {/* Deactivation banner */}
      {dcaStatus === 'deactivated' && (
        <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded-lg text-xs text-red-300">
          Profits redirected to Grid Bot and Trail Buffer. Pool balance preserved.
        </div>
      )}

      {/* Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Pool Balance</span>
          <span className={`font-mono ${dcaStatus === 'deactivated' ? 'text-gray-500' : 'text-white'}`}>
            {dcaPool.toFixed(4)} SOL {lastSolUsdPrice > 0 && `(~$${poolUSD.toFixed(2)})`}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-400">Today's Buy</span>
          <span className="text-gray-300 text-right text-xs">
            {dcaStatus === 'off' ? 'Skipped (bot is OFF). Pool growing.' :
             dcaStatus === 'deactivated' ? 'Deactivated' :
             dcaPool <= 0 ? 'Pool empty. Waiting for grid profits.' :
             state.todayBuyExecuted ? 'Executed today' :
             `Scheduled ${scheduledLabel}`}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400">Daily Cap</span>
          {editingLimit ? (
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">$</span>
              <input
                type="number"
                min="1"
                value={limitDraft}
                onChange={e => setLimitDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmEditLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
                className="w-20 bg-gray-700 text-white text-sm font-mono rounded px-2 py-0.5 border border-purple-500 outline-none"
                autoFocus
              />
              <button onClick={confirmEditLimit} className="text-green-400 hover:text-green-300 text-xs font-bold px-1">✓</button>
              <button onClick={() => setEditingLimit(false)} className="text-gray-500 hover:text-gray-300 text-xs px-1">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-gray-300">${config.dailyDCALimitUSD.toFixed(2)} USD</span>
              <button
                onClick={startEditLimit}
                className="text-xs text-purple-400 hover:text-purple-300 border border-purple-700 hover:border-purple-500 rounded px-1.5 py-0.5 transition-colors"
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {lastBuy && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-1">Last Buy</div>
            <div className="text-sm text-gray-300">
              {new Date(lastBuy.timestamp).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · {lastBuy.solSpent.toFixed(4)} SOL
            </div>
            <div className="text-xs text-gray-400">Received {lastBuy.jijReceived.toFixed(0)} JIJ</div>
          </div>
        )}

        {totalDCABuys > 0 && (
          <div className="pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-1">All-time</div>
            <div className="text-sm text-gray-300">{totalDCABuys} buys · {totalJIJviaDCA.toFixed(0)} JIJ</div>
            {avgCost > 0 && (
              <div className="text-xs text-gray-400">Avg cost: {avgCost.toFixed(8)} SOL/JIJ</div>
            )}
          </div>
        )}
      </div>

      {/* Deactivate confirmation dialog */}
      {showDeactivateConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-red-700 rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-red-400 mb-2">Deactivate DCA Bot?</h3>
            <p className="text-sm text-gray-300 mb-2">
              Your DCA pool balance of <span className="font-mono text-white">{dcaPool.toFixed(4)} SOL</span> will be preserved,
              but no new profits will flow in.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Future profits will be split between Grid Bot (60%) and Trail Buffer (40%) instead.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeactivate}
                className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Deactivate
              </button>
              <button
                onClick={() => setShowDeactivateConfirm(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
