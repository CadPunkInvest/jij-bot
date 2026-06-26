import { BotState, TaxEvent, SOL_MINT, USDC_MINT } from './types'
import { Platform } from './types'
import { jupiterSwap, toLamports, fromUsdcDecimals } from './jupiterSwap'
import { logEntry } from './activityLog'

export async function reserveTax(
  state: BotState,
  platform: Platform,
  profitSOL: number,
  solUsdPrice: number,
): Promise<number> {
  const taxAmountSOL = profitSOL * (state.config.taxReservePct / 100)

  const walletPublicKey = state.walletPublicKey!
  let usdcReceived = 0
  let txSignature = 'PENDING'

  try {
    const result = await jupiterSwap(
      platform,
      SOL_MINT,
      USDC_MINT,
      toLamports(taxAmountSOL),
      walletPublicKey,
      state.config.taxSwapSlippageBps,
    )
    usdcReceived = fromUsdcDecimals(result.outAmount)
    txSignature = result.txSignature
    state.taxReserveUSDC += usdcReceived
  } catch (err) {
    state.pendingTaxReserveSOL += taxAmountSOL
    logEntry(state, 'ERROR', `Tax swap failed, queued ${taxAmountSOL.toFixed(6)} SOL for retry: ${String(err)}`)
    return 0
  }

  const event: TaxEvent = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    eventType: 'GRID_PROFIT',
    profitSOL,
    profitUSD: profitSOL * solUsdPrice,
    solUsdPriceAtTime: solUsdPrice,
    taxReservedSOL: taxAmountSOL,
    usdcReceived,
    swapTxSignature: txSignature,
    reservePct: state.config.taxReservePct,
  }
  state.taxEvents.push(event)
  logEntry(state, 'TAX_RESERVE', `Reserved ${taxAmountSOL.toFixed(6)} SOL → ${usdcReceived.toFixed(2)} USDC`, { event })

  return taxAmountSOL
}

export async function retryPendingTax(state: BotState, platform: Platform, solUsdPrice: number): Promise<void> {
  if (state.pendingTaxReserveSOL <= 0) return

  const pending = state.pendingTaxReserveSOL
  state.pendingTaxReserveSOL = 0

  try {
    const result = await jupiterSwap(
      platform,
      SOL_MINT,
      USDC_MINT,
      toLamports(pending),
      state.walletPublicKey!,
      state.config.taxSwapSlippageBps,
    )
    const usdcReceived = fromUsdcDecimals(result.outAmount)
    state.taxReserveUSDC += usdcReceived

    const event: TaxEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      eventType: 'GRID_PROFIT',
      profitSOL: pending,
      profitUSD: pending * solUsdPrice,
      solUsdPriceAtTime: solUsdPrice,
      taxReservedSOL: pending,
      usdcReceived,
      swapTxSignature: result.txSignature,
      reservePct: state.config.taxReservePct,
    }
    state.taxEvents.push(event)
    logEntry(state, 'TAX_RESERVE', `Retry succeeded: ${pending.toFixed(6)} SOL → ${usdcReceived.toFixed(2)} USDC`, {})
  } catch (err) {
    state.pendingTaxReserveSOL = pending
    logEntry(state, 'ERROR', `Tax retry failed again: ${String(err)}`, {})
  }
}

export function exportTaxCSV(state: BotState, taxYear: number): string {
  const yearEvents = state.taxEvents.filter(e => new Date(e.timestamp).getFullYear() === taxYear)
  const totalProfitSOL = yearEvents.reduce((s, e) => s + e.profitSOL, 0)
  const totalProfitUSD = yearEvents.reduce((s, e) => s + e.profitUSD, 0)
  const totalUSDC = yearEvents.reduce((s, e) => s + e.usdcReceived, 0)
  const avgSolUsd = totalProfitSOL > 0 ? totalProfitUSD / totalProfitSOL : 0

  const lines: string[] = [
    `Tax Year,Total Profit SOL,Total Profit USD,Avg SOL/USD,Total USDC Reserved,Reserve Rate`,
    `${taxYear},${totalProfitSOL.toFixed(6)},${totalProfitUSD.toFixed(2)},${avgSolUsd.toFixed(2)},${totalUSDC.toFixed(2)},${state.config.taxReservePct}%`,
    '',
    `Date,Time,Profit (SOL),Profit (USD),SOL/USD,Reserved (SOL),USDC Received,Tx,Rate`,
  ]

  for (const e of yearEvents) {
    const d = new Date(e.timestamp)
    lines.push([
      d.toLocaleDateString('en-CA'),
      d.toLocaleTimeString('en-CA'),
      e.profitSOL.toFixed(6),
      e.profitUSD.toFixed(2),
      e.solUsdPriceAtTime.toFixed(2),
      e.taxReservedSOL.toFixed(6),
      e.usdcReceived.toFixed(2),
      e.swapTxSignature,
      `${e.reservePct}%`,
    ].join(','))
  }

  lines.push('')
  lines.push(`TOTALS,,${totalProfitSOL.toFixed(6)},${totalProfitUSD.toFixed(2)},${avgSolUsd.toFixed(2)},,${totalUSDC.toFixed(2)},,`)

  return lines.join('\n')
}
