import { BotState, Platform, MAPLE_DONATION_ADDRESS } from './types'
import { logEntry } from './activityLog'

// Below this, a send would burn a disproportionate share of the transfer on network fees.
const MIN_CAUSE_SEND_SOL = 0.01

export async function flushCausePool(state: BotState, platform: Platform): Promise<void> {
  if (state.causePool < MIN_CAUSE_SEND_SOL) return
  if (!state.walletPublicKey) return

  const amountSOL = state.causePool

  try {
    const { Connection, SystemProgram, PublicKey, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
    const rpc = state.config.rpcEndpoint || 'https://rpc.ankr.com/solana'
    const conn = new Connection(rpc, 'confirmed')

    // Min SOL reserve guard — never let a donation drain gas money
    const walletSOL = await platform.wallet.getBalance()
    if (walletSOL - amountSOL < state.config.minSOLReserve) {
      logEntry(state, 'SAFETY', 'Cause donation skipped — would drop wallet below min SOL reserve')
      return
    }

    const { blockhash } = await conn.getLatestBlockhash()
    const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL)
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: new PublicKey(state.walletPublicKey) }).add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(state.walletPublicKey),
        toPubkey: new PublicKey(MAPLE_DONATION_ADDRESS),
        lamports,
      }),
    )
    const sig = await platform.wallet.signAndSend(tx)

    state.causePool = 0
    state.totalCauseDonatedSOL += amountSOL
    logEntry(state, 'PROFIT_ROUTE', `Donated ${amountSOL.toFixed(6)} SOL to M.A.P.L.E. (tx: ${sig.slice(0, 8)}…)`, {
      txSignature: sig,
      amountSOL,
    })
  } catch (err) {
    // Leave causePool intact — next profit event (or poll) will retry the send
    logEntry(state, 'ERROR', `Cause donation send failed — will retry: ${String(err)}`)
  }
}
