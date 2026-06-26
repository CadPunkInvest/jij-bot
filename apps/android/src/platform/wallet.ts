import { Transaction, VersionedTransaction } from '@solana/web3.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const APP_URL = 'https://jijbot.app'
const REDIRECT_SCHEME = 'jijbot'

// Phantom deep link connection state
let sessionToken: string | null = null
let phantomEncPublicKey: string | null = null
let sharedSecret: Uint8Array | null = null
let connectedPublicKey: string | null = null
let pendingKeyPair: nacl.BoxKeyPair | null = null

// Pending callbacks resolved by the deep link handler
let pendingConnectResolve: ((pk: string) => void) | null = null
let pendingConnectReject: ((err: Error) => void) | null = null
let pendingSignResolve: ((sig: string) => void) | null = null
let pendingSignReject: ((err: Error) => void) | null = null

function generateDHKeypair(): nacl.BoxKeyPair {
  return nacl.box.keyPair()
}

function computeSharedSecret(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
  return nacl.box.before(theirPublicKey, mySecretKey)
}

function decryptPayload(data: string, nonce: string, secret: Uint8Array): Record<string, string> {
  const decrypted = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    secret,
  )
  if (!decrypted) throw new Error('Failed to decrypt Phantom response')
  return JSON.parse(new TextDecoder().decode(decrypted))
}

function encryptPayload(payload: object, secret: Uint8Array): { data: string; nonce: string } {
  const nonce = nacl.randomBytes(24)
  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = nacl.box.after(encoded, nonce, secret)
  return { data: bs58.encode(encrypted), nonce: bs58.encode(nonce) }
}

// Called by the Capacitor App plugin URL listener
export function handlePhantomDeepLink(url: string): void {
  const parsed = new URL(url)
  // jijbot://onConnect?... → hostname is 'onConnect', pathname is '/'
  const route = parsed.hostname || parsed.pathname.replace('/', '')

  if (route === 'onConnect') {
    const phantomKey = parsed.searchParams.get('phantom_encryption_public_key')
    const data = parsed.searchParams.get('data')
    const nonce = parsed.searchParams.get('nonce')

    if (!phantomKey || !data || !nonce || !pendingKeyPair) {
      pendingConnectReject?.(new Error('Invalid Phantom connect response'))
      return
    }

    phantomEncPublicKey = phantomKey
    sharedSecret = computeSharedSecret(bs58.decode(phantomKey), pendingKeyPair.secretKey)

    const decrypted = decryptPayload(data, nonce, sharedSecret)
    connectedPublicKey = decrypted.public_key
    sessionToken = decrypted.session

    pendingConnectResolve?.(connectedPublicKey)
    pendingConnectResolve = null
    pendingConnectReject = null
  }

  if (route === 'onSignAndSendTransaction') {
    const data = parsed.searchParams.get('data')
    const nonce = parsed.searchParams.get('nonce')

    if (!data || !nonce || !sharedSecret) {
      pendingSignReject?.(new Error('Invalid Phantom sign response'))
      return
    }

    const decrypted = decryptPayload(data, nonce, sharedSecret)
    pendingSignResolve?.(decrypted.signature)
    pendingSignResolve = null
    pendingSignReject = null
  }
}

export const androidWallet = {
  async connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      pendingConnectResolve = resolve
      pendingConnectReject = reject
      pendingKeyPair = generateDHKeypair()

      const params = new URLSearchParams({
        app_url: APP_URL,
        dapp_encryption_public_key: bs58.encode(pendingKeyPair.publicKey),
        redirect_link: `${REDIRECT_SCHEME}://onConnect`,
        cluster: 'mainnet-beta',
      })

      window.location.href = `phantom://v1/connect?${params.toString()}`
    })
  },

  async signAndSend(tx: Transaction | VersionedTransaction): Promise<string> {
    if (!sharedSecret || !sessionToken || !phantomEncPublicKey) {
      throw new Error('Phantom not connected')
    }

    return new Promise((resolve, reject) => {
      pendingSignResolve = resolve
      pendingSignReject = reject

      const serialized = tx instanceof VersionedTransaction
        ? tx.serialize()
        : tx.serialize({ requireAllSignatures: false })
      const payload = {
        session: sessionToken,
        transaction: bs58.encode(serialized),
      }
      const { data, nonce } = encryptPayload(payload, sharedSecret!)

      const params = new URLSearchParams({
        dapp_encryption_public_key: bs58.encode(pendingKeyPair!.publicKey),
        nonce,
        redirect_link: `${REDIRECT_SCHEME}://onSignAndSendTransaction`,
        payload: data,
      })

      window.location.href = `phantom://v1/signAndSendTransaction?${params.toString()}`
    })
  },

  async getBalance(mint?: string): Promise<number> {
    if (!connectedPublicKey) return 0
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
    const rpc = 'https://api.mainnet-beta.solana.com'
    const conn = new Connection(rpc)

    if (!mint) {
      const lamports = await conn.getBalance(new PublicKey(connectedPublicKey))
      return lamports / LAMPORTS_PER_SOL
    }

    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token')
    const owner = new PublicKey(connectedPublicKey)
    const mintPk = new PublicKey(mint)
    const ata = await getAssociatedTokenAddress(mintPk, owner)
    try {
      const acct = await getAccount(conn, ata)
      return Number(acct.amount) / 1e9
    } catch {
      return 0
    }
  },

  async disconnect(): Promise<void> {
    sessionToken = null
    phantomEncPublicKey = null
    sharedSecret = null
    connectedPublicKey = null
    pendingKeyPair = null
  },
}
