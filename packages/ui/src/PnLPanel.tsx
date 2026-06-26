import React from 'react'
import { useBotContext } from './BotContext'
import { dcaAvgCostBasis } from '@jij-bot/core'

export function PnLPanel() {
  const { state } = useBotContext()
  const {
    realizedPnLSOL,
    realizedPnLUSD,
    totalJIJviaDCA,
    lastSolUsdPrice,
    lastPriceSOL,
    sessionStartValue,
    gridReserve,
    dcaPool,
    trailBuffer,
  } = state

  const avgCost = dcaAvgCostBasis(state)
  const unrealizedJIJValue = totalJIJviaDCA * lastPriceSOL
  const unrealizedJIJUSD = unrealizedJIJValue * lastSolUsdPrice
  const currentValue = gridReserve + dcaPool + trailBuffer
  const sessionPnL = currentValue - sessionStartValue

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="text-sm font-semibold text-gray-300 mb-3">P&L</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Realized (SOL)</span>
          <span className={`font-mono ${realizedPnLSOL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {realizedPnLSOL >= 0 ? '+' : ''}{realizedPnLSOL.toFixed(6)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Realized (USD)</span>
          <span className={`font-mono ${realizedPnLUSD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {realizedPnLUSD >= 0 ? '+' : ''}${realizedPnLUSD.toFixed(2)}
          </span>
        </div>
        <div className="pt-2 border-t border-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-400">JIJ via DCA</span>
            <span className="font-mono text-gray-300">{totalJIJviaDCA.toFixed(0)}</span>
          </div>
          {avgCost > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-gray-400">Avg Cost</span>
              <span className="font-mono text-gray-300 text-xs">{avgCost.toFixed(8)} SOL/JIJ</span>
            </div>
          )}
          {lastPriceSOL > 0 && totalJIJviaDCA > 0 && (
            <div className="flex justify-between mt-1">
              <span className="text-gray-400">Unrealized (USD)</span>
              <span className={`font-mono text-xs ${unrealizedJIJUSD >= 0 ? 'text-purple-300' : 'text-red-400'}`}>
                ${unrealizedJIJUSD.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        {sessionStartValue > 0 && (
          <div className="pt-2 border-t border-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-400">Session P&L (SOL)</span>
              <span className={`font-mono text-xs ${sessionPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {sessionPnL >= 0 ? '+' : ''}{sessionPnL.toFixed(6)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
