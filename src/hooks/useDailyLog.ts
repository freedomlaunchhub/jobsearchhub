import { useState, useEffect, useCallback } from 'react'
import type { DailyLog } from '@/db/schema'
import { getOrCreateTodayLog, incrementDailyLogField } from '@/db/dailyLogs'

type IncrementableField = keyof Pick<
  DailyLog,
  'applicationsCount' | 'connectionsSent' | 'followupsDone' | 'jobsReviewed'
>

export function useDailyLog() {
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null)

  useEffect(() => {
    getOrCreateTodayLog().then(setTodayLog)
  }, [])

  const incrementField = useCallback(async (field: IncrementableField) => {
    const updated = await incrementDailyLogField(field)
    setTodayLog(updated)
  }, [])

  return { todayLog, incrementField }
}
