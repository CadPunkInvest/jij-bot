import { Platform } from './types'

const PROXY_BASE = 'https://canadianpunkinvesting.com'
const JUPITER_QUOTE_URL = `${PROXY_BASE}/swap/v1/quote`
const JUPITER_SWAP_URL  = `${PROXY_BASE}/swap/v1/swap`

export interface SwapResult {
  txSignature: string
  outAmount: number
}

export async function jupiterSwap(
  platform: Platform,
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  walletPublicKey: string,
  slippageBps: number,
): Promise<SwapResult> {
  // Step 1: Quote
  const quoteUrl = `${JUPITER_QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`
  const quoteRes = await platform.http.get(quoteUrl)
  if (quoteRes.status !== 200) throw new Error(`Quote failed (${quoteRes.status}): ${JSON.stringify(quoteRes.data)}`)
  const quote = quoteRes.data as { outAmount?: string; error?: string }
  if (quote.error) throw new Error(`Quote error: ${quote.error}`)
  if (!quote.outAmount) throw new Error(`Quote returned no outAmount: ${JSON.stringify(quote)}`)

  // Step 2: Build + sign transaction
  const swapRes = await platform.http.post(JUPITER_SWAP_URL, {
    quoteResponse: quote,
    userPublicKey: walletPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 50000,
  })
  if (swapRes.status !== 200) throw new Error(`Swap build failed (${swapRes.status}): ${JSON.stringify(swapRes.data)}`)
  const swapData = swapRes.data as { swapTransaction?: string; error?: string }
  if (swapData.error) throw new Error(`Swap error: ${swapData.error}`)
  if (!swapData.swapTransaction) throw new Error(`Swap returned no transaction: ${JSON.stringify(swapData)}`)

  // Step 3: Deserialize, sign, send
  const { VersionedTransaction } = await import('@solana/web3.js')
  const txBytes = Uint8Array.from(atob(swapData.swapTransaction), c => c.charCodeAt(0))
  const tx = VersionedTransaction.deserialize(txBytes)
  const sig = await platform.wallet.signAndSend(tx)

  return { txSignature: sig, outAmount: Number(quote.outAmount) }
}

export function toLamports(sol: number): number {
  return Math.floor(sol * 1e9)
}

export function fromUsdcDecimals(raw: number): number {
  return raw / 1e6
}
