import React, { useEffect, useRef, useState } from 'react'
import { useBotContext } from './BotContext'
import { getDCAScheduledTimeLabel, dcaAvgCostBasis, getNextFormatSwitchTime } from '@jij-bot/core'
import { WalletModal } from './WalletModal'
import { VersionBadge } from './VersionBadge'

const holoNum: React.CSSProperties = { textShadow: '0 0 10px currentColor' }

const card: React.CSSProperties = {
  background: 'rgba(10,14,32,0.62)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  padding: '18px 20px',
}

const cardLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'rgba(180,180,220,0.6)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4,
}

const mutedText: React.CSSProperties = { color: 'rgba(180,180,220,0.6)', fontSize: 13 }
const dimText: React.CSSProperties = { color: 'rgba(160,160,200,0.5)', fontSize: 11 }

function formatSolPrice(price: number): string {
  if (price <= 0) return '0'
  if (price < 0.001) return price.toFixed(9)
  if (price < 1) return price.toFixed(6)
  return price.toFixed(4)
}

type PriceUnit = 'SOL' | 'USD'

function formatJijPrice(priceSOL: number, solUsdPrice: number, unit: PriceUnit): string {
  if (priceSOL <= 0) return '—'
  if (unit === 'SOL') return formatSolPrice(priceSOL)
  const usd = priceSOL * solUsdPrice
  return usd < 0.01 ? `$${usd.toFixed(8)}` : `$${usd.toFixed(4)}`
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':')
}

function UnitToggle({ unit, onToggle }: { unit: PriceUnit; onToggle: (u: PriceUnit) => void }) {
  const btn = (u: PriceUnit): React.CSSProperties => ({
    padding: '2px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, cursor: 'pointer',
    border: unit === u ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.12)',
    background: unit === u ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.04)',
    color: unit === u ? '#93c5fd' : 'rgba(180,180,220,0.4)',
    textTransform: 'uppercase',
  })
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button style={btn('SOL')} onClick={() => onToggle('SOL')}>SOL</button>
      <button style={btn('USD')} onClick={() => onToggle('USD')}>USD</button>
    </div>
  )
}

// --- Sparkline ---
function Sparkline({ prices, color = '#a78bfa' }: { prices: number[]; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || prices.length < 2) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width, h = canvas.height
    const min = Math.min(...prices), max = Math.max(...prices)
    const range = max - min || 1
    ctx.clearRect(0, 0, w, h)
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * w
      const y = h - ((p - min) / range) * (h - 4) - 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath()
    ctx.fillStyle = color + '18'
    ctx.fill()
  }, [prices, color])
  return <canvas ref={canvasRef} width={100} height={32} style={{ opacity: 0.9 }} />
}

