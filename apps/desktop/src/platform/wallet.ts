import { Transaction, VersionedTransaction } from '@solana/web3.js'

declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean
      connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
      disconnect(): Promise<void>
      signAndSendTransaction(tx: Transaction | VersionedTransaction): Promise<{ signature: string }>
      publicKey?: { toString(): string }
      on(event: string, cb: () => void): void
      off(event: string, cb: () => void): void
    }
  }
}

export const desktopWallet = {
  async connect(): Promise<string> {
    if (!window.solana?.isPhantom) {
      throw new Error('Phantom wallet not found. Please install the Phantom browser extension.')
    }
    const resp = await window.solana.connect()
    return resp.publicKey.toString()
  },

  async signAndSend(tx: Transaction | VersionedTransaction): Promise<string> {
    if (!window.solana) throw new Error('Phantom not connected')
    const result = await window.solana.signAndSendTransaction(tx)
    return result.signature
  },

  async getBalance(mint?: string): Promise<number> {
    if (!window.solana?.publicKey) return 0
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
    const rpc = (window as unknown as { __jijRpc?: string }).__jijRpc ?? 'https://api.mainnet-beta.solana.com'
    const conn = new Connection(rpc)

    if (!mint) {
      const lamports = await conn.getBalance(new PublicKey(window.solana.publicKey.toString()))
      return lamports / LAMPORTS_PER_SOL
    }

    const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token')
    const owner = new PublicKey(window.solana.publicKey.toString())
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
    await window.solana?.disconnect()
  },
}
