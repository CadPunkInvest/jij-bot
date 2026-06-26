import { BotState, Platform, DEFAULT_STATE, DEFAULT_CONFIG, GRID_RANGE_PCT, TRAIL_BUFFER_PCT } from './types'

const STATE_KEY = 'jij-bot-state'

export async function loadState(platform: Platform): Promise<BotState> {
  try {
    const raw = await platform.storage.get(STATE_KEY)
    if (!raw) return { ...DEFAULT_STATE, config: { ...DEFAULT_CONFIG } }
    const parsed = JSON.parse(raw) as Partial<BotState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      config: { ...DEFAULT_CONFIG, ...(parsed.config ?? {}) },
    }
  } catch {
    return { ...DEFAULT_STATE, config: { ...DEFAULT_CONFIG } }
  }
}

export async function saveState(platform: Platform, state: BotState): Promise<void> {
  await platform.storage.set(STATE_KEY, JSON.stringify(state))
}

export function allocateCapital(state: BotState, entryPrice: number): void {
  const { gridSOL } = state.config
  const trailAmt = gridSOL * TRAIL_BUFFER_PCT
  const gridAmt  = gridSOL - trailAmt

  // 30% buys JiJ at startup to seed sell orders; 70% reserved for buy-side grid orders
  state.seedSOL      = gridAmt * 0.30
  state.gridReserve  = gridAmt * 0.70
  state.trailBuffer  = trailAmt
  state.dcaPool      = 0   // DCA funded from profits only

  state.config.entryPrice = entryPrice
  state.config.gridLower  = entryPrice * (1 - GRID_RANGE_PCT)
  state.config.gridUpper  = entryPrice * (1 + GRID_RANGE_PCT)

  state.sessionStartValue = gridSOL
}
