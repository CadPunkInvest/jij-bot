import React, { useEffect, useRef, useState } from 'react'
import {
  isPinSet,
  setupPin,
  unlockWithPin,
  isBiometricAvailable,
  isBiometricEnrolled,
  savePinToBiometric,
  getPinFromBiometric,
  clearSession,
  isSessionExpired,
  touchSession,
  setupPinWithImportedKey,
} from './platform/secureKeyStore'
import { getNewKeypairSecretKey, getOrCreatePublicKey } from './platform/localWallet'
import { storeKeyForBackground } from './platform/backgroundWorker'
import { Keypair } from '@solana/web3.js'

const PIN_LENGTH = 6

type AuthState =
  | 'checking'
  | 'pin-setup'
  | 'pin-setup-confirm'
  | 'backup-key'
  | 'import-key'
  | 'import-pin'
  | 'import-pin-confirm'
  | 'biometric-enroll'
  | 'biometric-prompt'
  | 'pin-entry'
  | 'unlocked'

// ── Numeric PIN pad ───────────────────────────────────────────────
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

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      <div className="text-sm text-white/50 text-center">{label}</div>

      {/* Dots */}
      <div className="flex gap-4">
        {dots.map((filled, i) => (
          <div key={i} className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
            filled ? 'bg-purple-400 border-purple-400' : 'border-white/30'
          }`} style={filled ? { boxShadow: '0 0 8px rgba(167,139,250,0.6)' } : {}} />
        ))}
      </div>

      {/* Error */}
      {error && <div className="text-xs text-red-400 text-center">{error}</div>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            disabled={loading || k === ''}
            className={`py-4 rounded-2xl text-xl font-semibold transition-all active:scale-95 ${
              k === '' ? 'invisible' :
              k === '⌫' ? 'bg-white/5 border border-white/10 text-white/50 hover:bg-white/10' :
              'bg-white/5 border border-white/10 text-white hover:bg-white/10'
            } ${loading ? 'opacity-40' : ''}`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── AuthGate ──────────────────────────────────────────────────────
export function AuthGate({
  bgImage,
  logoSrc,
  children,
}: {
  bgImage?: string
  logoSrc?: string
  children: React.ReactNode
}) {
  const [authState, _setAuthState] = useState<AuthState>('checking')
  const authStateRef = useRef<AuthState>('checking')
  const biometricInFlight = useRef(false)
  const setAuth = (s: AuthState) => { authStateRef.current = s; _setAuthState(s) }
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [importKey, setImportKey] = useState('')
  const [importKeyError, setImportKeyError] = useState('')
  const [backupKey, setBackupKey] = useState('')
  const [backupKeyCopied, setBackupKeyCopied] = useState(false)
  const [backupKeyConfirmed, setBackupKeyConfirmed] = useState(false)

  useEffect(() => {
    init()
    // Keep session alive while app is in the foreground
    const keepAlive = setInterval(() => {
      if (authStateRef.current === 'unlocked' && document.visibilityState === 'visible') touchSession()
    }, 60_000)
    // Re-lock on app resume if session expired
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (authStateRef.current === 'unlocked' && isSessionExpired()) {
          clearSession()
          setAuth('checking')
          init()
        } else {
          touchSession()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(keepAlive)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // Auto-submit when PIN is full length
  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      if (authState === 'pin-setup') handlePinSetupNext()
      else if (authState === 'pin-setup-confirm') handlePinSetupConfirm()
      else if (authState === 'pin-entry') handlePinUnlock()
      else if (authState === 'import-pin') handleImportPinNext()
      else if (authState === 'import-pin-confirm') handleImportPinConfirm()
    }
  }, [pin])

  async function init() {
    const biometric = await isBiometricAvailable()
    setBiometricAvailable(biometric)
    const hasPin = await isPinSet()
    if (!hasPin) {
      setAuth('pin-setup')
      return
    }
    // Has a PIN — try biometric first if enrolled
    if (biometric && await isBiometricEnrolled()) {
      setAuth('biometric-prompt')
      tryBiometric()
    } else {
      setAuth('pin-entry')
    }
  }

  async function tryBiometric() {
    if (biometricInFlight.current) return
    biometricInFlight.current = true
    setLoading(true)
    setError('')
    try {
      const savedPin = await getPinFromBiometric()
      const secretKey = await unlockWithPin(savedPin)
      storeKeyForBackground(secretKey).catch(() => {})
      setAuth('unlocked')
    } catch {
      // User cancelled, biometric failed, or stored credential doesn't match — fall back to PIN
      // Only navigate to pin-entry if we're still in a biometric state (guard against concurrent calls)
      if (authStateRef.current === 'biometric-prompt') {
        setAuth('pin-entry')
      }
    } finally {
      setLoading(false)
      biometricInFlight.current = false
    }
  }

  async function handlePinSetupNext() {
    if (pin.length < PIN_LENGTH) return
    setConfirmPin(pin)  // save first PIN entry
    setPin('')
    setError('')
    setAuth('pin-setup-confirm')
  }

  async function handlePinSetupConfirm() {
    // pin = second entry, confirmPin = first entry (saved in handlePinSetupNext)
    if (pin !== confirmPin) {
      setError('PINs do not match — try again')
      setPin('')
      return
    }
    setLoading(true)
    try {
      const { secretKey } = await getNewKeypairSecretKey()
      await setupPin(secretKey, pin)
      storeKeyForBackground(secretKey).catch(() => {})
      const bs58 = await import('bs58')
      setBackupKey(bs58.default.encode(secretKey))
      setAuth('backup-key')
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  async function handlePinUnlock() {
    setLoading(true)
    setError('')
    try {
      const secretKey = await unlockWithPin(pin)
      storeKeyForBackground(secretKey).catch(() => {})
      setAuth('unlocked')
    } catch {
      setError('Incorrect PIN')
      setPin('')
    }
    setLoading(false)
  }

  function handleImportPinNext() {
    if (pin.length < PIN_LENGTH) return
    setConfirmPin(pin)
    setPin('')
    setError('')
    setAuth('import-pin-confirm')
  }

  async function handleImportPinConfirm() {
    if (pin !== confirmPin) {
      setError('PINs do not match — try again')
      setPin('')
      return
    }
    setLoading(true)
    try {
      const secretKey = await setupPinWithImportedKey(importKey, pin)
      storeKeyForBackground(secretKey).catch(() => {})
      const kp = Keypair.fromSecretKey(secretKey)
      const { Preferences } = await import('@capacitor/preferences')
      await Preferences.set({ key: 'jij-bot-pubkey', value: kp.publicKey.toBase58() })
      const bs58 = await import('bs58')
      setBackupKey(bs58.default.encode(secretKey))
      setAuth('backup-key')
    } catch (e) {
      setError(String(e))
      setPin('')
      setAuth('import-pin')
    }
    setLoading(false)
  }

  async function enrollBiometric() {
    setLoading(true)
    try {
      await savePinToBiometric(pin)
      setAuth('unlocked')
    } catch (e) {
      setError(String(e))
      setAuth('unlocked') // skip biometric enrollment, still unlock
    }
    setLoading(false)
  }

  if (authState === 'unlocked') return <>{children}</>

  const bg: React.CSSProperties = bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: '#030712' }

  return (
    <div className="relative min-h-screen" style={bg}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">

        {/* Logo */}
        <div className="text-center mb-10">
          {logoSrc
            ? <img src={logoSrc} alt="JiJ" className="w-14 h-14 rounded-2xl mx-auto mb-3 object-contain" style={{ boxShadow: '0 0 24px rgba(124,58,237,0.5)' }} />
            : <div className="w-14 h-14 rounded-2xl bg-purple-700/70 flex items-center justify-center text-2xl font-black text-white mx-auto mb-3">J</div>
          }
          <div className="text-lg font-bold text-white">JiJ Bot</div>
        </div>

        {/* Checking */}
        {authState === 'checking' && (
          <div className="text-white/40 text-sm">Loading…</div>
        )}

        {/* PIN setup — first entry */}
        {authState === 'pin-setup' && (
          <div className="w-full space-y-6">
            <PinPad
              value={pin}
              onChange={setPin}
              label="Create a 6-digit PIN to secure your bot wallet"
              error={error}
              loading={loading}
            />
            <button
              onClick={() => { setPin(''); setError(''); setAuth('import-key') }}
              className="w-full max-w-xs mx-auto block text-sm text-white/30 hover:text-white/50 text-center transition-colors">
              Restore existing wallet →
            </button>
          </div>
        )}

        {/* PIN setup — confirm */}
        {authState === 'pin-setup-confirm' && (
          <PinPad
            value={pin}
            onChange={setPin}
            label="Confirm your PIN"
            error={error}
            loading={loading}
          />
        )}

        {/* Backup private key — shown after every new wallet setup */}
        {authState === 'backup-key' && (
          <div className="w-full max-w-xs mx-auto space-y-5">
            <div className="text-center space-y-1">
              <div className="text-base font-bold text-white">Save your private key</div>
              <div className="text-xs text-white/40 leading-relaxed">
                This is the only way to recover your wallet if the app is reinstalled or your phone is lost. Store it in a password manager or write it down offline.
              </div>
            </div>

            <div className="bg-black/40 border border-yellow-400/30 rounded-xl p-4 space-y-3">
              <div className="text-[10px] text-yellow-400 uppercase tracking-wider font-semibold">Private Key</div>
              <div className="break-all font-mono text-xs text-white/80 select-all leading-relaxed">
                {backupKey}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(backupKey).then(() => {
                    setBackupKeyCopied(true)
                    setTimeout(() => setBackupKeyCopied(false), 3000)
                  })
                }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold border transition-colors"
                style={backupKeyCopied
                  ? { background: 'rgba(74,222,128,0.15)', borderColor: 'rgba(74,222,128,0.4)', color: '#4ade80' }
                  : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)' }}>
                {backupKeyCopied ? '✓ Copied to clipboard' : 'Copy to clipboard'}
              </button>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={backupKeyConfirmed}
                onChange={e => setBackupKeyConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-purple-500 shrink-0"
              />
              <span className="text-xs text-white/50 leading-relaxed">
                I have saved my private key somewhere safe. I understand it cannot be recovered if lost.
              </span>
            </label>

            <button
              disabled={!backupKeyConfirmed}
              onClick={() => {
                setBackupKey('')
                setBackupKeyConfirmed(false)
                if (biometricAvailable) {
                  setAuth('biometric-enroll')
                } else {
                  setAuth('unlocked')
                }
              }}
              className="w-full py-3 bg-purple-600/60 hover:bg-purple-500/70 border border-purple-400/30 text-white rounded-2xl text-sm font-semibold transition-colors disabled:opacity-30">
              I've saved it — Continue
            </button>
          </div>
        )}

        {/* Import key — paste private key */}
        {authState === 'import-key' && (
          <div className="w-full max-w-xs mx-auto space-y-4">
            <div className="text-sm text-white/50 text-center">Paste your Phantom recovery phrase or private key</div>
            <textarea
              value={importKey}
              onChange={e => { setImportKey(e.target.value); setImportKeyError('') }}
              placeholder="12 or 24 word recovery phrase, or base58 private key…"
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-white/20 focus:outline-none focus:border-purple-400/50 resize-none"
            />
            {importKeyError && (
              <div className="text-xs text-red-400 text-center">{importKeyError}</div>
            )}
            <button
              onClick={() => {
                if (!importKey.trim()) { setImportKeyError('Paste your private key first'); return }
                setPin(''); setError('')
                setAuth('import-pin')
              }}
              className="w-full py-3 bg-purple-600/60 hover:bg-purple-500/70 border border-purple-400/30 text-white rounded-2xl text-sm font-semibold transition-colors">
              Next — Set PIN
            </button>
            <button
              onClick={() => { setImportKey(''); setImportKeyError(''); setAuth('pin-setup') }}
              className="w-full py-2 text-white/30 hover:text-white/50 text-sm text-center transition-colors">
              ← Back
            </button>
          </div>
        )}

        {/* Import — set PIN */}
        {authState === 'import-pin' && (
          <PinPad
            value={pin}
            onChange={setPin}
            label="Set a PIN to protect this wallet"
            error={error}
            loading={loading}
          />
        )}

        {/* Import — confirm PIN */}
        {authState === 'import-pin-confirm' && (
          <PinPad
            value={pin}
            onChange={setPin}
            label="Confirm your PIN"
            error={error}
            loading={loading}
          />
        )}

        {/* PIN entry */}
        {authState === 'pin-entry' && (
          <div className="w-full">
            <PinPad
              value={pin}
              onChange={setPin}
              label="Enter your PIN to unlock"
              error={error}
              loading={loading}
            />
            {biometricAvailable && (
              <button onClick={tryBiometric}
                className="mt-6 w-full max-w-xs mx-auto block text-sm text-purple-400 text-center hover:text-purple-300 transition-colors">
                Use biometric instead →
              </button>
            )}
          </div>
        )}

        {/* Biometric prompt */}
        {authState === 'biometric-prompt' && (
          <div className="text-center space-y-4">
            <div className="text-4xl mb-2">👆</div>
            <div className="text-white font-semibold">Touch to unlock</div>
            <div className="text-white/40 text-sm">Biometric authentication</div>
            {loading && <div className="text-white/30 text-xs">Authenticating…</div>}
            <button onClick={() => setAuth('pin-entry')}
              className="mt-4 text-sm text-white/30 hover:text-white/50 transition-colors">
              Use PIN instead
            </button>
          </div>
        )}

        {/* Biometric enroll offer */}
        {authState === 'biometric-enroll' && (
          <div className="text-center space-y-4 max-w-xs">
            <div className="text-4xl mb-2">🔒</div>
            <div className="text-white font-semibold">Enable biometric unlock?</div>
            <div className="text-white/40 text-sm">Use fingerprint or face ID to unlock on future opens instead of entering your PIN each time.</div>
            <button onClick={enrollBiometric} disabled={loading}
              className="w-full py-3 bg-purple-600/60 hover:bg-purple-500/70 border border-purple-400/30 text-white rounded-2xl text-sm font-semibold transition-colors disabled:opacity-40">
              {loading ? 'Setting up…' : 'Enable Biometric'}
            </button>
            <button onClick={() => setAuth('unlocked')}
              className="w-full py-2 text-white/30 hover:text-white/50 text-sm transition-colors">
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
