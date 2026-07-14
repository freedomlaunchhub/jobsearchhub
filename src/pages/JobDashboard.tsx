import { useState } from 'react'
import { useJobs } from '@/hooks/useJobs'
import { useSettings } from '@/hooks/useSettings'
import { useStreak } from '@/hooks/useStreak'
import { useDailyLog } from '@/hooks/useDailyLog'
import StatsBar from '@/components/jobs/StatsBar'
import JobFeed from '@/components/jobs/JobFeed'
import PipelineBoard from '@/components/jobs/PipelineBoard'
import { searchJobs } from '@/lib/api'
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
      const enabledSources = settings.jobSources
        .filter((s) => s.enabled)
        .map((s) => s.id)
      const result = await searchJobs({
        titles: settings.jobTitles,
        location: settings.location,
        includeRemote: settings.remoteIncluded,
        sources: enabledSources,
        brightDataApiKey: settings.brightDataApiKey,
        anthropicApiKey: settings.anthropicApiKey,
      })
      const newJobs: Job[] = ((result as { jobs?: unknown[] }).jobs || []).map(
        (j: unknown) => {
          const raw = j as Record<string, unknown>
          return {
            id: crypto.randomUUID(),
            title: (raw.title as string) || '',
            company: (raw.company as string) || '',
            location: (raw.location as string) || '',
            remote: (raw.remote as boolean) || false,
            source: (raw.source as string) || '',
            sourceUrl: (raw.sourceUrl as string) || '',
            postedDate: (raw.postedDate as string) || new Date().toISOString().split('T')[0],
            description: (raw.description as string) || '',
            salaryRange: (raw.salaryRange as string) || null,
            requirements: (raw.requirements as string[]) || [],
            status: 'new' as const,
            statusHistory: [{ status: 'new' as const, date: new Date().toISOString() }],
            notes: '',
            appliedDate: null,
            createdAt: new Date().toISOString(),
          }
        }
      )
      await addJobs(newJobs)
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
