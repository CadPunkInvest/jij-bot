import React, { useEffect, useState } from 'react'
import { useBotContext } from './BotContext'
import { MIN_GRID_SOL, RECOMMENDED_GRID_SOL, GRID_RANGE_PCT } from '@jij-bot/core'
import { WalletModal } from './WalletModal'

const holoNum: React.CSSProperties = { textShadow: '0 0 12px currentColor' }

const card: React.CSSProperties = {
  background: 'rgba(10,14,32,0.62)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 16,
  padding: '18px 20px',
}

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.55)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 10,
  padding: '10px 48px 10px 14px',
  color: 'white',
  fontSize: 16,
  fontFamily: 'monospace',
  outline: 'none',
  boxSizing: 'border-box',
}

export function SetupScreen({ bgImage, logoSrc }: { bgImage?: string; logoSrc?: string }) {
  const { state, startBots, updateConfig, refreshBalance, withdrawSOL, previewDashboard } = useBotContext()
  const hasExistingConfig = state.config.gridSOL > 0
  const [gridSOL, setGridSOL] = useState(() => hasExistingConfig ? String(state.config.gridSOL) : '')
  const [dailyUSD, setDailyUSD] = useState(() => String(state.config.dailyDCALimitUSD || 50))
  const [starting, setStarting] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAddr, setWithdrawAddr] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawDone, setWithdrawDone] = useState('')
  const [walletOpen, setWalletOpen] = useState(false)

  const address = state.walletPublicKey
  const gridSOLNum = parseFloat(gridSOL) || 0
  const dailyUSDNum = parseFloat(dailyUSD) || 0
  const hasEnoughBalance = balance !== null && gridSOLNum > 0 && balance >= gridSOLNum
  const valid = !!address && gridSOLNum >= MIN_GRID_SOL && dailyUSDNum > 0 && hasEnoughBalance

  const entryGuess = state.lastPriceSOL
  const lowerGuess = entryGuess * (1 - GRID_RANGE_PCT)
  const upperGuess = entryGuess * (1 + GRID_RANGE_PCT)

  const fetchBalance = async () => {
    setBalanceLoading(true)
    try {
      const b = await refreshBalance()
      setBalance(b)
    } catch { /* ignore */ }
    setBalanceLoading(false)
  }

  useEffect(() => {
    if (address) fetchBalance()
  }, [address])

  const copyAddress = () => {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleResume = async () => {
    setError('')
    setResuming(true)
    try {
      await startBots()
    } catch (e) {
      setError(String(e))
      setResuming(false)
    }
  }

  const handleStart = async () => {
    if (!valid) return
    setError('')
    setStarting(true)
    try {
      updateConfig({ gridSOL: gridSOLNum, dailyDCALimitUSD: dailyUSDNum })
      await startBots()
    } catch (e) {
      setError(String(e))
      setStarting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAddr.trim()) return
    setWithdrawBusy(true)
    setWithdrawDone('')
    try {
      const sig = await withdrawSOL(withdrawAddr.trim())
      setWithdrawDone(sig)
      setBalance(0)
    } catch (e) {
      setError(String(e))
    }
    setWithdrawBusy(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      ...(bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: '#030712' }),
    }}>
      {/* Dark overlay — light enough for background to show through cards */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(2,4,16,0.38)',
      }} />

      {/* Scrollable centered column */}
      <div style={{
        position: 'relative', zIndex: 10,
        height: '100%', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '24px 16px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: 540, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {logoSrc
                ? <img src={logoSrc} alt="JiJ" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'contain', boxShadow: '0 0 20px rgba(124,58,237,0.6)' }} />
                : <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(109,40,217,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'white' }}>J</div>
              }
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>JiJ Bot</div>
                <div style={{ fontSize: 12, color: 'rgba(200,200,255,0.6)' }}>Grid + DCA trading</div>
              </div>
            </div>
            <button onClick={() => setWalletOpen(true)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'rgba(124,58,237,0.5)', border: '1px solid rgba(167,139,250,0.4)', color: 'white', cursor: 'pointer' }}>
              Wallet
            </button>
          </div>

          {/* Resume card */}
          {hasExistingConfig && (
            <div style={{ ...card, border: '1px solid rgba(167,139,250,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Resume Bot</div>
                  <div style={{ fontSize: 12, color: 'rgba(200,200,255,0.7)', marginTop: 2 }}>
                    {state.config.gridSOL} SOL grid · ${state.config.dailyDCALimitUSD}/day DCA
                  </div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
              </div>
              {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</div>}
              <button onClick={handleResume} disabled={resuming || !address}
                style={{ width: '100%', padding: '11px 0', background: 'rgba(124,58,237,0.7)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 10, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (resuming || !address) ? 0.5 : 1 }}>
                {resuming ? 'Resuming…' : 'Resume Bot'}
              </button>
            </div>
          )}

          {/* Wallet card */}
          <div style={card}>
            <div style={label}>Bot Wallet</div>
            {address ? (
              <>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#c4b5fd', wordBreak: 'break-all', lineHeight: 1.6, marginBottom: 12, ...holoNum }}>
                  {address}
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button onClick={copyAddress}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer' }}>
                    {copied ? '✓ Copied' : 'Copy Address'}
                  </button>
                  <button onClick={fetchBalance} disabled={balanceLoading}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', opacity: balanceLoading ? 0.5 : 1 }}>
                    {balanceLoading ? 'Checking…' : 'Refresh Balance'}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'rgba(200,200,255,0.7)' }}>Balance</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#4ade80', ...holoNum }}>
                    {balance === null ? '—' : `${balance.toFixed(4)} SOL`}
                  </span>
                </div>
                {balance !== null && balance > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button onClick={() => setShowWithdraw(v => !v)}
                      style={{ fontSize: 12, color: 'rgba(200,200,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      {showWithdraw ? 'Hide' : 'Withdraw SOL →'}
                    </button>
                    {showWithdraw && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input type="text" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)}
                          placeholder="Destination wallet address"
                          style={{ ...inputStyle, fontSize: 11, padding: '8px 12px' }} />
                        {withdrawDone
                          ? <div style={{ fontSize: 11, color: '#4ade80' }}>Withdrawn ✓ tx: {withdrawDone.slice(0, 20)}…</div>
                          : <button onClick={handleWithdraw} disabled={withdrawBusy || !withdrawAddr.trim()}
                              style={{ padding: '8px 0', background: 'rgba(239,68,68,0.25)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#fca5a5', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: (withdrawBusy || !withdrawAddr.trim()) ? 0.5 : 1 }}>
                              {withdrawBusy ? 'Sending…' : 'Withdraw All SOL'}
                            </button>
                        }
                      </div>
                    )}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'rgba(180,180,220,0.55)', marginTop: 12, lineHeight: 1.5 }}>
                  Send SOL here from Phantom or any wallet. The bot signs all trades automatically.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'rgba(200,200,255,0.6)' }}>Initialising wallet…</div>
            )}
          </div>

          {/* Grid Bot card */}
          <div style={{ ...card, opacity: !address ? 0.5 : 1, pointerEvents: !address ? 'none' : 'auto' }}>
            <div style={label}>Grid Bot — SOL Commitment</div>
            <div style={{ position: 'relative' }}>
              <input type="number" value={gridSOL} onChange={e => setGridSOL(e.target.value)}
                placeholder="0.25" step="0.01" min={MIN_GRID_SOL} style={inputStyle} />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(200,200,255,0.7)', fontSize: 14, fontWeight: 700 }}>SOL</span>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 12 }}>
              <span style={{ color: 'rgba(200,200,255,0.7)' }}>Min: <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontWeight: 700, ...holoNum }}>{MIN_GRID_SOL}</span></span>
              <span style={{ color: 'rgba(200,200,255,0.7)' }}>Suggested: <span style={{ color: '#4ade80', fontFamily: 'monospace', fontWeight: 700, ...holoNum }}>{RECOMMENDED_GRID_SOL}</span></span>
              {balance !== null && <span style={{ color: 'rgba(200,200,255,0.7)' }}>Available: <span style={{ color: '#60a5fa', fontFamily: 'monospace', fontWeight: 700, ...holoNum }}>{balance.toFixed(4)}</span></span>}
            </div>
            {gridSOLNum > 0 && !hasEnoughBalance && balance !== null && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#f87171', fontWeight: 600 }}>Wallet only has {balance.toFixed(4)} SOL — fund first.</div>
            )}
            {gridSOLNum >= MIN_GRID_SOL && hasEnoughBalance && entryGuess > 0 && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(200,200,255,0.8)', marginBottom: 6 }}>Grid preview</div>
                {[['Buy zone', lowerGuess, '#4ade80'], ['Entry', entryGuess, '#60a5fa'], ['Sell zone', upperGuess, '#f87171']].map(([lbl, val, color]) => (
                  <div key={lbl as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: 'rgba(200,200,255,0.7)' }}>{lbl}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: color as string, ...holoNum }}>{(val as number).toFixed(8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DCA card */}
          <div style={{ ...card, opacity: !address ? 0.5 : 1, pointerEvents: !address ? 'none' : 'auto' }}>
            <div style={label}>Daily DCA Limit</div>
            <div style={{ position: 'relative' }}>
              <input type="number" value={dailyUSD} onChange={e => setDailyUSD(e.target.value)}
                placeholder="50" min="1" style={inputStyle} />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(200,200,255,0.7)', fontSize: 14, fontWeight: 700 }}>USD</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10 }}>
              {[10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setDailyUSD(String(v))}
                  style={{
                    padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    background: dailyUSD === String(v) ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${dailyUSD === String(v) ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    color: 'white',
                  }}>
                  ${v}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(180,180,220,0.65)', marginTop: 10 }}>
              Bot buys JiJ once daily at a random time using grid profits only.
            </div>
          </div>

          {/* Error */}
          {error && <div style={{ fontSize: 13, color: '#f87171', fontWeight: 600, textAlign: 'center', padding: '4px 0' }}>{error}</div>}

          {/* Start Bot button */}
          <button onClick={handleStart} disabled={!valid || starting}
            style={{
              padding: '16px 0',
              background: valid ? 'rgba(124,58,237,0.85)' : 'rgba(60,60,80,0.6)',
              border: `1px solid ${valid ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 14, color: 'white', fontSize: 16, fontWeight: 800, cursor: valid ? 'pointer' : 'not-allowed',
              boxShadow: valid ? '0 0 32px rgba(124,58,237,0.5)' : 'none',
            }}>
            {starting ? 'Starting…' : 'Start Bot'}
          </button>

          <div style={{ fontSize: 12, color: 'rgba(180,180,220,0.55)', textAlign: 'center' }}>
            Grid bounds set automatically at ±{GRID_RANGE_PCT * 100}% from live price. DCA uses grid profits only.
          </div>

          <button onClick={previewDashboard}
            style={{ background: 'none', border: 'none', color: 'rgba(180,180,220,0.4)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline', padding: 0, textAlign: 'center' }}>
            Preview dashboard layout →
          </button>

        </div>
      </div>

      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  )
}
