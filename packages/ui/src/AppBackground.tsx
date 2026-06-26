import React from 'react'
import { BackgroundConfig } from './design/designTypes'

interface Props {
  config: BackgroundConfig
}

export function AppBackground({ config }: Props) {
  if (!config.src) return null

  const backgroundSize =
    config.mode === 'tile' ? 'auto' :
    config.mode === 'contain' ? 'contain' : 'cover'

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundImage: `url(${config.src})`,
        backgroundSize,
        backgroundRepeat: config.mode === 'tile' ? 'repeat' : 'no-repeat',
        backgroundPosition: `${config.offsetX}px ${config.offsetY}px`,
        opacity: config.opacity,
        filter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
        pointerEvents: 'none',
      }}
    />
  )
}
