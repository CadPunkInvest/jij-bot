const ENCRYPTED_KEY = 'jij-bot-keypair-v2'
const LOCK_TIMEOUT_MS = 5 * 60 * 1000

let sessionDerivedKey: CryptoKey | null = null
let lastActiveTime = Date.now()

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

export function isPinSet(): boolean {
  return !!localStorage.getItem(ENCRYPTED_KEY)
}

export async function setupPin(secretKey: Uint8Array, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const derivedKey = await deriveKey(pin, salt)
  const { cipher, iv } = await encryptBytes(secretKey, derivedKey)
  localStorage.setItem(ENCRYPTED_KEY, JSON.stringify({ cipher, iv, salt: bytesToB64(salt) }))
  sessionDerivedKey = derivedKey
  lastActiveTime = Date.now()
}

export async function unlockWithPin(pin: string): Promise<Uint8Array> {
  const stored = localStorage.getItem(ENCRYPTED_KEY)
  if (!stored) throw new Error('No encrypted keypair found')
  const { cipher, iv, salt } = JSON.parse(stored)
  const derivedKey = await deriveKey(pin, b64ToBytes(salt))
  try {
    const secretKey = await decryptBytes(cipher, iv, derivedKey)
    sessionDerivedKey = derivedKey
    lastActiveTime = Date.now()
    return secretKey
  } catch {
    throw new Error('Incorrect PIN')
  }
}

export async function getSecretKeyFromSession(): Promise<Uint8Array> {
  if (!sessionDerivedKey) throw new Error('Session locked')
  const stored = localStorage.getItem(ENCRYPTED_KEY)
  if (!stored) throw new Error('No encrypted keypair found')
  const { cipher, iv } = JSON.parse(stored)
  return decryptBytes(cipher, iv, sessionDerivedKey)
}

export function touchSession(): void {
  lastActiveTime = Date.now()
}

export function isSessionExpired(): boolean {
  return Date.now() - lastActiveTime > LOCK_TIMEOUT_MS
}

export function clearSession(): void {
  sessionDerivedKey = null
}
