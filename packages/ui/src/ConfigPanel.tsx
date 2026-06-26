import React from 'react'
import { useBotContext } from './BotContext'

function Field({
  label,
  value,
  onChange,
  type = 'number',
  min,
  max,
  step,
  note,
}: {
  label: string
  value: string | number | boolean
  onChange: (v: string) => void
  type?: 'number' | 'text' | 'checkbox'
  min?: number
  max?: number
  step?: number
  note?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label className="text-xs text-gray-400">{label}</label>
        {note && <div className="text-xs text-gray-600">{note}</div>}
      </div>
      {type === 'checkbox' ? (
        <input
          type="checkbox"
          checked={value as boolean}
          onChange={e => onChange(e.target.checked ? 'true' : 'false')}
          className="w-4 h-4 accent-blue-500"
        />
      ) : (
        <input
          type={type}
          value={value as string | number}
          onChange={e => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-28 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white font-mono text-right focus:outline-none focus:border-blue-500"
        />
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

export function ConfigPanel() {
  const { state, updateConfig } = useBotContext()
  const c = state.config

  const upd = (key: keyof typeof c, raw: string) => {
    const num = parseFloat(raw)
    updateConfig({ [key]: isNaN(num) ? raw : num } as Partial<typeof c>)
  }


  return (
    <div className="bg-gray-800 rounded-xl p-4 text-sm">
      <div className="text-sm font-semibold text-gray-300 mb-4">Settings</div>

      <div className="text-xs text-blue-300/70 mb-4 italic">
        DCA Bot state is controlled from the DCA tab — no config needed.
      </div>

      <Section title="Grid Bounds">
        <Field label="Lower (SOL)" value={c.gridLower} onChange={v => upd('gridLower', v)} step={0.000001} />
        <Field label="Upper (SOL)" value={c.gridUpper} onChange={v => upd('gridUpper', v)} step={0.000001} />
        <Field label="Levels" value={c.gridLevels} onChange={v => upd('gridLevels', v)} min={2} max={200} />
      </Section>

      <Section title="Capital Allocation (%)">
        <Field label="Grid Reserve %" value={c.gridReservePct} onChange={v => upd('gridReservePct', v)} min={10} max={90} />
        <Field label="DCA Pool %" value={c.dcaPoolPct} onChange={v => upd('dcaPoolPct', v)} min={0} max={80} />
        <Field label="Trail Buffer %" value={c.trailBufferPct} onChange={v => upd('trailBufferPct', v)} min={0} max={50} />
      </Section>


      <Section title="Trail Engine">
        <Field label="Trail Sensitivity %" value={(c.trailSensitivity * 100).toFixed(1)} onChange={v => upd('trailSensitivity', String(parseFloat(v) / 100))} min={0.5} max={20} step={0.5} />
        <Field label="Min Buffer (SOL)" value={c.minBufferToShift} onChange={v => upd('minBufferToShift', v)} step={0.01} min={0} />
      </Section>

      <Section title="Safety">
        <Field label="Stop Loss Enabled" value={c.stopLossEnabled} onChange={v => updBool('stopLossEnabled', v)} type="checkbox" />
        {c.stopLossEnabled && (
          <Field label="Stop Loss %" value={c.stopLossPct} onChange={v => upd('stopLossPct', v)} min={1} max={99} />
        )}
        <Field label="Max Session Loss %" value={c.maxSessionLossPct} onChange={v => upd('maxSessionLossPct', v)} min={1} max={99} />
        <Field label="Min SOL Reserve" value={c.minSOLReserve} onChange={v => upd('minSOLReserve', v)} step={0.001} min={0.01} />
        <Field label="Slippage (bps)" value={c.slippageBps} onChange={v => upd('slippageBps', v)} min={10} max={1000} />
        <Field label="Tax Slippage (bps)" value={c.taxSwapSlippageBps} onChange={v => upd('taxSwapSlippageBps', v)} min={10} max={500} />
      </Section>

      <Section title="RPC & Polling">
        <Field label="Poll Interval (s)" value={c.pollingIntervalSec} onChange={v => upd('pollingIntervalSec', v)} min={5} max={60} />
        <Field label="RPC Endpoint" value={c.rpcEndpoint} onChange={v => updateConfig({ rpcEndpoint: v })} type="text" />
      </Section>
    </div>
  )
}
