import { cryptoRandom } from './scheduler'

// Three 8-hour windows per day, anchored at 9am:
//   Window 0: 9am  -> 5pm  (same day)
//   Window 1: 5pm  -> 1am  (crosses midnight)
//   Window 2: 1am  -> 9am  (next day)
export const WINDOW_SECONDS = 8 * 60 * 60
const WINDOW_MS = WINDOW_SECONDS * 1000

// Epoch ms of the most recent 9am at or before `now`
export function getCycleAnchor(now: number): number {
  const d = new Date(now)
  d.setHours(9, 0, 0, 0)
  if (d.getTime() > now) d.setDate(d.getDate() - 1)
  return d.getTime()
}

export function getNextCycleAnchor(anchor9am: number): number {
  const d = new Date(anchor9am)
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

export function getWindowStarts(anchor9am: number): [number, number, number] {
  return [anchor9am, anchor9am + WINDOW_MS, anchor9am + 2 * WINDOW_MS]
}

// Picks one random trigger time per window, avoiding the exact previous offset for that slot.
export function pickCycleTimes(
  anchor9am: number,
  prevOffsets: number[],
): { times: [number, number, number]; offsets: [number, number, number] } {
  const starts = getWindowStarts(anchor9am)
  const offsets: number[] = []
  const times: number[] = []
  starts.forEach((start, i) => {
    let offset = cryptoRandom(0, WINDOW_SECONDS)
    if (offset === prevOffsets[i]) offset = (offset + 1) % WINDOW_SECONDS
    offsets.push(offset)
    times.push(start + offset * 1000)
  })
  return { times: times as [number, number, number], offsets: offsets as [number, number, number] }
}
