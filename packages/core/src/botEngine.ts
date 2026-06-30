import { BotState, Platform, JIJ_MINT, SOL_MINT, USDC_MINT, JIJ_DECIMALS, GRID_RANGE_PCT, TRAIL_BUFFER_PCT } from './types'
import { fetchPrices, seedPriceCache } from './priceFeeds'
import { checkGridFills, initGrid, buildInitialOrders } from './gridBot'
import { checkTrail } from './trailEngine'
import { initDCAScheduler, checkMissedBuy, executeDCABuy } from './dcaBot'
import { loadState, saveState, allocateCapital } from './stateManager'
import { logEntry } from './activityLog'
import { jupiterSwap, toLamports } from './jupiterSwap'
import { retryPendingTax } from './taxReserve'

const GRID_DENSITIES = [20, 40, 60] as const

function pickGridDensity(): number {
  return GRID_DENSITIES[Math.floor(Math.random() * GRID_DENSITIES.length)]
}

let pollTimer: ReturnType<typeof setTimeout> | null = null

export async function startBots(state: BotState, platform: Platform): Promise<void> {
  if (!state.walletPublicKey) throw new Error('Wallet not connected')
  if (!state.config.gridSOL || state.config.gridSOL <= 0) throw new Error('Grid SOL commitment required')

  state.botRunning = true

  // Seed price cache from saved state so a cold-launch Dexscreener failure
  // can fall back to the last known price instead of aborting resume entirely.
  seedPriceCache(state.lastPriceSOL, state.lastSolUsdPrice)

  const prices = await fetchPrices(JIJ_MINT, platform)
  state.lastPriceSOL = prices.jijSolPrice
  state.lastSolUsdPrice = prices.solUsdPrice

  const isResume = state.openOrders.length > 0

  if (isResume) {
    healOrderQuantities(state)
    healGridReserve(state)
    if (state.gridFormatVersion < 2) {
      migrateGridFormat(state, prices.jijSolPrice)
    }
    logEntry(state, 'INFO', 'Bot restarted — resuming existing grid')
    initDCAScheduler(state, platform)
    await checkMissedBuy(state, platform)
  } else {
    // Fresh start: allocate capital, seed buy, build grid
    allocateCapital(state, prices.jijSolPrice)
    await saveState(platform, state)  // persist gridReserve before the async seed buy

    let gridEntryPrice = prices.jijSolPrice

    if (state.seedSOL > 0) {
      try {
        const seedLamports = toLamports(state.seedSOL)
        const result = await jupiterSwap(
          platform, SOL_MINT, JIJ_MINT, seedLamports,
          state.walletPublicKey!, state.config.slippageBps,
        )
        logEntry(state, 'INFO', `Seed buy: ${state.seedSOL.toFixed(4)} SOL → JiJ (tx: ${result.txSignature})`)
        // Wait for the seed buy to confirm so the JiJ ATA exists before the first poll
        await new Promise(resolve => setTimeout(resolve, 20000))
        // Re-fetch price after seed buy — on low-liquidity tokens the buy itself moves the
        // price; anchoring the grid to the post-impact price prevents an immediate sell trigger
        try {
          const postSeed = await fetchPrices(JIJ_MINT, platform)
          gridEntryPrice = postSeed.jijSolPrice
          state.lastPriceSOL = postSeed.jijSolPrice
          state.lastSolUsdPrice = postSeed.solUsdPrice
        } catch {
          // keep pre-seed price as fallback
        }
        logEntry(state, 'INFO', `Seed buy confirmed — grid entry anchored at ${gridEntryPrice.toFixed(8)} SOL`)
      } catch (err) {
        logEntry(state, 'ERROR', `Seed buy failed: ${String(err)}`)
      }
    }

    // Set grid bounds around actual post-seed entry price
    state.config.entryPrice = gridEntryPrice
    state.config.gridLower  = gridEntryPrice * (1 - GRID_RANGE_PCT)
    state.config.gridUpper  = gridEntryPrice * (1 + GRID_RANGE_PCT)
    state.config.gridLevels = pickGridDensity()

    initGrid(state)
    buildInitialOrders(state, gridEntryPrice)
    initDCAScheduler(state, platform)
    logEntry(state, 'INFO', `Bots started fresh — grid density: ${state.config.gridLevels} rungs`)
  }

  await saveState(platform, state)
  schedulePoll(state, platform)
}

