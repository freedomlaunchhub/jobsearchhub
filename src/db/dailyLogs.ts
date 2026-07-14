import { format } from 'date-fns'
import { getDB } from '@/db/connection'
import type { DailyLog } from '@/db/schema'

export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  const db = await getDB()
  return db.get('dailyLogs', date)
}

export async function getOrCreateTodayLog(): Promise<DailyLog> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const existing = await getDailyLog(today)
  if (existing) return existing

  const log: DailyLog = {
    date: today,
    applicationsCount: 0,
    connectionsSent: 0,
    followupsDone: 0,
    jobsReviewed: 0,
    notes: '',
  }
  const db = await getDB()
  await db.put('dailyLogs', log)
  return log
}

export async function saveDailyLog(log: DailyLog): Promise<void> {
  const db = await getDB()
  await db.put('dailyLogs', log)
}

export async function incrementDailyLogField(
  field: keyof Pick<DailyLog, 'applicationsCount' | 'connectionsSent' | 'followupsDone' | 'jobsReviewed'>
): Promise<DailyLog> {
  const log = await getOrCreateTodayLog()
  log[field] += 1
  await saveDailyLog(log)
  return log
}
