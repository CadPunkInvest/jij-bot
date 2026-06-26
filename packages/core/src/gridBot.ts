import { BotState, Platform, GridOrder, SOL_MINT, JIJ_MINT, JIJ_DECIMALS } from './types'
import { jupiterSwap, toLamports } from './jupiterSwap'
import { routeProfit } from './profitRouter'
import { logEntry } from './activityLog'

export function initGrid(state: BotState): void {
  const { gridLower, gridUpper, gridLevels } = state.config
  state.gridLower = gridLower
  state.gridUpper = gridUpper
  state.gridLevels = gridLevels
  state.gridStep = (gridUpper - gridLower) / gridLevels
  const buyLevels = Math.floor(gridLevels / 2)
  // quantity in JiJ tokens per grid level, sized so each buy fill uses gridReserve/buyLevels SOL
  state.quantityPerGrid = state.gridReserve / buyLevels / ((gridLower + gridUpper) / 2)
  state.openOrders = []
  logEntry(state, 'INFO', `Grid initialized: ${gridLevels} levels from ${gridLower.toFixed(8)} to ${gridUpper.toFixed(8)} SOL`)
}

export function buildInitialOrders(state: BotState, currentPrice: number): void {
  const { gridLower, gridStep, gridLevels, quantityPerGrid } = state

  for (let i = 0; i <= gridLevels; i++) {
    const price = gridLower + i * gridStep
    const side: 'buy' | 'sell' = price < currentPrice ? 'buy' : 'sell'
    const order: GridOrder = {
      id: crypto.randomUUID(),
      level: i,
      price,
      side,
      quantity: quantityPerGrid,
      filled: false,
      timestamp: Date.now(),
    }
    state.openOrders.push(order)
  }
  logEntry(state, 'INFO', `Built ${state.openOrders.length} grid orders at entry price ${currentPrice.toFixed(8)}`)
}

export async function checkGridFills(
  state: BotState,
  platform: Platform,
  currentPrice: number,
  solUsdPrice: number,
): Promise<void> {
  // Min SOL reserve guard — ensure enough SOL for gas
  const walletSOL = await platform.wallet.getBalance()
  if (walletSOL < state.config.minSOLReserve) {
    logEntry(state, 'SAFETY', 'Insufficient SOL for gas — skipping grid fill check')
    return
  }

  const jijBalance = await platform.wallet.getBalance(JIJ_MINT)

  for (const order of state.openOrders) {
    if (order.filled) continue

    const triggered =
      (order.side === 'buy' && currentPrice <= order.price) ||
      (order.side === 'sell' && currentPrice >= order.price)

    if (!triggered) continue

    if (order.side === 'sell' && jijBalance < order.quantity * 0.95) {
      logEntry(state, 'INFO', `Sell L${order.level} skipped — JiJ balance ${jijBalance.toFixed(0)} < required ${order.quantity.toFixed(0)}`)
      continue
    }

    await executeFill(state, platform, order, currentPrice, solUsdPrice)
  }
}

async function executeFill(
  state: BotState,
  platform: Platform,
  order: GridOrder,
  currentPrice: number,
  solUsdPrice: number,
): Promise<void> {
  const [inputMint, outputMint] = order.side === 'buy'
    ? [SOL_MINT, JIJ_MINT]
    : [JIJ_MINT, SOL_MINT]

  // Buy: spend SOL (lamports); Sell: spend JiJ (raw token units using JIJ_DECIMALS)
  const amountLamports = order.side === 'buy'
    ? toLamports(order.quantity * order.price)
    : Math.floor(order.quantity * Math.pow(10, JIJ_DECIMALS))

  logEntry(state, 'INFO', `Executing ${order.side} L${order.level}: qty=${order.quantity.toFixed(2)} rawAmt=${amountLamports}`)

  try {
    const result = await jupiterSwap(
      platform,
      inputMint,
      outputMint,
      amountLamports,
      state.walletPublicKey!,
      state.config.slippageBps,
    )

    order.filled = true
    order.txSignature = result.txSignature
    state.totalGridFills++

    const profitSOL = state.gridStep * order.quantity
    state.realizedPnLSOL += profitSOL
    state.realizedPnLUSD += profitSOL * solUsdPrice

    logEntry(state, 'GRID_FILL', `Grid ${order.side.toUpperCase()} at level ${order.level} (${order.price.toFixed(8)} SOL) — tx: ${result.txSignature.slice(0, 8)}…`, {
      txSignature: result.txSignature,
      level: order.level,
      side: order.side,
    })

    await routeProfit(state, platform, profitSOL, solUsdPrice)
    placeCounterOrder(state, order)
  } catch (err) {
    logEntry(state, 'ERROR', `Grid fill failed at level ${order.level}: ${String(err)}`)
  }
}

function placeCounterOrder(state: BotState, filledOrder: GridOrder): void {
  const counterSide: 'buy' | 'sell' = filledOrder.side === 'buy' ? 'sell' : 'buy'
  const counterLevel = filledOrder.side === 'buy' ? filledOrder.level + 1 : filledOrder.level - 1

  if (counterLevel < 0 || counterLevel > state.gridLevels) return

  // Remove any existing order at the counter level/side
  state.openOrders = state.openOrders.filter(o => !(o.level === counterLevel && o.side === counterSide))

  const counterPrice = state.gridLower + counterLevel * state.gridStep
  state.openOrders.push({
    id: crypto.randomUUID(),
    level: counterLevel,
    price: counterPrice,
    side: counterSide,
    quantity: filledOrder.quantity,
    filled: false,
    timestamp: Date.now(),
  })
}