function migrateGridFormat(state: BotState, currentPrice: number): void {
  const newDensity = GRID_DENSITIES[Math.floor(Math.random() * GRID_DENSITIES.length)]
  state.config.gridLevels = newDensity
  initGrid(state)
  buildInitialOrders(state, currentPrice)
  state.gridFormatVersion = 2
  logEntry(state, 'INFO', `Grid migrated to Format ${GRID_DENSITIES.indexOf(newDensity) + 1} (${newDensity} rungs)`)
}

function healOrderQuantities(state: BotState): void {
  if (state.openOrders.length === 0) return
  if (!(state.gridLower > 0 && state.gridUpper > 0 && state.gridLevels > 0)) return
  const hasInvalidQty = state.openOrders.some(o => !isFinite(o.quantity) || o.quantity <= 0)
  if (!hasInvalidQty) return
  const buyLevels = Math.floor(state.gridLevels / 2)
  const midPrice = (state.gridLower + state.gridUpper) / 2
  state.quantityPerGrid = state.gridReserve / buyLevels / midPrice
  state.openOrders.forEach(o => { o.quantity = state.quantityPerGrid })
  logEntry(state, 'INFO', `Healed order quantities: ${state.quantityPerGrid.toFixed(2)} JiJ per level`)
}

function healGridReserve(state: BotState): void {
  if (state.gridReserve > 0) return
  if (state.config.gridSOL <= 0) return

  const gridAmt = state.config.gridSOL * (1 - TRAIL_BUFFER_PCT)
  state.gridReserve = gridAmt * 0.70
  if (state.trailBuffer <= 0) state.trailBuffer = state.config.gridSOL * TRAIL_BUFFER_PCT

  const openBuys = state.openOrders.filter(o => !o.filled && o.side === 'buy')
  if (openBuys.length > 0 && state.gridLower > 0 && state.gridUpper > 0) {
    const midPrice = (state.gridLower + state.gridUpper) / 2
    const newQty = state.gridReserve / openBuys.length / midPrice
    openBuys.forEach(o => { o.quantity = newQty })
    state.quantityPerGrid = newQty
  }

  logEntry(state, 'INFO', `Healed grid reserve: ${state.gridReserve.toFixed(4)} SOL restored from committed ${state.config.gridSOL.toFixed(4)} SOL`)
}

export async function resumeBots(state: BotState, platform: Platform): Promise<void> {
  if (!state.botRunning || !state.walletPublicKey) return
  healOrderQuantities(state)
  healGridReserve(state)

  const openUnfilled = state.openOrders.filter(o => !o.filled)
  if (openUnfilled.length === 0 && state.gridReserve > 0) {
    // No open orders but capital is available — grid was never built or all levels
    // were filled. Rebuild around the current price so the bot isn't dormant.
    try {
      const prices = await fetchPrices(JIJ_MINT, platform)
      const currentPrice = prices.jijSolPrice
      state.lastPriceSOL = currentPrice
      state.lastSolUsdPrice = prices.solUsdPrice
      state.config.entryPrice = currentPrice
      state.config.gridLower  = currentPrice * (1 - GRID_RANGE_PCT)
      state.config.gridUpper  = currentPrice * (1 + GRID_RANGE_PCT)
      state.config.gridLevels = pickGridDensity()
      initGrid(state)
      buildInitialOrders(state, currentPrice)
      logEntry(state, 'INFO', `Resume: no open orders — grid rebuilt at ${currentPrice.toFixed(8)} SOL`)
    } catch (err) {
      logEntry(state, 'ERROR', `Resume: could not rebuild grid — ${String(err)}`)
    }
  } else {
    logEntry(state, 'INFO', 'Bot resumed — restarting poll loop')
  }

  if (state.dcaStatus === 'on') {
    initDCAScheduler(state, platform)
  } else {
    await checkMissedBuy(state, platform)
  }
  schedulePoll(state, platform)
}

export function stopBots(state: BotState): void {
  state.botRunning = false
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  logEntry(state, 'INFO', 'Bots stopped')
}