// --- Price ticker strip ---
function PriceStrip({ logoSrc, onWalletOpen, priceUnit, onToggleUnit }: { logoSrc?: string; onWalletOpen: () => void; priceUnit: PriceUnit; onToggleUnit: (u: PriceUnit) => void }) {
  const { state, stopBots } = useBotContext()
  const { lastPriceSOL, lastSolUsdPrice, lastPollTime } = state
  const [priceHistory, setPriceHistory] = useState<number[]>([])
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const pollAgo = lastPollTime > 0 ? Math.floor((now - lastPollTime) / 1000) : null

  useEffect(() => {
    if (lastPriceSOL > 0) setPriceHistory(h => [...h.slice(-60), lastPriceSOL])
  }, [lastPriceSOL])

  const change = priceHistory.length > 1
    ? ((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100
    : 0
  const up = change >= 0
  const liveColor = pollAgo !== null && pollAgo > 1800 ? '#f87171' : '#4ade80'

  const stripStyle: React.CSSProperties = {
    background: 'rgba(4,6,20,0.72)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  }

  const btnBase: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)', color: 'white',
  }

  return (
    <div style={stripStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 6px' }}>
        {logoSrc
          ? <img src={logoSrc} alt="JiJ" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'contain', flexShrink: 0, boxShadow: '0 0 10px rgba(124,58,237,0.5)' }} />
          : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(109,40,217,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: 'white', flexShrink: 0 }}>J</div>
        }
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={cardLabel}>JIJ / {priceUnit}</div>
            <UnitToggle unit={priceUnit} onToggle={onToggleUnit} />
          </div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: 'white', ...holoNum }}>
            {formatJijPrice(lastPriceSOL, lastSolUsdPrice, priceUnit)}
          </div>
        </div>
        <Sparkline prices={priceHistory} color={up ? '#34d399' : '#f87171'} />
        {priceHistory.length > 1 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: up ? '#34d399' : '#f87171', flexShrink: 0, ...holoNum }}>
            {up ? '▲' : '▼'}{Math.abs(change).toFixed(2)}%
          </span>
        )}
        <div style={{ marginLeft: 'auto', flexShrink: 0, textAlign: 'right' }}>
          <div style={cardLabel}>SOL / USD</div>
          <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: '#93c5fd', ...holoNum }}>
            ${lastSolUsdPrice > 0 ? lastSolUsdPrice.toFixed(2) : '—'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 8px' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: liveColor, boxShadow: `0 0 6px ${liveColor}` }} />
        <span style={dimText}>
          {pollAgo === null ? 'Waiting…'
            : pollAgo <= 5 ? 'Live'
            : pollAgo < 60 ? `${pollAgo}s ago`
            : pollAgo < 900 ? `${Math.floor(pollAgo / 60)}m ago`
            : `last sweep ${Math.floor(pollAgo / 60)}m ago`}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onWalletOpen}
          style={{ ...btnBase, background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }}>
          Wallet
        </button>
        <button onClick={() => setShowStopConfirm(true)} style={btnBase}>
          Stop Bot
        </button>
      </div>

      {showStopConfirm && (
        <Modal onClose={() => setShowStopConfirm(false)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 8 }}>Stop the bot?</div>
          <p style={{ ...mutedText, marginBottom: 20, lineHeight: 1.5 }}>The grid will pause and your SOL stays in the wallet. You can restart anytime.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { stopBots(); setShowStopConfirm(false) }}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Stop Bot
            </button>
            <button onClick={() => setShowStopConfirm(false)}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(124,58,237,0.6)', border: '1px solid rgba(167,139,250,0.4)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Keep Running
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- Reusable modal overlay ---
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ ...card, width: '100%', maxWidth: 320 }}>
        {children}
      </div>
    </div>
  )
}

