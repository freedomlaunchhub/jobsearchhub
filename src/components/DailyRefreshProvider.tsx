import { useEffect, useState, useCallback } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useJobs } from '@/hooks/useJobs'
import { useCompanies } from '@/hooks/useCompanies'
import { useDailyRefresh } from '@/hooks/useDailyRefresh'
import DailyBriefing from './DailyBriefing'

interface Props {
  children: React.ReactNode
}

export default function DailyRefreshProvider({ children }: Props) {
  const { settings } = useSettings()
  const { jobs, addJobs } = useJobs()
  const { companies, addCompany } = useCompanies()
  const [skipped, setSkipped] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const { isRefreshing, progress, error, runDailyRefresh, forceRefresh } = useDailyRefresh({
    settings,
    jobs,
    companies,
    addJobs,
    addCompany,
  })

  // Auto-trigger on first load if not yet refreshed today
  useEffect(() => {
    if (!settings || triggered) return

    const today = new Date().toISOString().split('T')[0]
    if (settings.lastDailyRefresh === today) return

    setTriggered(true)
    runDailyRefresh()
  }, [settings, triggered, runDailyRefresh])

  const handleSkip = useCallback(() => setSkipped(true), [])
  const handleRetry = useCallback(() => {
    setSkipped(false)
    setTriggered(true)
    forceRefresh()
  }, [forceRefresh])

  const showBriefing = !skipped && (isRefreshing || (error !== null && triggered))

  return (
    <>
      {showBriefing && (
        <DailyBriefing
          isRefreshing={isRefreshing}
          progress={progress}
          error={error}
          onSkip={handleSkip}
          onRetry={handleRetry}
        />
      )}
      {children}
    </>
  )
}
