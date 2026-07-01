import { BotState, Platform, GRID_DENSITIES } from './types'
import { getCycleAnchor, getNextCycleAnchor, pickCycleTimes } from './gridFormatScheduler'
import { initGrid, buildInitialOrders } from './gridBot'
import { logEntry } from './activityLog'

function startNewCycle(state: BotState): void {
  const anchor = getCycleAnchor(Date.now())
  const { times, offsets } = pickCycleTimes(anchor, state.gridFormatWindowOffsets)
  state.gridFormatCycleAnchor = anchor
  state.gridFormatSwitchTimes = times
  state.gridFormatSwitchExecuted = [false, false, false]
  state.gridFormatWindowOffsets = offsets
  logEntry(state, 'INFO', `Grid format cycle scheduled: ${times.map(t => new Date(t).toLocaleTimeString()).join(', ')}`)
}

export function initGridFormatScheduler(state: BotState, platform: Platform): void {
  if (state.gridFormatCycleAnchor !== getCycleAnchor(Date.now())) {
    startNewCycle(state)
  }

  const scheduleNext = () => {
    const nextAnchor = getNextCycleAnchor(getCycleAnchor(Date.now()))
    platform.scheduler.setTimeoutAt(nextAnchor, () => {
      startNewCycle(state)
      scheduleNext()
    })
  }
  scheduleNext()
}

// Picks a new density excluding the one currently in use, then rebuilds the grid live —
// safe because nothing rests on an exchange; "cancelling" is just discarding the in-memory array.
function switchFormat(state: BotState, currentPrice: number): void {
  const candidates = GRID_DENSITIES.filter(d => d !== state.config.gridLevels)
  const newDensity = candidates[Math.floor(Math.random() * candidates.length)]
  state.config.gridLevels = newDensity
  initGrid(state)
  buildInitialOrders(state, currentPrice)
  logEntry(state, 'INFO', `Grid format switched to ${newDensity} rungs (Format ${GRID_DENSITIES.indexOf(newDensity) + 1})`)
}

export function checkGridFormatSwitches(state: BotState, currentPrice: number): void {
  if (state.gridFormatSwitchTimes.every(t => t === 0)) return
  const now = Date.now()
  for (let i = 0; i < 3; i++) {
    if (!state.gridFormatSwitchExecuted[i] && state.gridFormatSwitchTimes[i] > 0 && now >= state.gridFormatSwitchTimes[i]) {
      switchFormat(state, currentPrice)
      state.gridFormatSwitchExecuted[i] = true
    }
  }
}

// Returns the epoch ms of the next unexecuted switch, or 0 if none scheduled.
export function getNextFormatSwitchTime(state: BotState): number {
  const upcoming = state.gridFormatSwitchTimes
    .filter((t, i) => t > 0 && !state.gridFormatSwitchExecuted[i])
    .sort((a, b) => a - b)
  return upcoming[0] ?? 0
}
