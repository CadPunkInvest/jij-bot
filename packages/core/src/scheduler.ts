import { Platform } from './types'

function getMsUntilLocalMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime() - now.getTime()
}

function getTomorrowMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight.getTime()
}

export function cryptoRandom(min: number, max: number): number {
  const bytes = crypto.getRandomValues(new Uint32Array(1))
  return min + (bytes[0] % (max - min))
}

export function scheduleMidnightReset(
  platform: Platform,
  onNewBuyTime: (randomBuyTime: number) => void,
): void {
  const msUntilMidnight = getMsUntilLocalMidnight()

  platform.scheduler.setTimeoutAt(Date.now() + msUntilMidnight, () => {
    const randomOffsetSeconds = cryptoRandom(0, 86399)
    const randomBuyTime = getTomorrowMidnight() + randomOffsetSeconds * 1000

    onNewBuyTime(randomBuyTime)
    platform.notify.scheduleAt(randomBuyTime, 'DCA Buy', 'Time to buy JIJ')

    // Recurse for the next night
    scheduleMidnightReset(platform, onNewBuyTime)
  })
}
