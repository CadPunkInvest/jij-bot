import React, { useState } from 'react'
import { SpriteConfig } from './designTypes'

interface Props {
  sprites: SpriteConfig[]
  onChange: (sprites: SpriteConfig[]) => void
}

const DEFAULT_SPRITE: Omit<SpriteConfig, 'id'> = {
  src: './assets/sprites/sprite.png',
  x: 100, y: 100, scale: 1,
  frameWidth: 64, frameHeight: 64, frameCount: 8, fps: 12,
  loop: 'loop', visible: true, z: 10,
}

export function SpriteEditor({ sprites, onChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const addSprite = () => {
    if (sprites.length >= 10) return
    const newSprite: SpriteConfig = { ...DEFAULT_SPRITE, id: crypto.randomUUID() }
    onChange([...sprites, newSprite])
  }

  const removeSprite = (id: string) => onChange(sprites.filter(s => s.id !== id))

  const updateSprite = (id: string, partial: Partial<SpriteConfig>) => {
    onChange(sprites.map(s => s.id === id ? { ...s, ...partial } : s))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sprites</div>
        <button
          onClick={addSprite}
          disabled={sprites.length >= 10}
          className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40"
        >
          + Add
        </button>
      </div>

      <div className="space-y-2">
        {sprites.map(s => (
          <div key={s.id} className="bg-gray-800 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-300 text-[10px] truncate max-w-[120px]">{s.id.slice(0, 8)}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditingId(editingId === s.id ? null : s.id)} className="text-gray-500 hover:text-gray-300">⚙️</button>
                <button onClick={() => updateSprite(s.id, { visible: !s.visible })} className="text-gray-500 hover:text-gray-300">
                  {s.visible ? '👁' : '🚫'}
                </button>
                <button onClick={() => removeSprite(s.id)} className="text-red-600 hover:text-red-400">🗑</button>
              </div>
            </div>
            <div className="text-gray-500 text-[10px]">x:{s.x} y:{s.y} scale:{s.scale}x</div>

            {editingId === s.id && (
              <div className="mt-2 space-y-1.5 border-t border-gray-700 pt-2">
                <div>
                  <div className="text-gray-500 mb-0.5">Source</div>
                  <input
                    type="text" value={s.src}
                    onChange={e => updateSprite(s.id, { src: e.target.value })}
                    className="w-full bg-gray-700 rounded px-2 py-0.5 text-white text-[10px] font-mono"
                  />
                </div>
                {([
                  ['Frame W', 'frameWidth'], ['Frame H', 'frameHeight'],
                  ['Frames', 'frameCount'], ['FPS', 'fps'], ['Scale', 'scale'],
                  ['Z-Index', 'z'], ['X', 'x'], ['Y', 'y'],
                ] as [string, keyof SpriteConfig][]).map(([label, key]) => (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">{label}</span>
                    <input
                      type="number" value={s[key] as number}
                      onChange={e => updateSprite(s.id, { [key]: parseFloat(e.target.value) })}
                      className="w-20 bg-gray-700 rounded px-2 py-0.5 text-white text-[10px] font-mono text-right"
                    />
                  </div>
                ))}
                <div className="flex gap-1">
                  {(['loop', 'ping-pong', 'once'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => updateSprite(s.id, { loop: m })}
                      className={`flex-1 py-0.5 rounded text-[10px] transition-colors ${
                        s.loop === m ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {sprites.length === 0 && (
          <div className="text-center text-gray-600 text-[10px] py-2">No sprites — click + Add</div>
        )}
      </div>
    </div>
  )
}
