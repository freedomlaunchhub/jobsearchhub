import { useState, useCallback, useRef } from 'react'
import type { Job, Company, Settings } from '@/db/schema'
import { searchJobs, checkJobStatus } from '@/lib/api'
import type { SearchJobsResult } from '@/lib/api'
import { getSettings, saveSettings } from '@/db/settings'
import { jobDescriptionText } from '@/lib/utils'

interface Progress {
  phase: string
  detail: string
  current: number
  total: number
}

interface DailyRefreshResult {
  isRefreshing: boolean
  progress: Progress
  error: string | null
  runDailyRefresh: () => Promise<void>
  forceRefresh: () => Promise<void>
  lastRefreshDate: string | null
}

interface DailyRefreshParams {
  settings: Settings | null
  jobs: Job[]
  companies: Company[]
  addJobs: (jobs: Job[]) => Promise<void>
  addCompany: (partial: Partial<Company>) => Promise<Company>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mapLinkedInJob(raw: Record<string, unknown>): Job {
  const salaryParts: string[] = []
  const baseSalary = raw.base_salary as Record<string, unknown> | null
  if (baseSalary && baseSalary.min_amount != null) {
    const currency = (baseSalary.currency as string) || '$'
    const min = baseSalary.min_amount
    const max = baseSalary.max_amount
    const period = (baseSalary.payment_period as string) || ''
    salaryParts.push(max ? `${currency}${min}-${currency}${max}/${period}` : `${currency}${min}/${period}`)
  }
  const payRange = (raw.job_base_pay_range as string) || null

  return {
    id: (raw.job_posting_id as string) || crypto.randomUUID(),
    title: (raw.job_title as string) || '',
    company: (raw.company_name as string) || '',
    location: (raw.job_location as string) || '',
    remote: ((raw.job_location as string) || '').toLowerCase().includes('remote'),
    source: 'linkedin',
    sourceUrl: (raw.url as string) || (raw.apply_link as string) || '',
    postedDate: (raw.job_posted_date as string) || new Date().toISOString().split('T')[0],
    description: jobDescriptionText(raw),
    salaryRange: salaryParts[0] || payRange || null,
    requirements: [],
    status: 'new' as const,
    statusHistory: [{ status: 'new' as const, date: new Date().toISOString() }],
    notes: '',
    appliedDate: null,
    createdAt: new Date().toISOString(),
  }
}

export function useDailyRefresh({
  settings,
  jobs,
  companies,
  addJobs,
  addCompany,
}: DailyRefreshParams): DailyRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [progress, setProgress] = useState<Progress>({
    phase: '',
    detail: '',
    current: 0,
    total: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshDate, setLastRefreshDate] = useState<string | null>(
    settings?.lastDailyRefresh ?? null
  )
  const abortRef = useRef(false)

  const runRefreshInternal = useCallback(async (force: boolean) => {
    if (!settings) {
      setError('Settings not loaded')
      return
    }

    const today = getTodayDate()
    if (!force && settings.lastDailyRefresh === today) {
      return
    }

    setIsRefreshing(true)
    setError(null)
    abortRef.current = false

    try {
      // Phase 1: Search Jobs via Bright Data LinkedIn Dataset
      setProgress({
        phase: 'Searching for jobs',
        detail: 'Triggering LinkedIn job search...',
        current: 0,
        total: 1,
      })

      const searchResult: SearchJobsResult = await searchJobs({
        titles: settings.jobTitles,
        location: settings.location,
        includeRemote: settings.remoteIncluded,
        country: 'CA',
      })

      let rawJobs: unknown[] = []

      if (searchResult.jobs && searchResult.jobs.length > 0) {
        rawJobs = searchResult.jobs
      } else if (searchResult.pending && searchResult.snapshotId) {
        // Poll for results
        setProgress({
          phase: 'Searching for jobs',
          detail: 'Waiting for LinkedIn results...',
          current: 0,
          total: 1,
        })

        const maxPolls = 30
        for (let i = 0; i < maxPolls; i++) {
          await delay(5000)

          setProgress({
            phase: 'Searching for jobs',
            detail: `Waiting for LinkedIn results... (${i + 1}/${maxPolls})`,
            current: 0,
            total: 1,
          })

          const statusResult = await checkJobStatus({
            snapshotId: searchResult.snapshotId,
          })

          if (statusResult.jobs && statusResult.jobs.length > 0) {
            rawJobs = statusResult.jobs
            break
          }

          if (!statusResult.pending) {
            break
          }
        }
      } else if (searchResult.error) {
        throw new Error(`Job search failed: ${searchResult.error}`)
      }

      // Map LinkedIn dataset fields to Job schema
      const allNewJobs: Job[] = rawJobs
        .map((j) => mapLinkedInJob(j as Record<string, unknown>))
        .filter((j) => j.title && j.company)

      // Deduplicate against existing jobs
      const existingKeys = new Set(
        jobs.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`)
      )
      const uniqueNewJobs = allNewJobs.filter(
        (j) => !existingKeys.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`)
      )

      if (uniqueNewJobs.length > 0) {
        await addJobs(uniqueNewJobs)

        const existingCompanyNames = new Set(companies.map((c) => c.name.toLowerCase()))
        const newCompanyNames = [...new Set(uniqueNewJobs.map((j) => j.company))]
          .filter((name) => !existingCompanyNames.has(name.toLowerCase()))
        for (const name of newCompanyNames) {
          await addCompany({ name, status: 'open_listing' })
        }
      }

      setProgress({
        phase: 'Searching for jobs',
        detail: `Found ${uniqueNewJobs.length} new jobs`,
        current: 1,
        total: 1,
      })

      // Company research, contact finding, and message drafting are NOT part
      // of this refresh: they run on demand (Research & Find People button)
      // or via the nightly cron that picks up every 'queued' company.

      // Mark refresh complete
      const currentSettings = await getSettings()
      await saveSettings({ ...currentSettings, lastDailyRefresh: today })
      setLastRefreshDate(today)
      setProgress({
        phase: 'Complete',
        detail: 'Daily refresh complete',
        current: 1,
        total: 1,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daily refresh failed')
    } finally {
      setIsRefreshing(false)
    }
  }, [settings, jobs, companies, addJobs, addCompany])

  const runDailyRefresh = useCallback(() => runRefreshInternal(false), [runRefreshInternal])
  const forceRefresh = useCallback(() => runRefreshInternal(true), [runRefreshInternal])

  return { isRefreshing, progress, error, runDailyRefresh, forceRefresh, lastRefreshDate }
}
