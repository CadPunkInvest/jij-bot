import React from 'react'
import { useBotContext } from './BotContext'

function ProgressBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CapitalPanel() {
  const { state } = useBotContext()
  const { gridReserve, dcaPool, trailBuffer, dcaStatus, lastSolUsdPrice } = state
  const total = gridReserve + dcaPool + trailBuffer

  const solBal = state.lastSolUsdPrice  // placeholder; actual balance comes from wallet
  const toUSD = (sol: number) => lastSolUsdPrice > 0 ? `$${(sol * lastSolUsdPrice).toFixed(2)}` : ''

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="text-sm font-semibold text-gray-300 mb-3">Capital Allocation</div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Grid Reserve</span>
            <span className="font-mono text-gray-300">{gridReserve.toFixed(4)} SOL {toUSD(gridReserve)}</span>
          </div>
          <ProgressBar value={gridReserve} max={total} color="bg-blue-500" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className={`${dcaStatus === 'deactivated' ? 'text-gray-600' : 'text-gray-400'}`}>
              DCA Pool {dcaStatus === 'deactivated' && <span className="text-red-600">(deactivated)</span>}
            </span>
            <span className={`font-mono text-xs ${dcaStatus === 'deactivated' ? 'text-gray-600' : 'text-gray-300'}`}>
              {dcaPool.toFixed(4)} SOL {toUSD(dcaPool)}
            </span>
          </div>
          <ProgressBar value={dcaPool} max={total} color={dcaStatus === 'deactivated' ? 'bg-gray-600' : 'bg-purple-500'} />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Trail Buffer</span>
            <span className="font-mono text-gray-300">{trailBuffer.toFixed(4)} SOL {toUSD(trailBuffer)}</span>
          </div>
          <ProgressBar value={trailBuffer} max={total} color="bg-yellow-500" />
        </div>

        {total > 0 && (
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Total Managed</span>
              <span className="font-mono text-gray-300">{total.toFixed(4)} SOL {toUSD(total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
