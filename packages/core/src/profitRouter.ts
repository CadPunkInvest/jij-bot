import { BotState, Platform } from './types'
import { reserveTax, retryPendingTax } from './taxReserve'
import { flushCausePool } from './causeDonation'
import { logEntry } from './activityLog'

const MIN_PROFIT_TO_ROUTE = 0.0001
const DUST_FLUSH_THRESHOLD = 0.001

let dustAccumulator = 0

export async function routeProfit(
  state: BotState,
  platform: Platform,
  profitSOL: number,
  solUsdPrice: number,
): Promise<void> {
  // Retry any pending tax first
  await retryPendingTax(state, platform, solUsdPrice)

  if (profitSOL < MIN_PROFIT_TO_ROUTE) {
    dustAccumulator += profitSOL
    if (dustAccumulator < DUST_FLUSH_THRESHOLD) return
    profitSOL = dustAccumulator
    dustAccumulator = 0
  }

  // Step 1: Tax reserve off the top
  const taxedSOL = await reserveTax(state, platform, profitSOL, solUsdPrice)
  const remainingSOL = profitSOL - taxedSOL

  // Step 2: The Cause — mandatory skim off the remainder (min 1%, user can raise to 5%), before the grid/DCA/trail split
  const causePct = Math.max(1, state.causePct)
  const causeSOL = remainingSOL * (causePct / 100)
  state.causePool += causeSOL
  logEntry(state, 'PROFIT_ROUTE', `Routed ${causeSOL.toFixed(6)} SOL to The Cause (${causePct}%)`, { causeAdd: causeSOL })
  await flushCausePool(state, platform)
  const splitSOL = remainingSOL - causeSOL

  // Step 3: Split by DCA status
  if (state.dcaStatus === 'on' || state.dcaStatus === 'off') {
    state.gridReserve += splitSOL * 0.40
    state.dcaPool += splitSOL * 0.40
    state.trailBuffer += splitSOL * 0.20
    logEntry(state, 'PROFIT_ROUTE', `Routed ${splitSOL.toFixed(6)} SOL: 40% Grid / 40% DCA / 20% Trail`, {
      gridAdd: splitSOL * 0.40,
      dcaAdd: splitSOL * 0.40,
      trailAdd: splitSOL * 0.20,
    })
  } else {
    // DEACTIVATED — DCA gets nothing
    state.gridReserve += splitSOL * 0.60
    state.trailBuffer += splitSOL * 0.40
    logEntry(state, 'PROFIT_ROUTE', `Routed ${splitSOL.toFixed(6)} SOL: 60% Grid / 40% Trail (DCA deactivated)`, {
      gridAdd: splitSOL * 0.60,
      trailAdd: splitSOL * 0.40,
    })
  }
}

// The Cause is mandatory — always at least 1%, user can raise it up to 5%.
export function setCausePct(state: BotState, pct: number): void {
  const clamped = Math.max(1, Math.min(5, Math.round(pct)))
  const prev = state.causePct
  state.causePct = clamped
  logEntry(state, 'INFO', `The Cause: ${prev}% → ${clamped}%`)
}
