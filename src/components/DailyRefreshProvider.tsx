import { useEffect, useState, useCallback } from 'react'
import { useSettings } from '@/hooks/useSettings'
import { useJobs } from '@/hooks/useJobs'
import { useCompanies } from '@/hooks/useCompanies'
import { useContacts } from '@/hooks/useContacts'
import { useDailyRefresh } from '@/hooks/useDailyRefresh'
import DailyBriefing from './DailyBriefing'

interface Props {
  children: React.ReactNode
}

export default function DailyRefreshProvider({ children }: Props) {
  const { settings } = useSettings()
  const { jobs, addJobs } = useJobs()
  const { companies, addCompany, updateCompany } = useCompanies()
  const { contacts, addContact, updateContact } = useContacts()
  const [skipped, setSkipped] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const { isRefreshing, progress, error, runDailyRefresh } = useDailyRefresh({
    settings,
    jobs,
    companies,
    contacts,
    addJobs,
    addCompany,
    updateCompany,
    addContact,
    updateContact,
  })

  useEffect(() => {
    if (!settings || triggered) return
    if (!settings.brightDataApiKey || !settings.anthropicApiKey) return

    const today = new Date().toISOString().split('T')[0]
    if (settings.lastDailyRefresh === today) return

    setTriggered(true)
    runDailyRefresh()
  }, [settings, triggered, runDailyRefresh])

  const handleSkip = useCallback(() => setSkipped(true), [])
  const handleRetry = useCallback(() => {
    setTriggered(false)
    setSkipped(false)
  }, [])

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
