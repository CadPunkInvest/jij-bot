import { Store } from '@tauri-apps/plugin-store'

let store: Store | null = null

async function getStore(): Promise<Store> {
  if (!store) store = await Store.load('jij-bot.json', { autoSave: true })
  return store
}

export const desktopStorage = {
  async get(key: string): Promise<string | null> {
    const s = await getStore()
    return (await s.get<string>(key)) ?? null
  },
  async set(key: string, value: string): Promise<void> {
    const s = await getStore()
    await s.set(key, value)
    await s.save()
  },
  async remove(key: string): Promise<void> {
    const s = await getStore()
    await s.delete(key)
    await s.save()
  },
  async readFile(path: string): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    return readTextFile(path)
  },
  async writeFile(path: string, content: string): Promise<void> {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, content)
  },
}
