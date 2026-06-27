import { Keypair, Connection, VersionedTransaction, Transaction, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { invoke } from '@tauri-apps/api/core'
import { getSecretKeyFromSession } from './secureKeyStore'
import { desktopStorage } from './storage'

const PUBKEY_KEY = 'jij-bot-pubkey'
const RPC = 'https://api.mainnet-beta.solana.com'

let _publicKey: string | null = null

export async function getOrCreatePublicKey(): Promise<string | null> {
  if (_publicKey) return _publicKey
  const stored = await desktopStorage.get(PUBKEY_KEY)
  if (stored) {
    _publicKey = stored
    return stored
  }
  return null
}

async function savePublicKey(pk: string): Promise<void> {
  _publicKey = pk
  await desktopStorage.set(PUBKEY_KEY, pk)
}

export async function getNewKeypairSecretKey(): Promise<{ secretKey: Uint8Array; publicKey: string }> {
  const kp = Keypair.generate()
  await savePublicKey(kp.publicKey.toBase58())
  return { secretKey: kp.secretKey, publicKey: _publicKey! }
}

export const localWallet = {
  async connect(): Promise<string> {
    const pk = await getOrCreatePublicKey()
    if (pk) return pk
    // pubkey cache wiped (e.g. reinstall) but keypair file intact — derive from session
    try {
      const secretKey = await getSecretKeyFromSession()
      const kp = Keypair.fromSecretKey(secretKey)
      await savePublicKey(kp.publicKey.toBase58())
      return _publicKey!
    } catch {
      throw new Error('Wallet not initialized — complete PIN setup first')
    }
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
    const json = await invoke<{ result: string | null; error?: { message: string } }>('solana_rpc', {
      method: 'sendTransaction',
      params: [encoded, { encoding: 'base64', skipPreflight: false, maxRetries: 3 }],
    })
    const result = (json as any).result
    if (!result) {
      const err = (json as any).error?.message ?? 'sendTransaction returned no signature'
      throw new Error(err)
    }
    return result
  },

  async getBalance(mint?: string): Promise<number> {
    const pk = await getOrCreatePublicKey()
    if (!pk) return 0

    if (!mint) {
      const json = await invoke<{ result: { value: number } | null }>('solana_rpc', {
        method: 'getBalance',
        params: [pk, { commitment: 'confirmed' }],
      })
      return ((json as any).result?.value ?? 0) / LAMPORTS_PER_SOL
    }

    const { getAssociatedTokenAddress } = await import('@solana/spl-token')
    const ata = await getAssociatedTokenAddress(new PublicKey(mint), new PublicKey(pk))
    try {
      const json = await invoke<{ result: { value: { uiAmount: number } } }>('solana_rpc', {
        method: 'getTokenAccountBalance',
        params: [ata.toBase58(), { commitment: 'confirmed' }],
      })
      return (json as any).result?.value?.uiAmount ?? 0
    } catch {
      return 0
    }
  },

  async withdrawToken(mint: string, toAddress: string, rawAmount: bigint): Promise<string> {
    const pk = await getOrCreatePublicKey()
    if (!pk) throw new Error('Wallet not initialized')
    const conn = new Connection(RPC, 'confirmed')
    const {
      getAssociatedTokenAddress,
      getAccount,
      createTransferInstruction,
      createAssociatedTokenAccountInstruction,
    } = await import('@solana/spl-token')

    const fromPubkey = new PublicKey(pk)
    const toPubkey = new PublicKey(toAddress)
    const mintPubkey = new PublicKey(mint)
    const sourceATA = await getAssociatedTokenAddress(mintPubkey, fromPubkey)
    const destATA = await getAssociatedTokenAddress(mintPubkey, toPubkey)

    const { blockhash } = await conn.getLatestBlockhash()
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: fromPubkey })

    try { await getAccount(conn, destATA) } catch {
      tx.add(createAssociatedTokenAccountInstruction(fromPubkey, destATA, toPubkey, mintPubkey))
    }
    tx.add(createTransferInstruction(sourceATA, destATA, fromPubkey, rawAmount))

    return localWallet.signAndSend(tx)
  },
}
