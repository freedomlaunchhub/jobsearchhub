import type { Job, JobStatus } from '@/db/schema'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getAllJobs(): Promise<Job[]> {
  return api('jobs')
}

export async function getJobsByStatus(status: JobStatus): Promise<Job[]> {
  return api(`jobs?status=${status}`)
}

export async function getJob(id: string): Promise<Job | undefined> {
  return api(`jobs?id=${id}`)
}

export async function saveJob(job: Job): Promise<void> {
  if (job.createdAt) {
    await api('jobs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    })
  } else {
    await api('jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    })
  }
}

export async function saveJobs(jobs: Job[]): Promise<void> {
  await api('jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobs),
  })
}

export async function deleteJob(id: string): Promise<void> {
  await api(`jobs?id=${id}`, { method: 'DELETE' })
}
