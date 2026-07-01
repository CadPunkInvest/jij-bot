import type React from 'react'

export function VersionBadge({ version, variant = 'overlay' }: { version?: string; variant?: 'overlay' | 'inline' }) {
  if (!version) return null
  const textStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: 'rgba(180,180,220,0.4)',
    fontFamily: 'monospace', letterSpacing: '0.03em',
  }
  if (variant === 'inline') {
    return <div style={{ width: '100%', textAlign: 'center', padding: '4px 0 0', ...textStyle }}>V{version}</div>
  }
  return (
    <div style={{ position: 'absolute', top: 6, left: 8, zIndex: 20, pointerEvents: 'none', ...textStyle }}>
      V{version}
    </div>
  )
}
