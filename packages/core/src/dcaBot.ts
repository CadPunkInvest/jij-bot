import { BotState, Platform, DCAStatus, DCABuyEvent, SOL_MINT, JIJ_MINT, MIN_DCA_BUY_USD } from './types'
import { jupiterSwap, toLamports } from './jupiterSwap'
import { scheduleMidnightReset, cryptoRandom } from './scheduler'
import { logEntry } from './activityLog'

// Daily cap comes from state.config.dailyDCALimitUSD (user-set)

export function setDCAStatus(state: BotState, newStatus: DCAStatus): void {
  const prev = state.dcaStatus
  state.dcaStatus = newStatus
  logEntry(state, 'DCA_STATE_CHANGE', `DCA status: ${prev} → ${newStatus}`)
}

export function initDCAScheduler(state: BotState, platform: Platform): void {
  scheduleMidnightReset(platform, (randomBuyTime) => {
    state.randomBuyTime = randomBuyTime
    state.todayBuyExecuted = false
    logEntry(state, 'INFO', `DCA buy scheduled for ${new Date(randomBuyTime).toLocaleTimeString()}`)
  })

  // If no buy has been scheduled for today yet, pick a random time between now and midnight
  if (!state.randomBuyTime && !state.todayBuyExecuted) {
    const now = Date.now()
    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)
    const msUntilMidnight = midnight.getTime() - now
    if (msUntilMidnight > 60_000) {
      const offsetMs = cryptoRandom(0, Math.floor(msUntilMidnight / 1000)) * 1000
      state.randomBuyTime = now + offsetMs
      logEntry(state, 'INFO', `DCA buy scheduled for today at ${new Date(state.randomBuyTime).toLocaleTimeString()}`)
    }
  }

  checkMissedBuy(state, platform)
}

export function checkMissedBuy(state: BotState, platform: Platform): void {
  if (
    state.randomBuyTime > 0 &&
    state.randomBuyTime < Date.now() &&
    state.dcaStatus === 'on' &&
    !state.todayBuyExecuted
  ) {
    logEntry(state, 'INFO', 'Missed DCA buy detected on app resume — executing immediately')
    executeDCABuy(state, platform)
  }
}

export async function executeDCABuy(state: BotState, platform: Platform): Promise<void> {
  if (state.dcaStatus !== 'on') {
    logEntry(state, 'DCA_SKIP', `DCA buy skipped — status is ${state.dcaStatus}`)
    return
  }
  if (state.dcaPool <= 0) {
    logEntry(state, 'DCA_SKIP', 'DCA buy skipped — pool is empty')
    return
  }

  let solUsdPrice = state.lastSolUsdPrice
  if (solUsdPrice <= 0) {
    // lastSolUsdPrice is 0 on first app resume before poll runs — try a fresh fetch
    try {
      const { fetchPrices } = await import('./priceFeeds')
      const { JIJ_MINT } = await import('./types')
      const prices = await fetchPrices(JIJ_MINT, platform)
      solUsdPrice = prices.solUsdPrice
      state.lastSolUsdPrice = solUsdPrice
      state.lastPriceSOL = prices.jijSolPrice
    } catch {
      logEntry(state, 'ERROR', 'DCA buy aborted — SOL/USD price unavailable')
      return
    }
  }

  const dailyCapSOL = state.config.dailyDCALimitUSD / solUsdPrice
  const buyAmountSOL = Math.min(dailyCapSOL, state.dcaPool)

  // Minimum viable trade size — below this, fees/slippage can exceed the trade value.
  // Leave the pool untouched and don't mark today as executed, so it keeps accumulating
  // profit and gets another chance once it clears the floor (tomorrow, or sooner via resume).
  // Silent skip (no log entry) — this re-checks every poll cycle while under the floor and
  // would otherwise spam the activity feed with an entry every ~10s.
  if (buyAmountSOL * solUsdPrice < MIN_DCA_BUY_USD) {
    return
  }

  // Min SOL reserve guard
  const walletSOL = await platform.wallet.getBalance()
  if (walletSOL - buyAmountSOL < state.config.minSOLReserve) {
    logEntry(state, 'SAFETY', 'DCA buy skipped — wallet below min SOL reserve')
    return
  }

  try {
    const result = await jupiterSwap(
      platform,
      SOL_MINT,
      JIJ_MINT,
      toLamports(buyAmountSOL),
      state.walletPublicKey!,
      state.config.slippageBps,
    )

    const jijReceived = result.outAmount / 1e9  // adjust for JIJ decimals
    state.dcaPool -= buyAmountSOL
    state.totalJIJviaDCA += jijReceived
    state.totalDCABuys++
    state.lastDCABuy = Date.now()
    state.todayBuyExecuted = true

    const event: DCABuyEvent = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      solSpent: buyAmountSOL,
      jijReceived,
      solUsdPrice,
      usdValue: buyAmountSOL * solUsdPrice,
      poolRemainingSOL: state.dcaPool,
      txSignature: result.txSignature,
    }
    state.dcaBuyHistory.unshift(event)

    logEntry(state, 'DCA_BUY', `DCA bought ${jijReceived.toFixed(0)} JIJ for ${buyAmountSOL.toFixed(4)} SOL ($${(buyAmountSOL * solUsdPrice).toFixed(2)})`, {
      event,
    })

    await platform.notify.send('DCA Buy Complete', `Bought ${jijReceived.toFixed(0)} JIJ for $${(buyAmountSOL * solUsdPrice).toFixed(2)}`)
  } catch (err) {
    // Do NOT deduct from pool on failure
    logEntry(state, 'ERROR', `DCA buy failed — pool unchanged. Retry tomorrow. Error: ${String(err)}`)
    await platform.notify.send('DCA Buy Failed', 'Will retry tomorrow. Pool balance preserved.')
  }
}

export function getDCAScheduledTimeLabel(state: BotState): string {
  if (!state.randomBuyTime) return 'Not scheduled'
  if (state.todayBuyExecuted) return 'Executed today'
  if (state.randomBuyTime < Date.now()) return 'Pending execution'
  return new Date(state.randomBuyTime).toLocaleTimeString()
}

export function dcaAvgCostBasis(state: BotState): number {
  if (state.totalJIJviaDCA <= 0) return 0
  const totalSOL = state.dcaBuyHistory.reduce((s, e) => s + e.solSpent, 0)
  return totalSOL / state.totalJIJviaDCA
}