function schedulePoll(state: BotState, platform: Platform): void {
  if (!state.botRunning) return
  pollTimer = setTimeout(async () => {
    try {
      await Promise.race([
        poll(state, platform),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('poll timeout')), 30_000)
        ),
      ])
    } catch (err) {
      console.error('Poll cycle failed or timed out:', err)
    }
    schedulePoll(state, platform)
  }, state.config.pollingIntervalSec * 1000)
}

async function poll(state: BotState, platform: Platform): Promise<void> {
  state.lastPollTime = Date.now()
  platform.storage.set('jij-last-poll-time', String(state.lastPollTime)).catch(() => {})
  try {
    const prices = await fetchPrices(JIJ_MINT, platform)
    state.lastPriceSOL = prices.jijSolPrice
    state.lastSolUsdPrice = prices.solUsdPrice

    if (state.pendingTaxReserveSOL > 0) {
      await retryPendingTax(state, platform, prices.solUsdPrice)
    }

    await checkGridFills(state, platform, prices.jijSolPrice, prices.solUsdPrice)
    await checkTrail(state, platform, prices.jijSolPrice)

    // Check DCA scheduled time
    if (state.randomBuyTime > 0 && Date.now() >= state.randomBuyTime && !state.todayBuyExecuted) {
      await executeDCABuy(state, platform)
    }

    await saveState(platform, state)
  } catch (err) {
    console.error('Poll error (silent):', err)
  }
}

export async function onAppResume(state: BotState, platform: Platform): Promise<void> {
  if (state.botRunning) {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }

    const openUnfilled = state.openOrders.filter(o => !o.filled)
    if (openUnfilled.length === 0 && state.gridReserve > 0) {
      try {
        const prices = await fetchPrices(JIJ_MINT, platform)
        const currentPrice = prices.jijSolPrice
        state.lastPriceSOL = currentPrice
        state.lastSolUsdPrice = prices.solUsdPrice
        state.config.entryPrice = currentPrice
        state.config.gridLower  = currentPrice * (1 - GRID_RANGE_PCT)
        state.config.gridUpper  = currentPrice * (1 + GRID_RANGE_PCT)
        state.config.gridLevels = pickGridDensity()
        initGrid(state)
        buildInitialOrders(state, currentPrice)
        logEntry(state, 'INFO', `App resume: no open orders — grid rebuilt at ${currentPrice.toFixed(8)} SOL`)
      } catch (err) {
        logEntry(state, 'ERROR', `App resume: could not rebuild grid — ${String(err)}`)
      }
    }

    schedulePoll(state, platform)
  }
  checkMissedBuy(state, platform)
}

export async function withdrawSOL(state: BotState, platform: Platform, toAddress: string, amountSOL?: number): Promise<string> {
  if (!state.walletPublicKey) throw new Error('No bot wallet initialised')
  const { Connection, SystemProgram, PublicKey, Transaction, LAMPORTS_PER_SOL } = await import('@solana/web3.js')
  const rpc = state.config.rpcEndpoint || 'https://rpc.ankr.com/solana'
  const conn = new Connection(rpc, 'confirmed')
  const balance = await conn.getBalance(new PublicKey(state.walletPublicKey))
  const GAS_RESERVE = 5000
  const amountLamports = amountSOL != null
    ? Math.min(Math.floor(amountSOL * LAMPORTS_PER_SOL), balance - GAS_RESERVE)
    : balance - GAS_RESERVE
  if (amountLamports <= 0) throw new Error('Insufficient balance to withdraw')
  const { blockhash } = await conn.getLatestBlockhash()
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: new PublicKey(state.walletPublicKey) }).add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(state.walletPublicKey),
      toPubkey: new PublicKey(toAddress),
      lamports: amountLamports,
    }),
  )
  const sig = await platform.wallet.signAndSend(tx)
  logEntry(state, 'INFO', `Withdrew ${(amountLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL to ${toAddress} (tx: ${sig})`)
  await saveState(platform, state)
  return sig
}

