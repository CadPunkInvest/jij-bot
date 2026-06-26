import { sendNotification } from '@tauri-apps/plugin-notification'

const scheduled: Map<number, ReturnType<typeof setTimeout>> = new Map()

export const desktopNotify = {
  async send(title: string, body: string): Promise<void> {
    await sendNotification({ title, body })
  },

  async scheduleAt(time: number, title: string, body: string): Promise<void> {
    const delay = time - Date.now()
    if (delay <= 0) return

    const id = time
    if (scheduled.has(id)) clearTimeout(scheduled.get(id)!)
    const timer = setTimeout(async () => {
      await sendNotification({ title, body })
      scheduled.delete(id)
    }, delay)
    scheduled.set(id, timer)
  },

  async cancelAll(): Promise<void> {
    for (const t of scheduled.values()) clearTimeout(t)
    scheduled.clear()
  },
}
