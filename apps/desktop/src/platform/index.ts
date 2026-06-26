import { Platform } from '@jij-bot/core'
import { invoke } from '@tauri-apps/api/core'
import { desktopStorage } from './storage'
import { localWallet } from './localWallet'
import { desktopNotify } from './notify'

const timers: Map<number, ReturnType<typeof setTimeout>> = new Map()

export const desktopPlatform: Platform = {
  storage: desktopStorage,
  wallet: localWallet,
  notify: desktopNotify,
  http: {
    async get(url: string) {
      const text = await invoke<string>('http_get', { url })
      return { status: 200, data: JSON.parse(text) }
    },
    async post(url: string, body: unknown) {
      const text = await invoke<string>('http_post', { url, body: JSON.stringify(body) })
      return { status: 200, data: JSON.parse(text) }
    },
  },
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
