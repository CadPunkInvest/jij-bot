import React, { useState, useRef } from 'react'
import { PanelConfig } from './designTypes'

interface Props {
  panels: PanelConfig[]
  onChange: (panels: PanelConfig[]) => void
}

export function LayoutEditor({ panels, onChange }: Props) {
  const [snapToGrid, setSnapToGrid] = useState(true)
  const [gridSize, setGridSize] = useState(8)

  const snap = (v: number) => snapToGrid ? Math.round(v / gridSize) * gridSize : v

  const updatePanel = (id: string, partial: Partial<PanelConfig>) => {
    onChange(panels.map(p => p.id === id ? { ...p, ...partial } : p))
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Panels</div>

      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-1 text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={e => setSnapToGrid(e.target.checked)}
            className="accent-purple-500"
          />
          <span>Snap to Grid</span>
        </label>
        <div className="flex items-center gap-1 text-gray-500">
          <span>Grid:</span>
          <input
            type="number" value={gridSize} min={1} max={64}
            onChange={e => setGridSize(parseInt(e.target.value) || 8)}
            className="w-12 bg-gray-700 rounded px-1 py-0.5 text-white text-[10px] font-mono text-right"
          />
          <span>px</span>
        </div>
      </div>

      <div className="space-y-1">
        {panels.map(p => (
          <div key={p.id} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
            <button
              onClick={() => updatePanel(p.id, { visible: !p.visible })}
              className="text-gray-500 hover:text-gray-300 shrink-0"
            >
              {p.visible ? '👁' : '🚫'}
            </button>
            <span className="text-gray-300 text-[10px] flex-1 truncate">{p.id}</span>
            <div className="flex gap-1 shrink-0">
              {(['x', 'y', 'w', 'h'] as const).map(field => (
                <div key={field} className="flex items-center gap-0.5">
                  <span className="text-gray-600 text-[9px]">{field}:</span>
                  <input
                    type="number"
                    value={p[field]}
                    onChange={e => updatePanel(p.id, { [field]: snap(parseInt(e.target.value) || 0) })}
                    className="w-12 bg-gray-700 rounded px-1 py-0.5 text-white text-[9px] font-mono text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 text-gray-600 text-[10px]">
        Drag panels directly in the app view when Design Mode is active.
      </div>
    </div>
  )
}