export async function topUpSOL(state: BotState, platform: Platform, amountSOL: number): Promise<void> {
  if (!state.walletPublicKey) throw new Error('Wallet not connected')
  if (amountSOL <= 0) throw new Error('Amount must be greater than zero')

  const seedAmt = amountSOL * 0.30
  const reserveAmt = amountSOL * 0.70

  // 70% → grid reserve + redistribute into unfilled buy orders
  state.gridReserve += reserveAmt
  state.config.gridSOL += amountSOL

  // Recalculate quantity per grid level based on updated reserve and redeploy into open buy orders.
  // If no open buy orders exist (all filled during a price drop, or no grid yet), re-anchor
  // the grid at the current price so the topped-up capital gets deployed immediately.
  const openBuys = state.openOrders.filter(o => !o.filled && o.side === 'buy')
  if (openBuys.length > 0) {
    const newQtyPerGrid = state.gridReserve / openBuys.length / ((state.config.gridLower + state.config.gridUpper) / 2)
    openBuys.forEach(o => { o.quantity = newQtyPerGrid })
    state.quantityPerGrid = newQtyPerGrid
    logEntry(state, 'INFO', `Top-up: redistributed reserve across ${openBuys.length} open buy orders (${newQtyPerGrid.toFixed(2)} JiJ/level)`)
  } else {
    try {
      const prices = await fetchPrices(JIJ_MINT, platform)
      const currentPrice = prices.jijSolPrice
      state.lastPriceSOL = currentPrice
      state.lastSolUsdPrice = prices.solUsdPrice
      state.config.entryPrice = currentPrice
      state.config.gridLower  = currentPrice * (1 - GRID_RANGE_PCT)
      state.config.gridUpper  = currentPrice * (1 + GRID_RANGE_PCT)
      state.config.gridLevels = pickGridDensity()
      initGrid(state)
      buildInitialOrders(state, currentPrice)
      logEntry(state, 'INFO', `Top-up: no open buy orders — grid rebuilt at ${currentPrice.toFixed(8)} SOL`)
    } catch (err) {
      logEntry(state, 'ERROR', `Top-up: could not rebuild grid — ${String(err)}`)
    }
  }

  logEntry(state, 'INFO', `Top-up: +${amountSOL.toFixed(4)} SOL committed (${reserveAmt.toFixed(4)} SOL added to grid reserve)`)
  // Save BEFORE the async swap — protects reserve tracking if app is backgrounded during the buy
  await saveState(platform, state)

  // 30% → buy JiJ to extend sell-side coverage
  try {
    const result = await jupiterSwap(
      platform, SOL_MINT, JIJ_MINT, toLamports(seedAmt),
      state.walletPublicKey, state.config.slippageBps,
    )
    logEntry(state, 'INFO', `Top-up seed buy: ${seedAmt.toFixed(4)} SOL → JiJ (tx: ${result.txSignature})`)
  } catch (err) {
    logEntry(state, 'ERROR', `Top-up seed buy failed: ${String(err)}`)
  }

  await saveState(platform, state)
}

export async function withdrawJiJ(state: BotState, platform: Platform, toAddress: string, amountJiJ?: number): Promise<string> {
  if (!state.walletPublicKey) throw new Error('No bot wallet initialised')
  const balance = await platform.wallet.getBalance(JIJ_MINT)
  if (balance === 0) throw new Error('No JiJ balance to withdraw')
  const rawAmount = amountJiJ != null
    ? BigInt(Math.min(Math.floor(amountJiJ * Math.pow(10, JIJ_DECIMALS)), Math.floor(balance * Math.pow(10, JIJ_DECIMALS))))
    : BigInt(Math.floor(balance * Math.pow(10, JIJ_DECIMALS)))
  if (rawAmount <= 0n) throw new Error('Insufficient JiJ balance')
  const sig = await platform.wallet.withdrawToken(JIJ_MINT, toAddress, rawAmount)
  logEntry(state, 'INFO', `Withdrew ${amountJiJ ?? balance} JiJ to ${toAddress} (tx: ${sig})`)
  await saveState(platform, state)
  return sig
}

const USDC_DECIMALS = 6

