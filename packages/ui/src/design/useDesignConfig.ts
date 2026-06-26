import { useState, useEffect, useCallback } from 'react'
import { DesignConfig, DEFAULT_DESIGN_CONFIG } from './designTypes'

const DESIGN_FILE = 'assets/design.config.json'

declare global {
  interface Window {
    __designConfigWriteFile?: (path: string, content: string) => Promise<void>
    __designConfigReadFile?: (path: string) => Promise<string>
  }
}

export function useDesignConfig() {
  const [config, setConfig] = useState<DesignConfig>(DEFAULT_DESIGN_CONFIG)
  const [saved, setSaved] = useState(true)

  useEffect(() => {
    loadConfig().then(c => setConfig(c))
  }, [])

  const loadConfig = async (): Promise<DesignConfig> => {
    try {
      if (window.__designConfigReadFile) {
        const raw = await window.__designConfigReadFile(DESIGN_FILE)
        return JSON.parse(raw) as DesignConfig
      }
      const res = await fetch(`/${DESIGN_FILE}`)
      if (!res.ok) return DEFAULT_DESIGN_CONFIG
      return await res.json()
    } catch {
      return DEFAULT_DESIGN_CONFIG
    }
  }

  const updateConfig = useCallback((updater: (c: DesignConfig) => DesignConfig) => {
    setConfig(prev => {
      const next = updater(prev)
      setSaved(false)
      return next
    })
  }, [])

  const saveConfig = useCallback(async () => {
    const json = JSON.stringify(config, null, 2)
    if (window.__designConfigWriteFile) {
      await window.__designConfigWriteFile(DESIGN_FILE, json)
    } else {
      console.warn('No file write handler — config not persisted to disk')
    }
    setSaved(true)
  }, [config])

  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_DESIGN_CONFIG)
    setSaved(false)
  }, [])

  return { config, updateConfig, saveConfig, resetConfig, saved }
}
