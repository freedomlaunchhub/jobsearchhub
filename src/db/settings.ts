import { getDB } from '@/db/connection'
import { type Settings, DEFAULT_SETTINGS } from '@/db/schema'

export async function getSettings(): Promise<Settings> {
  const db = await getDB()
  const record = await db.get('settings', 'config')
  return record ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB()
  await db.put('settings', settings)
}
