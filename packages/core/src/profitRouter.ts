import { BotState, Platform } from './types'
import { reserveTax, retryPendingTax } from './taxReserve'
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

  // Step 2: Split by DCA status
  if (state.dcaStatus === 'on' || state.dcaStatus === 'off') {
    state.gridReserve += remainingSOL * 0.40
    state.dcaPool += remainingSOL * 0.40
    state.trailBuffer += remainingSOL * 0.20
    logEntry(state, 'PROFIT_ROUTE', `Routed ${remainingSOL.toFixed(6)} SOL: 40% Grid / 40% DCA / 20% Trail`, {
      gridAdd: remainingSOL * 0.40,
      dcaAdd: remainingSOL * 0.40,
      trailAdd: remainingSOL * 0.20,
    })
  } else {
    // DEACTIVATED — DCA gets nothing
    state.gridReserve += remainingSOL * 0.60
    state.trailBuffer += remainingSOL * 0.40
    logEntry(state, 'PROFIT_ROUTE', `Routed ${remainingSOL.toFixed(6)} SOL: 60% Grid / 40% Trail (DCA deactivated)`, {
      gridAdd: remainingSOL * 0.60,
      trailAdd: remainingSOL * 0.40,
    })
  }
}
