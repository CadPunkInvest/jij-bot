import { LocalNotifications } from '@capacitor/local-notifications'

let notifIdCounter = 1

export const androidNotify = {
  async send(title: string, body: string): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [{ id: notifIdCounter++, title, body }],
    })
  },

  async scheduleAt(time: number, title: string, body: string): Promise<void> {
    await LocalNotifications.schedule({
      notifications: [{
        id: notifIdCounter++,
        title,
        body,
        schedule: { at: new Date(time), allowWhileIdle: true },
      }],
    })
  },

  async cancelAll(): Promise<void> {
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  },
}
