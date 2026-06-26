import { Keypair, VersionedTransaction, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { Preferences } from '@capacitor/preferences'
import { CapacitorHttp } from '@capacitor/core'
import { getSecretKeyFromSession } from './secureKeyStore'

const PUBKEY_KEY = 'jij-bot-pubkey'
const RPC = 'https://api.mainnet-beta.solana.com'

let _publicKey: string | null = null

export async function getOrCreatePublicKey(): Promise<string> {
  if (_publicKey) return _publicKey
  const { value } = await Preferences.get({ key: PUBKEY_KEY })
  if (value) {
    _publicKey = value
    return value
  }
  const kp = Keypair.generate()
  _publicKey = kp.publicKey.toBase58()
  await Preferences.set({ key: PUBKEY_KEY, value: _publicKey })
  return _publicKey
}

export function getPublicKeySync(): string | null {
  return _publicKey
}

export async function getNewKeypairSecretKey(): Promise<{ secretKey: Uint8Array; publicKey: string }> {
  const kp = Keypair.generate()
  _publicKey = kp.publicKey.toBase58()
  await Preferences.set({ key: PUBKEY_KEY, value: _publicKey })
  return { secretKey: kp.secretKey, publicKey: _publicKey }
}

// Uses CapacitorHttp — native HTTP call outside the WebView, bypasses
// WebView network restrictions, CORS, and rate-limit fingerprinting.
async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const response = await CapacitorHttp.post({
    url: RPC,
    headers: { 'Content-Type': 'application/json' },
    data: { jsonrpc: '2.0', id: 1, method, params },
  })
  const json = response.data as { result?: unknown; error?: { message: string } }
  if (json.error) throw new Error(json.error.message)
  return json.result
}

export const localWallet = {
  async connect(): Promise<string> {
    return getOrCreatePublicKey()
  },

  async disconnect(): Promise<void> {},

  async signAndSend(tx: Transaction | VersionedTransaction): Promise<string> {
    const secretKeyBytes = await getSecretKeyFromSession()
    const kp = Keypair.fromSecretKey(secretKeyBytes)

    let serialized: Uint8Array
    if (tx instanceof VersionedTransaction) {
      tx.sign([kp])
      serialized = tx.serialize()
    } else {
      tx.partialSign(kp)
      serialized = tx.serialize({ requireAllSignatures: false })
    }

    const encoded = btoa(String.fromCharCode(...serialized))
    const result = await rpcCall('sendTransaction', [
      encoded,
      { encoding: 'base64', skipPreflight: false, maxRetries: 3 },
    ]) as string
    return result
  },

  async getBalance(mint?: string): Promise<number> {
    const pubkey = await getOrCreatePublicKey()

    if (!mint) {
      const result = await rpcCall('getBalance', [pubkey]) as { value: number }
      return result.value / LAMPORTS_PER_SOL
    }

    const ataResult = await rpcCall('getTokenAccountsByOwner', [
      pubkey,
      { mint },
      { encoding: 'jsonParsed' },
    ]) as { value: Array<{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } } }> }

    const accounts = ataResult.value
    if (!accounts || accounts.length === 0) return 0
    return accounts[0].account.data.parsed.info.tokenAmount.uiAmount ?? 0
  },

  async getTokenAccount(mint: string): Promise<string | null> {
    const pubkey = await getOrCreatePublicKey()
    const ataResult = await rpcCall('getTokenAccountsByOwner', [
      pubkey,
      { mint },
      { encoding: 'jsonParsed' },
    ]) as { value: Array<{ pubkey: string }> }
    const accounts = ataResult.value
    if (!accounts || accounts.length === 0) return null
    return accounts[0].pubkey
  },

  async withdrawToken(mint: string, toAddress: string, rawAmount: bigint): Promise<string> {
    const pubkey = await getOrCreatePublicKey()
    const fromPubkey = new PublicKey(pubkey)
    const toPubkey = new PublicKey(toAddress)
    const mintPubkey = new PublicKey(mint)

    const sourceATA = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
    const destATA = await getAssociatedTokenAddress(mintPubkey, toPubkey)

    // Get latest blockhash via CapacitorHttp
    const bhResult = await rpcCall('getLatestBlockhash', [{ commitment: 'confirmed' }]) as { value: { blockhash: string; lastValidBlockHeight: number } }
    const blockhash = bhResult.value.blockhash

    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey })

    // Create dest ATA if it doesn't exist
    const destInfo = await rpcCall('getAccountInfo', [destATA.toBase58(), { encoding: 'base64' }]) as { value: unknown }
    if (!destInfo.value) {
      tx.add(createAssociatedTokenAccountInstruction(fromPubkey, destATA, toPubkey, mintPubkey))
    }

    tx.add(createTransferInstruction(sourceATA, destATA, fromPubkey, rawAmount))

    return localWallet.signAndSend(tx)
  },
}
