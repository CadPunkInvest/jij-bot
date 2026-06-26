import React, { useState, useRef } from 'react'
import { useDesignConfig } from './useDesignConfig'
import { BackgroundEditor } from './BackgroundEditor'
import { SpriteEditor } from './SpriteEditor'
import { LayoutEditor } from './LayoutEditor'

interface Props {
  platform: 'desktop' | 'android'
}

export function DesignModePanel({ platform }: Props) {
  const { config, updateConfig, saveConfig, resetConfig, saved } = useDesignConfig()
  const [collapsed, setCollapsed] = useState(false)
  const [pos, setPos] = useState({ x: 16, y: 16 })
  const [dragging, setDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    setDragging(true)
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
  }
  const onMouseUp = () => setDragging(false)

  if (collapsed) {
    return (
      <div
        className="fixed z-[9999] cursor-pointer"
        style={{ left: pos.x, top: pos.y }}
        onClick={() => setCollapsed(false)}
      >
        <div className="bg-gray-900 border border-purple-600 rounded-full px-3 py-1.5 text-xs text-purple-300 font-semibold shadow-lg">
          🎨 Design Mode
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed z-[9999] w-80 bg-gray-900 border border-purple-600 rounded-xl shadow-2xl overflow-hidden select-none"
      style={{ left: pos.x, top: pos.y }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-purple-800 cursor-grab active:cursor-grabbing"
        onMouseDown={onHeaderMouseDown}
      >
        <span className="text-xs font-bold text-purple-300">🎨 DESIGN MODE</span>
        <div className="flex gap-2">
          {!saved && (
            <span className="text-xs text-orange-400">Unsaved</span>
          )}
          <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-white text-xs px-1">–</button>
        </div>
      </div>

      <div className="p-3 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
        <BackgroundEditor
          config={config[platform].background}
          onChange={bg => updateConfig(c => ({ ...c, [platform]: { ...c[platform], background: bg } }))}
        />

        <SpriteEditor
          sprites={config[platform].sprites}
          onChange={sprites => updateConfig(c => ({ ...c, [platform]: { ...c[platform], sprites } }))}
        />

        {platform === 'desktop' && (
          <LayoutEditor
            panels={config.desktop.panels}
            onChange={panels => updateConfig(c => ({ ...c, desktop: { ...c.desktop, panels } }))}
          />
        )}

        <div className="flex gap-2 pt-2 border-t border-gray-700">
          <button
            onClick={saveConfig}
            className="flex-1 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            💾 Save Layout
          </button>
          <button
            onClick={resetConfig}
            className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs font-semibold transition-colors"
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  )
}
