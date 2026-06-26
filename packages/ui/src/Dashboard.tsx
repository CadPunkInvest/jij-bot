import React from 'react'
import { useBotContext } from './BotContext'

function PriceTicker() {
  const { state } = useBotContext()
  const price = state.lastPriceSOL
  const solUsd = state.lastSolUsdPrice

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex items-center gap-6">
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wider">JIJ / SOL</div>
        <div className="text-2xl font-mono font-bold text-green-400">
          {price > 0 ? price.toFixed(8) : '—'}
        </div>
      </div>
      <div className="border-l border-gray-600 pl-6">
        <div className="text-xs text-gray-400 uppercase tracking-wider">SOL / USD</div>
        <div className="text-xl font-mono text-blue-300">
          ${solUsd > 0 ? solUsd.toFixed(2) : '—'}
        </div>
      </div>
      <div className="border-l border-gray-600 pl-6">
        <div className="text-xs text-gray-400 uppercase tracking-wider">JIJ / USD</div>
        <div className="text-xl font-mono text-purple-300">
          ${price > 0 && solUsd > 0 ? (price * solUsd).toFixed(8) : '—'}
        </div>
      </div>
    </div>
  )
}

function BotStatusBadge() {
  const { state, startBots, stopBots, emergencyStop } = useBotContext()

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">Bot Status</div>
        <div className={`px-2 py-1 rounded-full text-xs font-bold ${
          state.botRunning ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {state.botRunning ? 'RUNNING' : 'STOPPED'}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <div className={`px-2 py-1 rounded text-xs ${
          state.walletPublicKey ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700 text-gray-500'
        }`}>
          {state.walletPublicKey ? `${state.walletPublicKey.slice(0, 4)}…${state.walletPublicKey.slice(-4)}` : 'No wallet'}
        </div>
        <div className="px-2 py-1 rounded text-xs bg-purple-500/20 text-purple-300">
          DCA: {state.dcaStatus.toUpperCase()}
        </div>
{state.pendingTaxReserveSOL > 0 && (
          <div className="px-2 py-1 rounded text-xs bg-orange-500/20 text-orange-300 animate-pulse">
            ⚠ Tax pending {state.pendingTaxReserveSOL.toFixed(4)} SOL
          </div>
        )}
      </div>

      {state.highWaterMark > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          HWM: <span className="text-yellow-300 font-mono">{state.highWaterMark.toFixed(8)}</span> SOL
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {!state.botRunning ? (
          <button
            onClick={startBots}
            disabled={!state.walletPublicKey}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
          >
            Start Bots
          </button>
        ) : (
          <button
            onClick={stopBots}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded-lg transition-colors"
          >
            Stop Bots
          </button>
        )}
        <button
          onClick={emergencyStop}
          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
        >
          Emergency Stop
        </button>
      </div>
    </div>
  )
}

export function Dashboard() {
  return (
    <div className="space-y-4">
      <PriceTicker />
      <BotStatusBadge />
    </div>
  )
}
