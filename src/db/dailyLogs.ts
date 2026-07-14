import type { DailyLog } from '@/db/schema'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  return api(`daily-logs?date=${date}`)
}

export async function getOrCreateTodayLog(): Promise<DailyLog> {
  return api('daily-logs')
}

export async function saveDailyLog(log: DailyLog): Promise<void> {
  await api('daily-logs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(log),
  })
}

export async function incrementDailyLogField(
  field: keyof Pick<DailyLog, 'applicationsCount' | 'connectionsSent' | 'followupsDone' | 'jobsReviewed'>
): Promise<DailyLog> {
  return api('daily-logs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ incrementField: field }),
  })
}
