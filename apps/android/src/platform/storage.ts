// RULE: ALL persistent keys must go through androidStorage (Capacitor Preferences).
// Preferences survive APK upgrades; localStorage does NOT reliably.
// Never write wallet or grid data directly to localStorage.
import { Preferences } from '@capacitor/preferences'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

export const androidStorage = {
  async get(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key })
    return value
  },
  async set(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value })
  },
  async remove(key: string): Promise<void> {
    await Preferences.remove({ key })
  },
  async readFile(path: string): Promise<string> {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    })
    return result.data as string
  },
  async writeFile(path: string, content: string): Promise<void> {
    await Filesystem.writeFile({
      path,
      data: content,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  },
}
