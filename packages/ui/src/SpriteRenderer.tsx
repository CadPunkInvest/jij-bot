import React, { useEffect, useRef } from 'react'
import { SpriteConfig } from './design/designTypes'

interface Props {
  config: SpriteConfig
  isAndroid?: boolean
}

export function SpriteRenderer({ config, isAndroid = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef(0)
  const lastTimeRef = useRef(0)
  const animRef = useRef<number>(0)

  // Android: resolve px from pct
  const x = isAndroid && config.xPct !== undefined
    ? config.xPct * window.innerWidth
    : config.x
  const y = isAndroid && config.yPct !== undefined
    ? config.yPct * window.innerHeight
    : config.y

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !config.visible) return

    const img = new Image()
    img.src = config.src
    let direction = 1

    const frameDuration = 1000 / config.fps

    const animate = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= frameDuration) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, config.frameWidth, config.frameHeight)
          ctx.drawImage(
            img,
            frameRef.current * config.frameWidth, 0,
            config.frameWidth, config.frameHeight,
            0, 0,
            config.frameWidth, config.frameHeight,
          )
        }

        if (config.loop === 'loop') {
          frameRef.current = (frameRef.current + 1) % config.frameCount
        } else if (config.loop === 'ping-pong') {
          frameRef.current += direction
          if (frameRef.current >= config.frameCount - 1 || frameRef.current <= 0) {
            direction *= -1
          }
        } else if (config.loop === 'once') {
          frameRef.current = Math.min(frameRef.current + 1, config.frameCount - 1)
        }

        lastTimeRef.current = timestamp
      }
      animRef.current = requestAnimationFrame(animate)
    }

    img.onload = () => {
      animRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [config])

  if (!config.visible) return null

  return (
    <canvas
      ref={canvasRef}
      width={config.frameWidth}
      height={config.frameHeight}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `scale(${config.scale})`,
        transformOrigin: 'top left',
        zIndex: config.z,
        display: 'block',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  )
}
