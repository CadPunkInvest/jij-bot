import React from 'react'
import { BackgroundConfig } from './designTypes'

interface Props {
  config: BackgroundConfig
  onChange: (bg: BackgroundConfig) => void
}

export function BackgroundEditor({ config, onChange }: Props) {
  const upd = (partial: Partial<BackgroundConfig>) => onChange({ ...config, ...partial })

  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Background</div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
            onClick={() => {
              const url = prompt('Enter image URL (https://...):')
              if (url) upd({ src: url })
            }}
          >
            Enter URL
          </button>
        </div>
        {config.src && (
          <div className="text-gray-500 text-[10px] truncate">{config.src}</div>
        )}

        <div>
          <div className="flex justify-between text-gray-500 mb-1">
            <span>Opacity</span><span>{Math.round(config.opacity * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05} value={config.opacity}
            onChange={e => upd({ opacity: parseFloat(e.target.value) })}
            className="w-full accent-purple-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-gray-500 mb-1">
            <span>Blur</span><span>{config.blur}px</span>
          </div>
          <input
            type="range" min={0} max={20} step={1} value={config.blur}
            onChange={e => upd({ blur: parseInt(e.target.value) })}
            className="w-full accent-purple-500"
          />
        </div>

        <div className="flex gap-1">
          {(['cover', 'contain', 'tile'] as const).map(m => (
            <button
              key={m}
              onClick={() => upd({ mode: m })}
              className={`flex-1 py-1 rounded text-xs capitalize transition-colors ${
                config.mode === m ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <div className="text-gray-500 mb-1">Offset X</div>
            <input
              type="number" value={config.offsetX}
              onChange={e => upd({ offsetX: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 rounded px-2 py-0.5 text-white text-xs font-mono"
            />
          </div>
          <div className="flex-1">
            <div className="text-gray-500 mb-1">Offset Y</div>
            <input
              type="number" value={config.offsetY}
              onChange={e => upd({ offsetY: parseInt(e.target.value) || 0 })}
              className="w-full bg-gray-700 rounded px-2 py-0.5 text-white text-xs font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