export async function withdrawUSDC(state: BotState, platform: Platform, toAddress: string, amountUSDC?: number): Promise<string> {
  if (!state.walletPublicKey) throw new Error('No bot wallet initialised')
  const balance = await platform.wallet.getBalance(USDC_MINT)
  if (balance === 0) throw new Error('No USDC balance to withdraw')
  const rawAmount = amountUSDC != null
    ? BigInt(Math.min(Math.floor(amountUSDC * Math.pow(10, USDC_DECIMALS)), Math.floor(balance * Math.pow(10, USDC_DECIMALS))))
    : BigInt(Math.floor(balance * Math.pow(10, USDC_DECIMALS)))
  if (rawAmount <= 0n) throw new Error('Insufficient USDC balance')
  const sig = await platform.wallet.withdrawToken(USDC_MINT, toAddress, rawAmount)
  logEntry(state, 'INFO', `Withdrew ${amountUSDC ?? balance} USDC to ${toAddress} (tx: ${sig})`)
  await saveState(platform, state)
  return sig
}

export async function emergencyStop(state: BotState, platform: Platform): Promise<void> {
  stopBots(state)
  await platform.notify.send('JIJ Bot', 'Emergency stop — all bots paused. DCA pool preserved.')
  logEntry(state, 'SAFETY', 'Emergency stop triggered')
  await saveState(platform, state)
}

export async function reanchorGrid(state: BotState, platform: Platform): Promise<void> {
  if (!state.walletPublicKey) throw new Error('Wallet not connected')

  // Pause polling while we reanchor
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null }

  const totalSOL = state.gridReserve + state.trailBuffer
  if (totalSOL <= 0) throw new Error('No SOL available to re-anchor')

  logEntry(state, 'INFO', `Re-anchoring: collecting ${totalSOL.toFixed(6)} SOL (${state.gridReserve.toFixed(6)} reserve + ${state.trailBuffer.toFixed(6)} trail)`)

  // Drop all unfilled orders — filled ones are already history
  state.openOrders = state.openOrders.filter(o => o.filled)

  // Fetch current price
  const prices = await fetchPrices(JIJ_MINT, platform)
  state.lastPriceSOL = prices.jijSolPrice
  state.lastSolUsdPrice = prices.solUsdPrice

  // Reset tracked capital so allocateCapital starts clean
  state.config.gridSOL = totalSOL
  state.gridReserve = 0
  state.trailBuffer = 0
  state.seedSOL = 0

  allocateCapital(state, prices.jijSolPrice)

  let gridEntryPrice = prices.jijSolPrice

  if (state.seedSOL > 0) {
    try {
      const result = await jupiterSwap(
        platform, SOL_MINT, JIJ_MINT, toLamports(state.seedSOL),
        state.walletPublicKey!, state.config.slippageBps,
      )
      logEntry(state, 'INFO', `Re-anchor seed buy: ${state.seedSOL.toFixed(4)} SOL → JiJ (tx: ${result.txSignature})`)
      await new Promise(resolve => setTimeout(resolve, 20000))
      try {
        const postSeed = await fetchPrices(JIJ_MINT, platform)
        gridEntryPrice = postSeed.jijSolPrice
        state.lastPriceSOL = postSeed.jijSolPrice
        state.lastSolUsdPrice = postSeed.solUsdPrice
      } catch {}
    } catch (err) {
      logEntry(state, 'ERROR', `Re-anchor seed buy failed: ${String(err)}`)
    }
  }

  state.config.entryPrice = gridEntryPrice
  state.config.gridLower  = gridEntryPrice * (1 - GRID_RANGE_PCT)
  state.config.gridUpper  = gridEntryPrice * (1 + GRID_RANGE_PCT)
  state.config.gridLevels = pickGridDensity()

  initGrid(state)
  buildInitialOrders(state, gridEntryPrice)
  logEntry(state, 'INFO', `Grid re-anchored — density: ${state.config.gridLevels} rungs`)

  logEntry(state, 'INFO', `Grid re-anchored at ${gridEntryPrice.toFixed(8)} SOL — range ${state.config.gridLower.toFixed(8)}–${state.config.gridUpper.toFixed(8)}`)
  await platform.notify.send('Grid Re-anchored', `New range: ${state.config.gridLower.toFixed(6)}–${state.config.gridUpper.toFixed(6)} SOL`)

  await saveState(platform, state)
  schedulePoll(state, platform)
}
