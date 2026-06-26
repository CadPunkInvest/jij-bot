import { BotState, Platform } from './types'
import { logEntry } from './activityLog'

export async function checkTrail(
  state: BotState,
  platform: Platform,
  currentPrice: number,
): Promise<void> {
  const { trailSensitivity, minBufferToShift } = state.config

  let shifts = 0
  while (currentPrice > state.gridUpper * (1 + trailSensitivity)) {
    if (state.trailBuffer < minBufferToShift) {
      logEntry(state, 'INFO', `Trail trigger at ${currentPrice} but buffer too low (${state.trailBuffer.toFixed(4)} SOL < ${minBufferToShift} SOL)`)
      break
    }
    shiftGridUp(state, currentPrice)
    shifts++
  }

  if (shifts > 0) {
    logEntry(state, 'TRAIL_SHIFT', `Grid shifted up ${shifts} level(s): new range ${state.gridLower.toFixed(8)}–${state.gridUpper.toFixed(8)} SOL`, {
      currentPrice,
      bufferRemaining: state.trailBuffer,
      shifts,
    })
    await platform.notify.send('Grid Shifted Up', `+${shifts} level${shifts > 1 ? 's' : ''} → range ${state.gridLower.toFixed(6)}–${state.gridUpper.toFixed(6)} SOL`)
  }

  if (currentPrice < state.gridLower) {
    logEntry(state, 'INFO', `Price ${currentPrice} below grid lower ${state.gridLower} — holding grid`)
  }

  state.highWaterMark = Math.max(state.highWaterMark, currentPrice)
}

function shiftGridUp(state: BotState, currentPrice: number): void {
  const { gridStep } = state

  // Cancel bottom-most buy order to recover SOL
  const bottomBuy = state.openOrders
    .filter(o => o.side === 'buy' && !o.filled)
    .sort((a, b) => a.level - b.level)[0]

  if (!bottomBuy) return

  const recoveredSOL = bottomBuy.quantity * bottomBuy.price
  state.gridReserve += recoveredSOL
  state.openOrders = state.openOrders.filter(o => o.id !== bottomBuy.id)

  const shiftCost = gridStep * state.quantityPerGrid
  state.trailBuffer -= shiftCost
  state.gridLower += gridStep
  state.gridUpper += gridStep

  // Add new buy at new bottom
  const newBottomLevel = state.openOrders.reduce((min, o) => Math.min(min, o.level), Infinity) - 1
  const newBottomPrice = state.gridLower

  state.openOrders.push({
    id: crypto.randomUUID(),
    level: newBottomLevel,
    price: newBottomPrice,
    side: 'buy',
    quantity: state.quantityPerGrid,
    filled: false,
    timestamp: Date.now(),
  })

  state.highWaterMark = Math.max(state.highWaterMark, currentPrice)
}
