import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useBotContext } from './BotContext'
import { JIJ_MINT, USDC_MINT } from '@jij-bot/core'

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`
}

function QRCanvas({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, data, {
      width: 180, margin: 1,
      color: { dark: '#ffffff', light: '#00000000' },
    }).catch(console.error)
  }, [data])
  return <canvas ref={canvasRef} style={{ borderRadius: 12 }} />
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12, padding: '10px 14px', color: 'white', fontSize: 13,
  fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
}

const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}

const mutedLabel: React.CSSProperties = { fontSize: 13, color: 'rgba(180,180,220,0.6)' }
const dimText: React.CSSProperties = { fontSize: 11, color: 'rgba(160,160,200,0.5)' }

const actionBtn = (color: string, border: string): React.CSSProperties => ({
  width: '100%', padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600,
  border: `1px solid ${border}`, background: color, color: 'white', cursor: 'pointer',
})

export function WalletModal({ onClose }: { onClose: () => void }) {
  const { state, platform, withdrawSOL, withdrawJiJ, withdrawUSDC, exportPrivateKey, refreshBalance } = useBotContext()
  const address = state.walletPublicKey ?? ''

  const [solBalance, setSolBalance] = useState<number | null>(null)
  const [jijBalance, setJijBalance] = useState<number | null>(null)
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

  const [showKeyExport, setShowKeyExport] = useState(false)
  const [exportedKey, setExportedKey] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  const [exportErr, setExportErr] = useState('')
  const [keyCopied, setKeyCopied] = useState(false)

  const [showWithdraw, setShowWithdraw] = useState(false)
  const [withdrawAddr, setWithdrawAddr] = useState('')
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [withdrawBusy, setWithdrawBusy] = useState(false)
  const [withdrawTx, setWithdrawTx] = useState('')
  const [withdrawErr, setWithdrawErr] = useState('')

  const [showJijWithdraw, setShowJijWithdraw] = useState(false)
  const [jijWithdrawAddr, setJijWithdrawAddr] = useState('')
  const [jijWithdrawAmt, setJijWithdrawAmt] = useState('')
  const [jijWithdrawBusy, setJijWithdrawBusy] = useState(false)
  const [jijWithdrawTx, setJijWithdrawTx] = useState('')
  const [jijWithdrawErr, setJijWithdrawErr] = useState('')

  const [showUsdcWithdraw, setShowUsdcWithdraw] = useState(false)
  const [usdcWithdrawAddr, setUsdcWithdrawAddr] = useState('')
  const [usdcWithdrawAmt, setUsdcWithdrawAmt] = useState('')
  const [usdcWithdrawBusy, setUsdcWithdrawBusy] = useState(false)
  const [usdcWithdrawTx, setUsdcWithdrawTx] = useState('')
  const [usdcWithdrawErr, setUsdcWithdrawErr] = useState('')

  const fetchBalances = async () => {
    if (!platform) return
    setRefreshing(true)
    try {
      const [sol, jij, usdc] = await Promise.all([
        platform.wallet.getBalance(),
        platform.wallet.getBalance(JIJ_MINT),
        platform.wallet.getBalance(USDC_MINT),
      ])
      setSolBalance(sol); setJijBalance(jij); setUsdcBalance(usdc)
    } catch { /* keep previous */ } finally { setRefreshing(false) }
  }

  useEffect(() => { fetchBalances() }, [])

  const maxSOL = solBalance != null ? Math.max(0, solBalance - 0.000005) : 0
  const maxJiJ = jijBalance ?? 0
  const maxUSDC = usdcBalance ?? 0

  const handleWithdrawSOL = async () => {
    if (!withdrawAddr.trim()) { setWithdrawErr('Enter a destination address'); return }
    setWithdrawErr(''); setWithdrawTx(''); setWithdrawBusy(true)
    try {
      const amount = withdrawAmt ? parseFloat(withdrawAmt) : undefined
      if (amount !== undefined && (isNaN(amount) || amount <= 0)) { setWithdrawErr('Enter a valid amount'); return }
      const sig = await withdrawSOL(withdrawAddr.trim(), amount)
      setWithdrawTx(sig); setWithdrawAddr(''); setWithdrawAmt('')
      await fetchBalances()
    } catch (e) { setWithdrawErr(String(e)) } finally { setWithdrawBusy(false) }
  }

  const handleWithdrawJiJ = async () => {
    if (!jijWithdrawAddr.trim()) { setJijWithdrawErr('Enter a destination address'); return }
    setJijWithdrawErr(''); setJijWithdrawTx(''); setJijWithdrawBusy(true)
    try {
      const amount = jijWithdrawAmt ? parseFloat(jijWithdrawAmt) : undefined
      if (amount !== undefined && (isNaN(amount) || amount <= 0)) { setJijWithdrawErr('Enter a valid amount'); return }
      const sig = await withdrawJiJ(jijWithdrawAddr.trim(), amount)
      setJijWithdrawTx(sig); setJijWithdrawAddr(''); setJijWithdrawAmt('')
      await fetchBalances()
    } catch (e) { setJijWithdrawErr(String(e)) } finally { setJijWithdrawBusy(false) }
  }

  const handleWithdrawUSDC = async () => {
    if (!usdcWithdrawAddr.trim()) { setUsdcWithdrawErr('Enter a destination address'); return }
    setUsdcWithdrawErr(''); setUsdcWithdrawTx(''); setUsdcWithdrawBusy(true)
    try {
      const amount = usdcWithdrawAmt ? parseFloat(usdcWithdrawAmt) : undefined
      if (amount !== undefined && (isNaN(amount) || amount <= 0)) { setUsdcWithdrawErr('Enter a valid amount'); return }
      const sig = await withdrawUSDC(usdcWithdrawAddr.trim(), amount)
      setUsdcWithdrawTx(sig); setUsdcWithdrawAddr(''); setUsdcWithdrawAmt('')
      await fetchBalances()
    } catch (e) { setUsdcWithdrawErr(String(e)) } finally { setUsdcWithdrawBusy(false) }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
      <div style={{
        background: 'rgba(8,10,24,0.96)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px 24px 0 0',
        padding: '24px 20px 32px', width: '100%', maxWidth: 420,
        maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>Bot Wallet</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(200,200,220,0.8)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* QR + address */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {address && (
            <div style={{ padding: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)' }}>
              <QRCanvas data={`solana:${address}`} />
            </div>
          )}
          <div style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'rgba(180,180,220,0.8)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortAddr(address)}</span>
            <button onClick={() => { navigator.clipboard.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
              style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0, border: copied ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.12)', background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)', color: copied ? '#4ade80' : 'rgba(200,200,220,0.7)' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ ...dimText, textAlign: 'center' }}>Send SOL to this address to fund the bot</p>
        </div>

        {/* Balances */}
        <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...rowStyle, marginBottom: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(180,180,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Balances</span>
            <button onClick={fetchBalances} disabled={refreshing}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(180,180,220,0.5)', cursor: 'pointer', opacity: refreshing ? 0.4 : 1 }}>
              {refreshing ? '…' : 'Refresh'}
            </button>
          </div>
          {[['SOL', solBalance?.toFixed(6), 'white'], ['JiJ', jijBalance != null ? jijBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : null, '#c084fc'], ['USDC', usdcBalance != null ? usdcBalance.toFixed(2) : null, '#4ade80']].map(([label, val, color]) => (
            <div key={label as string} style={rowStyle}>
              <span style={mutedLabel}>{label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 600, color: color as string }}>{val ?? '—'}</span>
            </div>
          ))}
        </div>

        {/* Withdraw SOL */}
        {!showWithdraw && !withdrawTx && (
          <button onClick={() => setShowWithdraw(true)} style={actionBtn('rgba(255,255,255,0.07)', 'rgba(255,255,255,0.15)')}>Withdraw SOL</button>
        )}
        {showWithdraw && !withdrawTx && (
          <WithdrawForm label="Withdraw SOL" unit="SOL" addr={withdrawAddr} setAddr={setWithdrawAddr}
            amt={withdrawAmt} setAmt={setWithdrawAmt} max={maxSOL} maxLabel={`${maxSOL.toFixed(4)} SOL`}
            busy={withdrawBusy} err={withdrawErr} onSubmit={handleWithdrawSOL}
            onCancel={() => { setShowWithdraw(false); setWithdrawErr(''); setWithdrawAmt(''); setWithdrawAddr('') }} />
        )}
        {withdrawTx && <TxSuccess label="Withdrawal sent" tx={withdrawTx} onReset={() => setWithdrawTx('')} />}

        {/* Withdraw JiJ */}
        {!showJijWithdraw && !jijWithdrawTx && (
          <button onClick={() => { setShowWithdraw(false); setShowJijWithdraw(true) }} disabled={maxJiJ <= 0}
            style={{ ...actionBtn('rgba(124,58,237,0.15)', 'rgba(167,139,250,0.25)'), color: '#c4b5fd', opacity: maxJiJ <= 0 ? 0.35 : 1 }}>Withdraw JiJ</button>
        )}
        {showJijWithdraw && !jijWithdrawTx && (
          <WithdrawForm label="Withdraw JiJ" unit="JiJ" addr={jijWithdrawAddr} setAddr={setJijWithdrawAddr}
            amt={jijWithdrawAmt} setAmt={setJijWithdrawAmt} max={maxJiJ} maxLabel={`${maxJiJ.toFixed(0)} JiJ`}
            busy={jijWithdrawBusy} err={jijWithdrawErr} onSubmit={handleWithdrawJiJ}
            onCancel={() => { setShowJijWithdraw(false); setJijWithdrawErr(''); setJijWithdrawAmt(''); setJijWithdrawAddr('') }} />
        )}
        {jijWithdrawTx && <TxSuccess label="JiJ withdrawal sent" tx={jijWithdrawTx} onReset={() => setJijWithdrawTx('')} />}

        {/* Withdraw USDC */}
        {!showUsdcWithdraw && !usdcWithdrawTx && (
          <button onClick={() => { setShowWithdraw(false); setShowJijWithdraw(false); setShowUsdcWithdraw(true) }} disabled={maxUSDC <= 0}
            style={{ ...actionBtn('rgba(74,222,128,0.1)', 'rgba(74,222,128,0.2)'), color: '#86efac', opacity: maxUSDC <= 0 ? 0.35 : 1 }}>Withdraw USDC</button>
        )}
        {showUsdcWithdraw && !usdcWithdrawTx && (
          <WithdrawForm label="Withdraw USDC" unit="USDC" addr={usdcWithdrawAddr} setAddr={setUsdcWithdrawAddr}
            amt={usdcWithdrawAmt} setAmt={setUsdcWithdrawAmt} max={maxUSDC} maxLabel={`$${maxUSDC.toFixed(2)} USDC`}
            busy={usdcWithdrawBusy} err={usdcWithdrawErr} onSubmit={handleWithdrawUSDC}
            onCancel={() => { setShowUsdcWithdraw(false); setUsdcWithdrawErr(''); setUsdcWithdrawAmt(''); setUsdcWithdrawAddr('') }} />
        )}
        {usdcWithdrawTx && <TxSuccess label="USDC withdrawal sent" tx={usdcWithdrawTx} onReset={() => setUsdcWithdrawTx('')} />}

        {/* Export private key */}
        {exportPrivateKey && !exportedKey && !showKeyExport && (
          <button onClick={() => setShowKeyExport(true)} style={{ ...actionBtn('rgba(255,255,255,0.04)', 'rgba(255,255,255,0.1)'), color: 'rgba(180,180,220,0.45)' }}>Export Private Key</button>
        )}
        {exportPrivateKey && showKeyExport && !exportedKey && (
          <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Backup your private key</div>
            <p style={{ ...dimText, lineHeight: 1.6 }}>Full wallet access. Store safely — cannot be recovered if lost. Never share it.</p>
            {exportErr && <div style={{ fontSize: 12, color: '#f87171' }}>{exportErr}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => { setExportBusy(true); setExportErr(''); try { setExportedKey(await exportPrivateKey()); setShowKeyExport(false) } catch (e) { setExportErr(String(e)) } finally { setExportBusy(false) } }}
                disabled={exportBusy} style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.35)', color: '#fde68a', cursor: 'pointer', opacity: exportBusy ? 0.5 : 1 }}>
                {exportBusy ? 'Decrypting…' : 'Reveal Key'}
              </button>
              <button onClick={() => { setShowKeyExport(false); setExportErr('') }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(180,180,220,0.6)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {exportPrivateKey && exportedKey && (
          <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>Private Key — keep this secret</div>
            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'rgba(220,220,240,0.8)', wordBreak: 'break-all', userSelect: 'all' }}>{exportedKey}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(exportedKey).then(() => { setKeyCopied(true); setTimeout(() => setKeyCopied(false), 3000) }) }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: keyCopied ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(255,255,255,0.1)', background: keyCopied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', color: keyCopied ? '#4ade80' : 'rgba(180,180,220,0.6)' }}>
                {keyCopied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => setExportedKey('')}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(180,180,220,0.6)', cursor: 'pointer' }}>
                Hide
              </button>
            </div>
          </div>
        )}

        <p style={{ ...dimText, textAlign: 'center' }}>Your private key never leaves this device</p>
      </div>
    </div>
  )
}

function WithdrawForm({ label, unit, addr, setAddr, amt, setAmt, max, maxLabel, busy, err, onSubmit, onCancel }: {
  label: string; unit: string; addr: string; setAddr: (v: string) => void
  amt: string; setAmt: (v: string) => void; max: number; maxLabel: string
  busy: boolean; err: string; onSubmit: () => void; onCancel: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{label}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(180,180,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Destination address</div>
        <input type="text" value={addr} onChange={e => setAddr(e.target.value)} placeholder="Solana wallet address" style={inp} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(180,180,220,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Amount</div>
          <button onClick={() => setAmt(String(max))} style={{ fontSize: 10, color: '#c4b5fd', background: 'none', border: 'none', cursor: 'pointer' }}>Max ({maxLabel})</button>
        </div>
        <div style={{ position: 'relative' }}>
          <input type="number" min="0" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Leave blank to withdraw all" style={{ ...inp, paddingRight: 48 }} />
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(180,180,220,0.5)' }}>{unit}</span>
        </div>
      </div>
      {err && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '8px 12px' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSubmit} disabled={busy || !addr.trim()}
          style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'rgba(124,58,237,0.6)', border: '1px solid rgba(167,139,250,0.4)', color: 'white', cursor: 'pointer', opacity: (busy || !addr.trim()) ? 0.45 : 1 }}>
          {busy ? 'Sending…' : 'Confirm'}
        </button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(200,200,220,0.8)', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function TxSuccess({ label, tx, onReset }: { label: string; tx: string; onReset: () => void }) {
  return (
    <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(180,180,220,0.6)', wordBreak: 'break-all' }}>{tx}</div>
      <button onClick={onReset} style={{ fontSize: 11, color: 'rgba(180,180,220,0.5)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', padding: 0 }}>Make another withdrawal</button>
    </div>
  )
}
