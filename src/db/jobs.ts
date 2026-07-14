import { getDB } from '@/db/connection'
import type { Job, JobStatus } from '@/db/schema'

export async function getAllJobs(): Promise<Job[]> {
  const db = await getDB()
  return db.getAll('jobs')
}

export async function getJobsByStatus(status: JobStatus): Promise<Job[]> {
  const db = await getDB()
  return db.getAllFromIndex('jobs', 'by-status', status)
}

export async function getJob(id: string): Promise<Job | undefined> {
  const db = await getDB()
  return db.get('jobs', id)
}

export async function saveJob(job: Job): Promise<void> {
  const db = await getDB()
  await db.put('jobs', job)
}

export async function deleteJob(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('jobs', id)
}
