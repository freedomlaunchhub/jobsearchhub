import { type Settings, DEFAULT_SETTINGS } from '@/db/schema'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getSettings(): Promise<Settings> {
  const result = await api('settings')
  return result ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await api('settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
}
