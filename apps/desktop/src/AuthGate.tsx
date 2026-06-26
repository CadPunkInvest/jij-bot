import React, { useEffect, useState } from 'react'
import {
  isPinSet,
  setupPin,
  unlockWithPin,
  clearSession,
  isSessionExpired,
  touchSession,
} from './platform/secureKeyStore'
import { getNewKeypairSecretKey } from './platform/localWallet'

const PIN_LENGTH = 6

type AuthState =
  | 'checking'
  | 'pin-setup'
  | 'pin-setup-confirm'
  | 'backup'
  | 'pin-entry'
  | 'unlocked'

function PinPad({
  value,
  onChange,
  label,
  error,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  error: string
  loading: boolean
}) {
  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < value.length)
  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  const press = (k: string) => {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (k === '') return
    if (value.length < PIN_LENGTH) onChange(value + k)
  }

  // Allow keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') press(e.key)
      if (e.key === 'Backspace') press('⌫')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%', maxWidth: 300 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 1.4 }}>{label}</div>

      <div style={{ display: 'flex', gap: 14 }}>
        {dots.map((filled, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            border: `2px solid ${filled ? '#a78bfa' : 'rgba(255,255,255,0.3)'}`,
            background: filled ? '#a78bfa' : 'transparent',
            boxShadow: filled ? '0 0 8px rgba(167,139,250,0.6)' : 'none',
            transition: 'all 0.15s',
          }} />
        ))}
      </div>

      {error && <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={loading || k === ''}
            style={{
              padding: '16px 0',
              borderRadius: 14,
              fontSize: 20,
              fontWeight: 600,
              background: k === '' ? 'transparent' : 'rgba(255,255,255,0.08)',
              border: k === '' ? 'none' : '1px solid rgba(255,255,255,0.12)',
              color: k === '⌫' ? 'rgba(255,255,255,0.45)' : 'white',
              cursor: k === '' ? 'default' : 'pointer',
              visibility: k === '' ? 'hidden' : 'visible',
              opacity: loading ? 0.4 : 1,
              transition: 'background 0.12s',
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

export function AuthGate({
  bgImage,
  logoSrc,
  children,
}: {
  bgImage?: string
  logoSrc?: string
  children: React.ReactNode
}) {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [backupKey, setBackupKey] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [keyCopied, setKeyCopied] = useState(false)

  useEffect(() => {
    init()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authState === 'unlocked' && isSessionExpired()) {
        clearSession()
        setAuthState('checking')
        init()
      } else {
        touchSession()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      if (authState === 'pin-setup') handlePinSetupNext()
      else if (authState === 'pin-setup-confirm') handlePinSetupConfirm()
      else if (authState === 'pin-entry') handlePinUnlock()
    }
  }, [pin])

  function init() {
    if (!isPinSet()) {
      setAuthState('pin-setup')
    } else {
      setAuthState('pin-entry')
    }
  }

  async function handlePinSetupNext() {
    if (pin.length < PIN_LENGTH) return
    setConfirmPin(pin)
    setPin('')
    setError('')
    setAuthState('pin-setup-confirm')
  }

  async function handlePinSetupConfirm() {
    if (pin !== confirmPin) {
      setError('PINs do not match — try again')
      setPin('')
      return
    }
    setLoading(true)
    try {
      const { secretKey, publicKey } = getNewKeypairSecretKey()
      await setupPin(secretKey, pin)
      const hex = Array.from(secretKey).map(b => b.toString(16).padStart(2, '0')).join('')
      setBackupKey(hex)
      setWalletAddress(publicKey)
      setAuthState('backup')
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  async function handlePinUnlock() {
    setLoading(true)
    setError('')
    try {
      await unlockWithPin(pin)
      setAuthState('unlocked')
    } catch {
      setError('Incorrect PIN')
      setPin('')
    }
    setLoading(false)
  }

  if (authState === 'unlocked') return <>{children}</>

  const bg: React.CSSProperties = bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: '#030712' }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, ...bg }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)' }} />
      <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        <div style={{
          background: 'rgba(10,10,20,0.72)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '36px 32px',
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}>

          <div style={{ textAlign: 'center' }}>
            {logoSrc
              ? <img src={logoSrc} alt="JiJ" style={{ width: 52, height: 52, borderRadius: 12, display: 'block', margin: '0 auto 10px', objectFit: 'contain', boxShadow: '0 0 20px rgba(124,58,237,0.6)' }} />
              : <div style={{ width: 52, height: 52, borderRadius: 12, background: 'rgba(109,40,217,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white', margin: '0 auto 10px' }}>J</div>
            }
            <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>JiJ Bot</div>
          </div>

          {authState === 'checking' && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
          )}

          {authState === 'backup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
              <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>⚠ Save your recovery key</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  Write this down or store it securely. If you forget your PIN, this is the only way to recover your wallet.
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>WALLET ADDRESS</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '8px 10px', fontFamily: 'monospace' }}>
                  {walletAddress}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>PRIVATE KEY (hex)</div>
                <div style={{ fontSize: 10, color: '#a78bfa', wordBreak: 'break-all', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '10px', fontFamily: 'monospace', lineHeight: 1.6 }}>
                  {backupKey}
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupKey)
                  setKeyCopied(true)
                  setTimeout(() => setKeyCopied(false), 2000)
                }}
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', borderRadius: 10, padding: '10px', fontSize: 13, color: '#c4b5fd', cursor: 'pointer' }}
              >
                {keyCopied ? '✓ Copied!' : 'Copy Private Key'}
              </button>

              <button
                onClick={() => { setBackupKey(''); setAuthState('unlocked') }}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer' }}
              >
                I've saved my recovery key →
              </button>
            </div>
          )}

          {authState === 'pin-setup' && (
            <PinPad
              value={pin}
              onChange={setPin}
              label="Create a 6-digit PIN to secure your bot wallet"
              error={error}
              loading={loading}
            />
          )}

          {authState === 'pin-setup-confirm' && (
            <PinPad
              value={pin}
              onChange={setPin}
              label="Confirm your PIN"
              error={error}
              loading={loading}
            />
          )}

          {authState === 'pin-entry' && (
            <PinPad
              value={pin}
              onChange={setPin}
              label="Enter your PIN to unlock"
              error={error}
              loading={loading}
            />
          )}
        </div>
      </div>
    </div>
  )
}
