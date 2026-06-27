import { Preferences } from '@capacitor/preferences'
import { NativeBiometric } from 'capacitor-native-biometric'

const ENCRYPTED_KEY = 'jij-bot-keypair-v2'
const BIOMETRIC_SERVER = 'jijbot.wallet'
const LOCK_TIMEOUT_MS = 15 * 60 * 1000 // 15 minutes
const LAST_ACTIVE_LS_KEY = 'jij-session-last-active'

// In-memory derived key for the session — cleared on background timeout
let sessionDerivedKey: CryptoKey | null = null
let lastActiveTime = Date.now()

// ── Web Crypto helpers ────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToB64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptBytes(data: Uint8Array, key: CryptoKey): Promise<{ cipher: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  return { cipher: bytesToB64(new Uint8Array(cipher)), iv: bytesToB64(iv) }
}

async function decryptBytes(cipher: string, iv: string, key: CryptoKey): Promise<Uint8Array> {
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(iv) },
    key,
    b64ToBytes(cipher),
  )
  return new Uint8Array(dec)
}

// ── PIN operations ────────────────────────────────────────────────

export async function isPinSet(): Promise<boolean> {
  const { value } = await Preferences.get({ key: ENCRYPTED_KEY })
  return !!value
}

export async function setupPin(secretKey: Uint8Array, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derivedKey = await deriveKey(pin, salt)
  const { cipher, iv } = await encryptBytes(secretKey, derivedKey)
  await Preferences.set({
    key: ENCRYPTED_KEY,
    value: JSON.stringify({ cipher, iv, salt: bytesToB64(salt) }),
  })
  sessionDerivedKey = derivedKey
  lastActiveTime = Date.now()
  try { localStorage.setItem(LAST_ACTIVE_LS_KEY, String(lastActiveTime)) } catch {}
}

export async function unlockWithPin(pin: string): Promise<Uint8Array> {
  const { value } = await Preferences.get({ key: ENCRYPTED_KEY })
  if (!value) throw new Error('No encrypted keypair found')
  const { cipher, iv, salt } = JSON.parse(value)
  const derivedKey = await deriveKey(pin, b64ToBytes(salt))
  try {
    const secretKey = await decryptBytes(cipher, iv, derivedKey)
    sessionDerivedKey = derivedKey
    lastActiveTime = Date.now()
    try { localStorage.setItem(LAST_ACTIVE_LS_KEY, String(lastActiveTime)) } catch {}
    return secretKey
  } catch {
    throw new Error('Incorrect PIN')
  }
}

export function getSessionKey(): CryptoKey | null {
  return sessionDerivedKey
}

export async function unlockWithSessionKey(pin: string): Promise<Uint8Array> {
  // Re-decrypt using the session key already in memory (no pin re-derivation needed)
  if (!sessionDerivedKey) throw new Error('Session expired — please enter PIN')
  const { value } = await Preferences.get({ key: ENCRYPTED_KEY })
  if (!value) throw new Error('No encrypted keypair found')
  const { cipher, iv } = JSON.parse(value)
  const secretKey = await decryptBytes(cipher, iv, sessionDerivedKey)
  lastActiveTime = Date.now()
  return secretKey
}

export async function getSecretKeyFromSession(): Promise<Uint8Array> {
  if (!sessionDerivedKey) throw new Error('Session locked')
  const { value } = await Preferences.get({ key: ENCRYPTED_KEY })
  if (!value) throw new Error('No encrypted keypair found')
  const { cipher, iv } = JSON.parse(value)
  return decryptBytes(cipher, iv, sessionDerivedKey)
}

export async function exportPrivateKeyB58(): Promise<string> {
  const secretKey = await getSecretKeyFromSession()
  const bs58 = await import('bs58')
  return bs58.default.encode(secretKey)
}

export async function setupPinWithImportedKey(input: string, pin: string): Promise<Uint8Array> {
  const trimmed = input.trim()
  let secretKey: Uint8Array

  const wordCount = trimmed.split(/\s+/).length
  if (wordCount >= 12) {
    // Treat as BIP39 mnemonic — derive using Phantom's path m/44'/501'/0'/0'
    const { mnemonicToSeedSync, validateMnemonic } = await import('bip39')
    const { derivePath } = await import('ed25519-hd-key')
    const { Keypair } = await import('@solana/web3.js')
    if (!validateMnemonic(trimmed)) throw new Error('Invalid recovery phrase — check all words and try again')
    const seed = mnemonicToSeedSync(trimmed)
    const { key } = derivePath("m/44'/501'/0'/0'", seed.toString('hex'))
    const kp = Keypair.fromSeed(key)
    secretKey = kp.secretKey
  } else {
    // Treat as base58 private key
    const bs58 = await import('bs58')
    try {
      secretKey = bs58.default.decode(trimmed)
    } catch {
      throw new Error('Invalid input — paste your recovery phrase or base58 private key')
    }
    if (secretKey.length !== 64) throw new Error(`Invalid key length: ${secretKey.length} bytes (expected 64)`)
  }

  await setupPin(secretKey, pin)
  return secretKey
}

export function touchSession(): void {
  lastActiveTime = Date.now()
  try { localStorage.setItem(LAST_ACTIVE_LS_KEY, String(lastActiveTime)) } catch {}
}

export function isSessionExpired(): boolean {
  // Prefer localStorage so the check survives WebView recreation
  try {
    const stored = localStorage.getItem(LAST_ACTIVE_LS_KEY)
    if (stored) return Date.now() - parseInt(stored, 10) > LOCK_TIMEOUT_MS
  } catch {}
  return Date.now() - lastActiveTime > LOCK_TIMEOUT_MS
}

export function clearSession(): void {
  sessionDerivedKey = null
  try { localStorage.removeItem(LAST_ACTIVE_LS_KEY) } catch {}
}

// ── Biometric operations ──────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable()
    return result.isAvailable
  } catch {
    return false
  }
}

export async function savePinToBiometric(pin: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: 'jijbot',
    password: pin,
    server: BIOMETRIC_SERVER,
  })
}

export async function getPinFromBiometric(): Promise<string> {
  await NativeBiometric.verifyIdentity({
    reason: 'Unlock JiJ Bot wallet',
    title: 'Biometric Authentication',
    subtitle: 'Use fingerprint or face to unlock',
    negativeButtonText: 'Use PIN instead',
  })
  const credentials = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER })
  return credentials.password
}

export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER })
    return !!creds.password
  } catch {
    return false
  }
}

export async function clearBiometric(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER })
  } catch { /* ignore */ }
}
