import { useState, useEffect, useCallback } from 'react'
import type { Settings } from '@/db/schema'
import { getSettings, saveSettings } from '@/db/settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  const updateSettings = useCallback(
    async (partial: Partial<Settings>) => {
      if (!settings) return
      const updated: Settings = { ...settings, ...partial }
      await saveSettings(updated)
      setSettings(updated)
    },
    [settings]
  )

  return { settings, loading, updateSettings }
}