// --- Grid bar visual ---
function GridBar({ priceUnit }: { priceUnit: PriceUnit }) {
  const { state } = useBotContext()
  const { openOrders, lastPriceSOL, lastSolUsdPrice, gridLower, gridUpper, totalGridFills, gridLevels } = state
  const gridFormat = gridLevels === 60 ? 3 : gridLevels === 40 ? 2 : 1
  const [showPrices, setShowPrices] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (openOrders.length === 0) return null

  const nextSwitchTime = getNextFormatSwitchTime(state)
  const switchCountdown = nextSwitchTime > 0 ? formatCountdown(nextSwitchTime - now) : null

  const sorted = [...openOrders].sort((a, b) => a.price - b.price)
  const sortedDesc = [...openOrders].sort((a, b) => b.price - a.price)
  const pricePct = gridUpper > gridLower
    ? Math.max(0, Math.min(100, ((lastPriceSOL - gridLower) / (gridUpper - gridLower)) * 100))
    : 50

  const fmt = (p: number) => formatJijPrice(p, lastSolUsdPrice, priceUnit)

  return (
    <>
    <div style={{ ...card, textTransform: 'uppercase' }}>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '0.05em' }}>GRID</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', marginTop: 2 }}>FORMAT ({gridFormat})</div>
        {switchCountdown && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginTop: 4, fontFamily: 'monospace' }}>
            NEXT FORMAT SWITCH: {switchCountdown}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '10px 0' }}>
        <span style={dimText}>FILLS: <span style={{ color: 'white', fontWeight: 700 }}>{totalGridFills}</span></span>
        <span style={dimText}>LEVELS: <span style={{ color: 'white', fontWeight: 700 }}>{openOrders.filter(o => !o.filled).length}</span></span>
      </div>

      <div style={{ position: 'relative', height: 32, marginBottom: 10 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'rgba(255,255,255,0.12)', transform: 'translateY(-50%)' }} />
        <div style={{ position: 'absolute', left: 0, top: '50%', height: 8, background: 'rgba(74,222,128,0.15)', borderRadius: '4px 0 0 4px', transform: 'translateY(-50%)', width: `${pricePct}%` }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#60a5fa', left: `${pricePct}%`, boxShadow: '0 0 8px #60a5fa' }}>
          <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#93c5fd', fontFamily: 'monospace', whiteSpace: 'nowrap', ...holoNum }}>
            {fmt(lastPriceSOL)}
          </div>
        </div>
        {sorted.map(o => {
          const pct = ((o.price - gridLower) / (gridUpper - gridLower)) * 100
          const col = o.filled ? 'rgba(255,255,255,0.2)' : o.side === 'buy' ? '#4ade80' : '#f87171'
          return (
            <div key={o.id} style={{
              position: 'absolute', top: '50%', left: `${pct}%`,
              width: 2, height: 12, background: col, borderRadius: 2,
              transform: 'translate(-50%, -50%)',
              boxShadow: o.filled ? 'none' : o.side === 'buy' ? '0 0 4px #4ade80' : '0 0 4px #f87171',
            }} />
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ ...dimText, fontFamily: 'monospace' }}>{fmt(gridLower)}</span>
        <span style={{ ...dimText, fontFamily: 'monospace' }}>{fmt(gridUpper)}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {[['#4ade80', 'BUY'], ['#f87171', 'SELL'], ['rgba(255,255,255,0.25)', 'FILLED']].map(([color, label]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, ...dimText }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: color === 'rgba(255,255,255,0.25)' ? 'none' : `0 0 4px ${color}` }} />
              {label}
            </span>
          ))}
        </div>
        <button onClick={() => setShowPrices(true)}
          style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
          PRICES
        </button>
      </div>
    </div>

    {showPrices && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
        onClick={e => { if (e.target === e.currentTarget) setShowPrices(false) }}>
        <div style={{ ...card, width: '100%', maxWidth: 320, maxHeight: '80vh', display: 'flex', flexDirection: 'column', textTransform: 'uppercase' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>GRID PRICES</div>
            <button onClick={() => setShowPrices(false)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(180,180,220,0.7)', cursor: 'pointer', textTransform: 'uppercase' }}>
              CLOSE
            </button>
          </div>

          {lastPriceSOL > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>▶ NOW</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#93c5fd' }}>{fmt(lastPriceSOL)}</span>
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {sortedDesc.map(o => {
              const isNear = lastPriceSOL > 0 && Math.abs(o.price - lastPriceSOL) / lastPriceSOL < 0.005
              const isBuy = o.side === 'buy'
              return (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6, marginBottom: 2,
                  background: isNear ? 'rgba(251,191,36,0.08)' : 'transparent',
                  border: isNear ? '1px solid rgba(251,191,36,0.25)' : '1px solid transparent',
                  opacity: o.filled ? 0.3 : 1,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, width: 28, color: isBuy ? '#4ade80' : '#f87171' }}>
                    {isBuy ? 'BUY' : 'SELL'}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'white', flex: 1 }}>
                    {fmt(o.price)}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(160,160,200,0.5)' }}>L{o.level}</span>
                  {o.filled && <span style={{ fontSize: 10, color: 'rgba(160,160,200,0.4)' }}>✓</span>}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={dimText}>OPEN: <span style={{ color: 'white', fontWeight: 700 }}>{openOrders.filter(o => !o.filled).length}</span></span>
            <span style={dimText}>FILLED: <span style={{ color: 'white', fontWeight: 700 }}>{openOrders.filter(o => o.filled).length}</span></span>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// --- Stat card ---
function StatCard({ label, value, sub, color, glow }: { label: string; value: string; sub: string; color: string; glow: string }) {
  return (
    <div style={card}>
      <div style={cardLabel}>{label}</div>
      <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color, textShadow: `0 0 12px ${glow}` }}>{value}</div>
      <div style={{ ...dimText, marginTop: 2 }}>{sub}</div>
    </div>
  )
}

const TAX_PRESETS = [20, 30, 40, 50]

// --- Stats row ---
function StatsRow() {
  const { state, topUpSOL, updateConfig, refreshBalance } = useBotContext()
  const { realizedPnLSOL, realizedPnLUSD, gridReserve, trailBuffer, taxReserveUSDC, lastSolUsdPrice, config } = state
  const [showTopUp, setShowTopUp] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpBusy, setTopUpBusy] = useState(false)
  const [walletSOL, setWalletSOL] = useState<number | null>(null)
  const [editingTax, setEditingTax] = useState(false)
  const [draftTaxPct, setDraftTaxPct] = useState(config.taxReservePct)

  const gridUSD = gridReserve * lastSolUsdPrice
  const trailUSD = trailBuffer * lastSolUsdPrice

  const openTopUp = async () => {
    setShowTopUp(true)
    try { setWalletSOL(await refreshBalance()) } catch { setWalletSOL(null) }
  }

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount)
    if (!amount || amount <= 0) return
    setTopUpBusy(true)
    try {
      await topUpSOL(amount)
      setShowTopUp(false)
      setTopUpAmount('')
    } finally {
      setTopUpBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 10, padding: '10px 48px 10px 14px', color: 'white', fontFamily: 'monospace',
    fontSize: 16, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard label="Realized P&L" value={`+${realizedPnLSOL.toFixed(6)}`} sub={`$${realizedPnLUSD.toFixed(2)}`}
          color="#4ade80" glow="rgba(74,222,128,0.3)" />

        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={cardLabel}>Grid Reserve</div>
            <button onClick={openTopUp}
              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', fontWeight: 700, cursor: 'pointer' }}>
              + Top Up
            </button>
          </div>
          <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: '#60a5fa', textShadow: '0 0 12px rgba(96,165,250,0.3)' }}>
            {gridReserve.toFixed(4)} SOL
          </div>
          <div style={{ ...dimText, marginTop: 2 }}>${gridUSD.toFixed(2)}</div>
        </div>

        <StatCard label="Trail Buffer" value={`${trailBuffer.toFixed(4)} SOL`} sub={`$${trailUSD.toFixed(2)}`}
          color="#fbbf24" glow="rgba(251,191,36,0.3)" />
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={cardLabel}>Tax Reserve</div>
            {!editingTax
              ? <button onClick={() => { setDraftTaxPct(config.taxReservePct); setEditingTax(true) }}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(192,132,252,0.15)', border: '1px solid rgba(192,132,252,0.35)', color: '#c084fc', fontWeight: 700, cursor: 'pointer' }}>
                  Edit
                </button>
              : <button onClick={() => { updateConfig({ taxReservePct: draftTaxPct }); setEditingTax(false) }}
                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80', fontWeight: 700, cursor: 'pointer' }}>
                  Save
                </button>
            }
          </div>
          <div style={{ fontSize: 15, fontFamily: 'monospace', fontWeight: 700, color: '#c084fc', textShadow: '0 0 12px rgba(192,132,252,0.3)' }}>
            ${taxReserveUSDC.toFixed(2)} <span style={{ ...dimText, fontSize: 10 }}>USDC</span>
          </div>
          {editingTax
            ? <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                {TAX_PRESETS.map(pct => (
                  <button key={pct} onClick={() => setDraftTaxPct(pct)}
                    style={{
                      flex: 1, padding: '3px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: draftTaxPct === pct ? '1px solid rgba(167,139,250,0.6)' : '1px solid rgba(255,255,255,0.12)',
                      background: draftTaxPct === pct ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)',
                      color: draftTaxPct === pct ? '#e9d5ff' : 'rgba(180,180,220,0.5)',
                    }}>
                    {pct}%
                  </button>
                ))}
              </div>
            : <div style={{ ...dimText, marginTop: 2 }}>Rate: {config.taxReservePct}% · USDC secured</div>
          }
        </div>
      </div>

      {showTopUp && (
        <Modal onClose={() => { setShowTopUp(false); setTopUpAmount('') }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 }}>Add SOL to Grid</div>
          <p style={{ ...dimText, marginBottom: 12, lineHeight: 1.5 }}>30% buys JiJ immediately · 70% added to grid reserve</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ ...dimText, fontSize: 13 }}>
              Available: <span style={{ color: 'white', fontWeight: 600 }}>
                {walletSOL != null ? `${walletSOL.toFixed(4)} SOL` : '…'}
              </span>
            </span>
            {walletSOL != null && walletSOL > 0.000005 && (
              <button onClick={() => setTopUpAmount((walletSOL - 0.000005).toFixed(4))}
                style={{ fontSize: 12, fontWeight: 600, color: '#93c5fd', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}>
                Max
              </button>
            )}
          </div>
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input type="number" min="0.01" step="0.01" value={topUpAmount}
              onChange={e => setTopUpAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(180,180,220,0.7)', fontSize: 13, fontWeight: 600 }}>SOL</span>
          </div>
          {topUpAmount && parseFloat(topUpAmount) > 0 && (
            <div style={{ ...dimText, marginBottom: 16, lineHeight: 1.8 }}>
              <div>Seed buy: <span style={{ color: '#93c5fd', fontWeight: 600 }}>{(parseFloat(topUpAmount) * 0.30).toFixed(4)} SOL → JiJ</span></div>
              <div>Reserve: <span style={{ color: '#93c5fd', fontWeight: 600 }}>+{(parseFloat(topUpAmount) * 0.70).toFixed(4)} SOL</span></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleTopUp} disabled={topUpBusy || !topUpAmount || parseFloat(topUpAmount) <= 0}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(96,165,250,0.4)', border: '1px solid rgba(96,165,250,0.5)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (topUpBusy || !topUpAmount) ? 0.5 : 1 }}>
              {topUpBusy ? 'Sending…' : 'Confirm'}
            </button>
            <button onClick={() => { setShowTopUp(false); setTopUpAmount('') }}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

// --- DCA card ---
function DCACard() {
  const { state, setDCAStatus, updateConfig } = useBotContext()
  const { dcaStatus, dcaPool, lastSolUsdPrice, totalDCABuys, totalJIJviaDCA, dcaBuyHistory, config } = state
  const [showConfirm, setShowConfirm] = useState(false)
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitDraft, setLimitDraft] = useState('')

  const confirmEditLimit = () => {
    const val = parseFloat(limitDraft)
    if (!isNaN(val) && val > 0) updateConfig({ dailyDCALimitUSD: val })
    setEditingLimit(false)
  }

  const scheduledLabel = getDCAScheduledTimeLabel(state)
  const lastBuy = dcaBuyHistory[0]

  const statusBtn = (s: 'on' | 'off', active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
    border: active
      ? (s === 'on' ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.25)')
      : '1px solid rgba(255,255,255,0.1)',
    background: active
      ? (s === 'on' ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)')
      : 'rgba(255,255,255,0.04)',
    color: active
      ? (s === 'on' ? '#4ade80' : 'white')
      : 'rgba(180,180,200,0.4)',
    opacity: dcaStatus === 'deactivated' ? 0.4 : 1,
  })

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>DCA Bot</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setDCAStatus('on')} disabled={dcaStatus === 'deactivated'}
            style={statusBtn('on', dcaStatus === 'on')}>ON</button>
          <button onClick={() => setDCAStatus('off')} disabled={dcaStatus === 'deactivated'}
            style={statusBtn('off', dcaStatus === 'off')}>OFF</button>
          {dcaStatus !== 'deactivated' ? (
            <button onClick={() => setShowConfirm(true)}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
              Deactivate
            </button>
          ) : (
            <button onClick={() => setDCAStatus('off')}
              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(96,165,250,0.4)', background: 'rgba(96,165,250,0.15)', color: '#93c5fd' }}>
              Reactivate
            </button>
          )}
        </div>
      </div>

      <div style={row}>
        <span style={mutedText}>Pool</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: 13, ...holoNum }}>
          {dcaPool.toFixed(4)} SOL
          {lastSolUsdPrice > 0 && <span style={{ ...dimText, marginLeft: 6 }}>(${(dcaPool * lastSolUsdPrice).toFixed(2)})</span>}
        </span>
      </div>

      <div style={row}>
        <span style={mutedText}>Daily limit</span>
        {editingLimit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={dimText}>$</span>
            <input type="number" min="1" value={limitDraft}
              onChange={e => setLimitDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmEditLimit(); if (e.key === 'Escape') setEditingLimit(false) }}
              style={{ width: 72, background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 13, fontFamily: 'monospace', borderRadius: 6, padding: '3px 8px', border: '1px solid rgba(167,139,250,0.5)', outline: 'none' }}
              autoFocus />
            <button onClick={confirmEditLimit} style={{ color: '#4ade80', fontWeight: 700, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>✓</button>
            <button onClick={() => setEditingLimit(false)} style={{ color: 'rgba(180,180,200,0.5)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>${config.dailyDCALimitUSD}/day</span>
            <button onClick={() => { setLimitDraft(String(config.dailyDCALimitUSD)); setEditingLimit(true) }}
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.4)', background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', cursor: 'pointer', fontWeight: 600 }}>
              Edit
            </button>
          </div>
        )}
      </div>

      <div style={row}>
        <span style={mutedText}>Next buy</span>
        <span style={{ ...dimText, textAlign: 'right', maxWidth: 160 }}>
          {dcaStatus === 'off' ? 'Skipped — bot OFF' :
           dcaStatus === 'deactivated' ? 'Deactivated' :
           dcaPool <= 0 ? 'Waiting for profits' :
           state.todayBuyExecuted ? '✓ Done today' :
           scheduledLabel}
        </span>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={mutedText}>JiJ Accumulated</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c084fc', fontSize: 15, ...holoNum }}>
            {totalJIJviaDCA > 0 ? totalJIJviaDCA.toFixed(2) : '—'}
            {totalJIJviaDCA > 0 && <span style={{ ...dimText, marginLeft: 4 }}>JiJ</span>}
          </span>
        </div>
        {lastBuy && (
          <div style={dimText}>
            Last buy: {new Date(lastBuy.timestamp).toLocaleDateString()} · {lastBuy.jijReceived.toFixed(0)} JiJ for ${lastBuy.usdValue.toFixed(2)}
            {totalDCABuys > 1 && <span style={{ color: 'rgba(160,160,200,0.35)', marginLeft: 4 }}>({totalDCABuys} total)</span>}
          </div>
        )}
      </div>

      {showConfirm && (
        <Modal onClose={() => setShowConfirm(false)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Deactivate DCA?</div>
          <p style={{ ...mutedText, marginBottom: 4 }}>Pool balance: <span style={{ color: 'white', fontFamily: 'monospace', fontWeight: 700 }}>{dcaPool.toFixed(4)} SOL</span></p>
          <p style={{ ...dimText, marginBottom: 20, lineHeight: 1.5 }}>Pool is preserved. Profits will go to Grid and Trail Buffer instead.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setDCAStatus('deactivated'); setShowConfirm(false) }}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Deactivate
            </button>
            <button onClick={() => setShowConfirm(false)}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const CAUSE_PRESETS = [1, 2, 3, 4, 5]

// --- The Cause card ---
function CauseCard() {
  const { state, setCausePct } = useBotContext()
  const { causePct, causePool, totalCauseDonatedSOL, lastSolUsdPrice } = state

  const pctBtn = (pct: number): React.CSSProperties => ({
    flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
    border: causePct === pct ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.12)',
    background: causePct === pct ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)',
    color: causePct === pct ? '#4ade80' : 'rgba(180,180,220,0.5)',
  })

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>The Cause</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
          ALWAYS ON
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {CAUSE_PRESETS.map(pct => (
          <button key={pct} onClick={() => setCausePct(pct)} style={pctBtn(pct)}>{pct}%</button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={mutedText}>Pending send</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: 13, ...holoNum }}>
          {causePool.toFixed(4)} SOL
          {lastSolUsdPrice > 0 && <span style={{ ...dimText, marginLeft: 6 }}>(${(causePool * lastSolUsdPrice).toFixed(2)})</span>}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={mutedText}>Donated to M.A.P.L.E.</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4ade80', fontSize: 13, ...holoNum }}>
          {totalCauseDonatedSOL.toFixed(4)} SOL
          {lastSolUsdPrice > 0 && <span style={{ ...dimText, marginLeft: 6 }}>(${(totalCauseDonatedSOL * lastSolUsdPrice).toFixed(2)})</span>}
        </span>
      </div>

      <div style={{ ...dimText, lineHeight: 1.5 }}>
        {`Skimming ${causePct}% of profits after tax reserve — sent directly to M.A.P.L.E.'s donation wallet as it accrues. Minimum 1%, choose up to 5%.`}
      </div>
    </div>
  )
}

