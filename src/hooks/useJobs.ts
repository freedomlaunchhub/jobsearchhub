import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Job, JobStatus } from '@/db/schema'
import { getAllJobs, saveJob, deleteJob } from '@/db/jobs'

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllJobs().then((loaded) => {
      setJobs(loaded)
      setLoading(false)
    })
  }, [])

  const addJobs = useCallback(
    async (newJobs: Job[]) => {
      const existingIds = new Set(jobs.map((j) => j.id))
      const unique = newJobs.filter((j) => !existingIds.has(j.id))
      for (const job of unique) {
        await saveJob(job)
      }
      if (unique.length > 0) {
        setJobs((prev) => [...prev, ...unique])
      }
    },
    [jobs]
  )

  const updateJob = useCallback(
    async (id: string, partial: Partial<Job>) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === id)
        if (idx === -1) return prev
        const updated = { ...prev[idx], ...partial }
        saveJob(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const moveJobStatus = useCallback(
    async (id: string, newStatus: JobStatus) => {
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === id)
        if (idx === -1) return prev
        const job = prev[idx]
        const updated: Job = {
          ...job,
          status: newStatus,
          statusHistory: [
            ...job.statusHistory,
            { status: newStatus, date: new Date().toISOString() },
          ],
          appliedDate:
            newStatus === 'applied' ? new Date().toISOString() : job.appliedDate,
        }
        saveJob(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const removeJob = useCallback(async (id: string) => {
    await deleteJob(id)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const job of jobs) {
      if (job.status === 'new' || job.status === 'pass') continue
      counts[job.status] = (counts[job.status] || 0) + 1
    }
    return counts
  }, [jobs])

  return { jobs, loading, addJobs, updateJob, moveJobStatus, removeJob, pipelineCounts }
}
