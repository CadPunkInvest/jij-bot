import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'

// Keys stored as files in AppData — survives reinstalls.
// Everything else falls through to localStorage.
const FILE_KEYS = new Set(['jij-bot-state'])

async function getFilePath(key: string): Promise<string> {
  const dir = await appDataDir()
  await mkdir(dir, { recursive: true }).catch(() => {})
  return join(dir, `${key}.json`)
}

async function fileGet(key: string): Promise<string | null> {
  try {
    const path = await getFilePath(key)
    if (!(await exists(path))) return null
    return await readTextFile(path)
  } catch {
    return null
  }
}

async function fileSet(key: string, value: string): Promise<void> {
  const path = await getFilePath(key)
  await writeTextFile(path, value)
}

export const desktopStorage = {
  async get(key: string): Promise<string | null> {
    if (FILE_KEYS.has(key)) {
      const fileVal = await fileGet(key)
      if (fileVal !== null) return fileVal
      // One-time migration: pull from localStorage if it exists there
      const lsVal = localStorage.getItem(key)
      if (lsVal) {
        await fileSet(key, lsVal)
        localStorage.removeItem(key)
        return lsVal
      }
      return null
    }
    return localStorage.getItem(key)
  },

  async set(key: string, value: string): Promise<void> {
    if (FILE_KEYS.has(key)) {
      await fileSet(key, value)
      return
    }
    localStorage.setItem(key, value)
  },

  async remove(key: string): Promise<void> {
    if (FILE_KEYS.has(key)) {
      try {
        const path = await getFilePath(key)
        const { remove } = await import('@tauri-apps/plugin-fs')
        await remove(path)
      } catch {}
      return
    }
    localStorage.removeItem(key)
  },

  async readFile(path: string): Promise<string> {
    return readTextFile(path)
  },

  async writeFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content)
  },
}