// --- Session card ---
function SessionCard() {
  const { state, emergencyStop, reanchorGrid } = useBotContext()
  const { highWaterMark, sessionStartValue, gridReserve, trailBuffer, dcaPool, lastSolUsdPrice, config } = state
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false)
  const [showReanchorConfirm, setShowReanchorConfirm] = useState(false)
  const [reanchorBusy, setReanchorBusy] = useState(false)

  const currentValue = gridReserve + trailBuffer + dcaPool
  const sessionPnL = currentValue - sessionStartValue
  const sessionPnLUSD = sessionPnL * lastSolUsdPrice

  const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Session</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowReanchorConfirm(true)}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#93c5fd', cursor: 'pointer' }}>
            Re-anchor
          </button>
          <button onClick={() => setShowEmergencyConfirm(true)}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', cursor: 'pointer' }}>
            Emergency Stop
          </button>
        </div>
      </div>

      <div style={row}>
        <span style={mutedText}>Committed</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: 13, ...holoNum }}>{config.gridSOL.toFixed(4)} SOL</span>
      </div>
      <div style={row}>
        <span style={mutedText}>Session P&L</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: sessionPnL >= 0 ? '#4ade80' : '#f87171', fontSize: 13, ...holoNum }}>
          {sessionPnL >= 0 ? '+' : ''}{sessionPnL.toFixed(6)} SOL
          <span style={{ ...dimText, marginLeft: 6 }}>(${sessionPnLUSD.toFixed(2)})</span>
        </span>
      </div>
      {highWaterMark > 0 && (
        <div style={row}>
          <span style={mutedText}>High water mark</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fde68a', fontSize: 13, ...holoNum }}>{highWaterMark.toFixed(8)}</span>
        </div>
      )}
      <div style={row}>
        <span style={mutedText}>Entry price</span>
        <span style={{ fontFamily: 'monospace', color: 'rgba(200,200,220,0.7)', fontSize: 12 }}>{config.entryPrice.toFixed(8)}</span>
      </div>

      {showReanchorConfirm && (
        <Modal onClose={() => { if (!reanchorBusy) setShowReanchorConfirm(false) }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#93c5fd', marginBottom: 8 }}>Re-anchor Grid?</div>
          <p style={{ ...mutedText, marginBottom: 4, lineHeight: 1.5 }}>
            Collapses your grid reserve + trail buffer ({(gridReserve + trailBuffer).toFixed(4)} SOL) into a fresh grid at the current price.
          </p>
          <p style={{ ...dimText, marginBottom: 20, lineHeight: 1.5 }}>
            A new seed buy will run. Use this when price has moved above your grid range and the trail buffer is exhausted.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={reanchorBusy}
              onClick={async () => {
                setReanchorBusy(true)
                try { await reanchorGrid() } finally {
                  setReanchorBusy(false)
                  setShowReanchorConfirm(false)
                }
              }}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(96,165,250,0.25)', border: '1px solid rgba(96,165,250,0.5)', color: '#93c5fd', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: reanchorBusy ? 'not-allowed' : 'pointer', opacity: reanchorBusy ? 0.6 : 1 }}>
              {reanchorBusy ? 'Re-anchoring…' : 'Confirm'}
            </button>
            <button onClick={() => setShowReanchorConfirm(false)} disabled={reanchorBusy}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {showEmergencyConfirm && (
        <Modal onClose={() => setShowEmergencyConfirm(false)}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Emergency Stop?</div>
          <p style={{ ...mutedText, marginBottom: 20, lineHeight: 1.5 }}>All activity halts immediately. Your DCA pool and grid reserve are preserved.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { emergencyStop(); setShowEmergencyConfirm(false) }}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Stop Now
            </button>
            <button onClick={() => setShowEmergencyConfirm(false)}
              style={{ flex: 1, padding: '10px 0', background: 'rgba(124,58,237,0.5)', border: '1px solid rgba(167,139,250,0.4)', color: 'white', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Keep Running
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// --- Activity feed ---
function ActivityFeed() {
  const { state } = useBotContext()
  const entries = state.activityLog.slice(0, 20)

  const typeColor: Record<string, string> = {
    GRID_FILL: '#60a5fa', DCA_BUY: '#c084fc', TAX_RESERVE: '#4ade80',
    TRAIL_SHIFT: '#fbbf24', ERROR: '#f87171', DCA_SKIP: 'rgba(180,180,200,0.3)',
    PROFIT_ROUTE: '#2dd4bf', SAFETY: '#fb923c', INFO: 'rgba(180,180,200,0.3)',
    DCA_STATE_CHANGE: '#93c5fd',
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12 }}>Activity</div>
      {entries.length === 0 ? (
        <div style={{ ...dimText, textAlign: 'center', padding: '12px 0' }}>Waiting for first trade…</div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: e.type === 'ERROR' ? 'flex-start' : 'center' }}>
              <span style={{ ...dimText, flexShrink: 0, width: 48, fontFamily: 'monospace' }}>
                {new Date(e.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ color: typeColor[e.type] ?? 'rgba(180,180,200,0.4)', flexShrink: 0 }}>●</span>
              <span style={{ fontSize: 12, color: 'rgba(210,210,230,0.8)', overflow: 'hidden', textOverflow: e.type === 'ERROR' ? 'clip' : 'ellipsis', whiteSpace: e.type === 'ERROR' ? 'normal' : 'nowrap', wordBreak: e.type === 'ERROR' ? 'break-all' : undefined }}>
                {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main export ---
export function LiveDashboard({ bgImage, logoSrc, appVersion }: { bgImage?: string; logoSrc?: string; appVersion?: string }) {
  const [walletOpen, setWalletOpen] = useState(false)
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('SOL')
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#030712' }),
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2,4,16,0.38)' }} />
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <VersionBadge version={appVersion} variant="inline" />
        <PriceStrip logoSrc={logoSrc} onWalletOpen={() => setWalletOpen(true)} priceUnit={priceUnit} onToggleUnit={setPriceUnit} />
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '14px 16px 24px' }}>
          <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StatsRow />
            <GridBar priceUnit={priceUnit} />
            <DCACard />
            <CauseCard />
            <SessionCard />
            <ActivityFeed />
          </div>
        </div>
      </div>
      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  )
}
