import { useEffect, useCallback } from 'react'
import { differenceInCalendarDays, format } from 'date-fns'
import type { Settings } from '@/db/schema'

interface UseStreakParams {
  settings: Settings | null
  updateSettings: (partial: Partial<Settings>) => Promise<void>
}

export function useStreak({ settings, updateSettings }: UseStreakParams) {
  useEffect(() => {
    if (!settings) return

    const { streak } = settings
    const today = new Date()

    if (!streak.lastActiveDate) return

    const lastActive = new Date(streak.lastActiveDate)
    const daysDiff = differenceInCalendarDays(today, lastActive)

    if (daysDiff <= 1) return

    // Last active date is more than 1 day ago, reset streak
    if (streak.current !== 0) {
      updateSettings({
        streak: { ...streak, current: 0 },
      })
    }
  }, [settings, updateSettings])

  const recordActivity = useCallback(async () => {
    if (!settings) return

    const { streak } = settings
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')

    if (streak.lastActiveDate === todayStr) return

    let newCurrent: number

    if (streak.lastActiveDate) {
      const lastActive = new Date(streak.lastActiveDate)
      const daysDiff = differenceInCalendarDays(today, lastActive)
      newCurrent = daysDiff === 1 ? streak.current + 1 : 1
    } else {
      newCurrent = 1
    }

    const newLongest = Math.max(newCurrent, streak.longest)

    await updateSettings({
      streak: {
        current: newCurrent,
        longest: newLongest,
        lastActiveDate: todayStr,
      },
    })
  }, [settings, updateSettings])

  return {
    streak: settings?.streak.current ?? 0,
    longestStreak: settings?.streak.longest ?? 0,
    recordActivity,
  }
}
