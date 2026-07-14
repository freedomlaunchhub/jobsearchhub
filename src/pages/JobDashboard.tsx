import { useState } from 'react'
import { useJobs } from '@/hooks/useJobs'
import { useSettings } from '@/hooks/useSettings'
import { useStreak } from '@/hooks/useStreak'
import { useDailyLog } from '@/hooks/useDailyLog'
import StatsBar from '@/components/jobs/StatsBar'
import JobFeed from '@/components/jobs/JobFeed'
import PipelineBoard from '@/components/jobs/PipelineBoard'
import { searchJobs, checkJobStatus } from '@/lib/api'
import type { Job, JobStatus } from '@/db/schema'

export default function JobDashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'pipeline'>('feed')
  const [searching, setSearching] = useState(false)
  const { settings, updateSettings } = useSettings()
  const { streak, recordActivity } = useStreak({ settings, updateSettings })
  const { todayLog, incrementField } = useDailyLog()
  const { jobs, loading, addJobs, moveJobStatus, pipelineCounts } = useJobs()

  const handleStatusChange = async (id: string, status: JobStatus) => {
    await moveJobStatus(id, status)
    if (status === 'applied') {
      await incrementField('applicationsCount')
      await recordActivity()
    }
  }

  const handleSearch = async () => {
    if (!settings) return
    setSearching(true)
    try {
      const result = await searchJobs({
        titles: settings.jobTitles,
        location: settings.location,
        includeRemote: settings.remoteIncluded,
        country: 'CA',
        brightDataApiKey: settings.brightDataApiKey,
      })

      let rawJobs = result.jobs || []

      // If pending, poll for results
      if (result.pending && result.snapshotId) {
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 5000))
          const status = await checkJobStatus({
            snapshotId: result.snapshotId,
            brightDataApiKey: settings.brightDataApiKey,
          })
          if (status.jobs && status.jobs.length > 0) {
            rawJobs = status.jobs
            break
          }
          if (!status.pending) break
        }
      }

      const newJobs: Job[] = rawJobs.map((j: unknown) => {
        const raw = j as Record<string, unknown>
        return {
          id: (raw.job_posting_id as string) || crypto.randomUUID(),
          title: (raw.job_title as string) || '',
          company: (raw.company_name as string) || '',
          location: (raw.job_location as string) || '',
          remote: ((raw.job_location as string) || '').toLowerCase().includes('remote'),
          source: 'linkedin',
          sourceUrl: (raw.url as string) || (raw.apply_link as string) || '',
          postedDate: (raw.job_posted_date as string) || new Date().toISOString().split('T')[0],
          description: (raw.job_summary as string) || '',
          salaryRange: (raw.job_base_pay_range as string) || null,
          requirements: [],
          status: 'new' as const,
          statusHistory: [{ status: 'new' as const, date: new Date().toISOString() }],
          notes: '',
          appliedDate: null,
          createdAt: new Date().toISOString(),
        }
      })
      await addJobs(newJobs.filter((j) => j.title && j.company))
    } catch {
      // API not available yet — will be wired in Phase 4
    } finally {
      setSearching(false)
    }
  }

  if (loading) {
    return <div className="text-muted">Loading...</div>
  }

  return (
    <div>
      <StatsBar
        streak={streak}
        todayApplied={todayLog?.applicationsCount ?? 0}
        dailyTarget={settings?.dailyTarget ?? 5}
        pipelineCounts={pipelineCounts}
      />

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('feed')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'feed'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-slate-700'
          }`}
        >
          Job Feed
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-slate-700'
          }`}
        >
          Pipeline
        </button>
      </div>

      {activeTab === 'feed' ? (
        <JobFeed
          jobs={jobs}
          onStatusChange={handleStatusChange}
          onSearch={handleSearch}
          loading={searching}
        />
      ) : (
        <PipelineBoard jobs={jobs} onStatusChange={handleStatusChange} />
      )}
    </div>
  )
}
