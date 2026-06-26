import React from 'react'
import { useBotContext } from './BotContext'
import { GridOrder } from '@jij-bot/core'

function GridLevel({ order, currentPrice }: { order: GridOrder; currentPrice: number }) {
  const isActive = !order.filled
  const isBuy = order.side === 'buy'
  const isNearPrice = Math.abs(order.price - currentPrice) / currentPrice < 0.005

  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded text-xs font-mono transition-all ${
      order.filled ? 'opacity-30' :
      isNearPrice ? 'bg-yellow-500/20 border border-yellow-500/50' : ''
    }`}>
      <span className={`w-8 text-center font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
        {isBuy ? 'BUY' : 'SELL'}
      </span>
      <span className="text-gray-300 flex-1">{order.price.toFixed(8)}</span>
      <span className="text-gray-500">L{order.level}</span>
      {order.filled && <span className="text-gray-600">✓</span>}
    </div>
  )
}

export function GridVisualizer() {
  const { state } = useBotContext()
  const { openOrders, lastPriceSOL, gridLower, gridUpper } = state

  const sorted = [...openOrders].sort((a, b) => b.price - a.price)

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">Grid Visualizer</div>
        <div className="text-xs text-gray-500">
          {gridLower > 0 && `${gridLower.toFixed(6)} – ${gridUpper.toFixed(6)} SOL`}
        </div>
      </div>

      {openOrders.length === 0 ? (
        <div className="text-center text-gray-500 py-8 text-sm">
          Grid not initialized — configure bounds and start bots
        </div>
      ) : (
        <>
          {/* Desktop: vertical list */}
          <div className="hidden md:block max-h-96 overflow-y-auto space-y-0.5">
            {/* Current price marker */}
            {lastPriceSOL > 0 && (
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/20 rounded border border-blue-500/50">
                <span className="text-xs text-blue-300 font-mono">► PRICE: {lastPriceSOL.toFixed(8)}</span>
              </div>
            )}
            {sorted.map(o => (
              <GridLevel key={o.id} order={o} currentPrice={lastPriceSOL} />
            ))}
          </div>

          {/* Mobile: horizontal scrollable band */}
          <div className="md:hidden overflow-x-auto">
            <div className="flex gap-1 pb-2" style={{ width: 'max-content' }}>
              {[...openOrders].sort((a, b) => a.price - b.price).map(o => (
                <div
                  key={o.id}
                  className={`flex flex-col items-center p-1.5 rounded text-xs min-w-[50px] border ${
                    o.side === 'buy'
                      ? 'border-green-700 bg-green-900/30 text-green-400'
                      : 'border-red-700 bg-red-900/30 text-red-400'
                  } ${o.filled ? 'opacity-30' : ''}`}
                >
                  <span className="font-bold">{o.side === 'buy' ? 'B' : 'S'}</span>
                  <span className="text-gray-400 text-[9px] mt-0.5">{o.price.toFixed(5)}</span>
                  <span className="text-gray-600 text-[9px]">L{o.level}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span>Fills: <span className="text-white">{state.totalGridFills}</span></span>
        <span>Open: <span className="text-white">{openOrders.filter(o => !o.filled).length}</span></span>
        <span>Filled: <span className="text-white">{openOrders.filter(o => o.filled).length}</span></span>
      </div>
    </div>
  )
}
