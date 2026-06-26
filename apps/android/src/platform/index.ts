import { Platform } from '@jij-bot/core'
import { CapacitorHttp } from '@capacitor/core'
import { androidStorage } from './storage'
import { localWallet } from './localWallet'
import { androidNotify } from './notify'
import { exportPrivateKeyB58 } from './secureKeyStore'

const timers: Map<number, ReturnType<typeof setTimeout>> = new Map()

export const androidPlatform: Platform = {
  storage: androidStorage,
  wallet: localWallet,
  notify: androidNotify,
  http: {
    async get(url: string) {
      const r = await CapacitorHttp.get({ url, headers: {} })
      return { status: r.status, data: r.data }
    },
    async post(url: string, body: unknown) {
      const r = await CapacitorHttp.post({
        url,
        headers: { 'Content-Type': 'application/json' },
        data: body,
      })
      return { status: r.status, data: r.data }
    },
  },
  exportPrivateKey: exportPrivateKeyB58,
  scheduler: {
    setMidnightCallback(fn: () => void): void {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const delay = midnight.getTime() - Date.now()
      setTimeout(fn, delay)
    },
    setTimeoutAt(time: number, fn: () => void): void {
      const delay = Math.max(0, time - Date.now())
      const t = setTimeout(() => {
        fn()
        timers.delete(time)
      }, delay)
      timers.set(time, t)
    },
  },
}
