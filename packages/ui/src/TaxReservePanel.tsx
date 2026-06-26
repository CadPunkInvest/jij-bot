import React, { useState } from 'react'
import { useBotContext } from './BotContext'
import { exportTaxCSV } from '@jij-bot/core'

const TAX_DISCLAIMER = `Tax information displayed in this app is for informational purposes only and does not constitute financial or tax advice. Canadian crypto tax rules are complex and your obligations depend on your individual circumstances. Consult a qualified Canadian tax professional or refer to CRA guidelines before filing.`

const TAX_PRESETS = [20, 30, 40, 50]

export function TaxReservePanel() {
  const { state, updateConfig } = useBotContext()
  const { taxReserveUSDC, taxEvents, config, pendingTaxReserveSOL } = state
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const currentYear = new Date().getFullYear()

  const lastEvent = taxEvents[taxEvents.length - 1]
  const totalReservedSOL = taxEvents.reduce((s, e) => s + e.taxReservedSOL, 0)
  const totalProfitUSD = taxEvents.reduce((s, e) => s + e.profitUSD, 0)
  const inclusionRate = totalProfitUSD > 0 ? (taxReserveUSDC / totalProfitUSD) * 100 : 0

  const handleExport = () => {
    const csv = exportTaxCSV(state, currentYear)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jij-tax-${currentYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-300">Tax Reserve</div>
        <button
          onClick={() => setShowDisclaimer(d => !d)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          ⓘ Disclaimer
        </button>
      </div>

      {pendingTaxReserveSOL > 0 && (
        <div className="mb-3 px-3 py-2 bg-orange-900/20 border border-orange-700 rounded-lg text-xs text-orange-300 animate-pulse">
          ⚠ Pending tax swap: {pendingTaxReserveSOL.toFixed(6)} SOL — will retry on next profit
        </div>
      )}

      {/* Main number */}
      <div className="text-center my-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total USDC Reserved</div>
        <div className="text-4xl font-mono font-bold text-green-400">
          ${taxReserveUSDC.toFixed(2)}
        </div>
        <div className="text-sm text-gray-500 mt-2">Reserve rate</div>
        <div className="flex justify-center gap-2 mt-2">
          {TAX_PRESETS.map(pct => (
            <button
              key={pct}
              onClick={() => updateConfig({ taxReservePct: pct })}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                config.taxReservePct === pct
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">SOL Reserved</span>
          <span className="font-mono text-gray-300">{totalReservedSOL.toFixed(6)} SOL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Total Profit (USD)</span>
          <span className="font-mono text-gray-300">${totalProfitUSD.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Inclusion Rate Est.</span>
          <span className="font-mono text-gray-300">{inclusionRate.toFixed(1)}%</span>
        </div>
        {lastEvent && (
          <div className="flex justify-between">
            <span className="text-gray-400">Last Reserve</span>
            <span className="text-gray-300 text-xs">
              {new Date(lastEvent.timestamp).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · ${lastEvent.usdcReceived.toFixed(2)} USDC
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleExport}
          disabled={taxEvents.length === 0}
          className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
        >
          Export CRA CSV
        </button>
      </div>

      {showDisclaimer && (
        <div className="mt-3 p-3 bg-gray-700/50 rounded-lg text-xs text-gray-400 leading-relaxed">
          {TAX_DISCLAIMER}
        </div>
      )}
    </div>
  )
}
