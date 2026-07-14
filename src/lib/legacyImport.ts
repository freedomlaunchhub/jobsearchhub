import { getDB } from '@/db/connection'
import type { Job, Company, Contact } from '@/db/schema'

const FLAG = 'jsh-legacy-import-done'

async function api(path: string, body: unknown): Promise<boolean> {
  const res = await fetch(`/api/data/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok
}

async function fetchList<T>(path: string): Promise<T[] | null> {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

/**
 * One-time recovery: before the app moved to Cloudflare D1, all data lived in
 * the browser's IndexedDB. Anything saved there (jobs with statuses/notes,
 * companies, contacts) is invisible to the D1-backed app, so on first load
 * this uploads it into the cloud database, deduplicating against whatever is
 * already there. Runs once per browser (localStorage flag); aborts silently
 * and retries next load if the user isn't logged in yet.
 */
export async function runLegacyImportOnce(): Promise<number> {
  if (localStorage.getItem(FLAG)) return 0

  let oldJobs: Job[] = []
  let oldCompanies: Company[] = []
  let oldContacts: Contact[] = []
  try {
    const db = await getDB()
    oldJobs = await db.getAll('jobs').catch(() => [])
    oldCompanies = await db.getAll('companies').catch(() => [])
    oldContacts = await db.getAll('contacts').catch(() => [])
  } catch {
    localStorage.setItem(FLAG, '1')
    return 0
  }

  if (oldJobs.length === 0 && oldCompanies.length === 0 && oldContacts.length === 0) {
    localStorage.setItem(FLAG, '1')
    return 0
  }

  // Requires an authenticated session — if these fail, retry on a later load
  const curJobs = await fetchList<Job>('jobs')
  const curCompanies = await fetchList<Company>('companies')
  const curContacts = await fetchList<Contact>('contacts')
  if (!curJobs || !curCompanies || !curContacts) return 0

  let imported = 0

  // Jobs: bulk POST, server uses INSERT OR IGNORE so existing ids are safe
  const curJobIds = new Set(curJobs.map((j) => j.id))
  const newJobs = oldJobs.filter((j) => j.id && !curJobIds.has(j.id))
  if (newJobs.length > 0 && (await api('jobs', newJobs))) {
    imported += newJobs.length
  }

  const curCompanyNames = new Set(curCompanies.map((c) => c.name.toLowerCase()))
  const companyIdMap = new Map<string, string>()
  for (const company of oldCompanies) {
    if (!company.name) continue
    if (curCompanyNames.has(company.name.toLowerCase())) {
      const existing = curCompanies.find((c) => c.name.toLowerCase() === company.name.toLowerCase())
      if (existing) companyIdMap.set(company.id, existing.id)
      continue
    }
    if (await api('companies', company)) {
      companyIdMap.set(company.id, company.id)
      imported++
    }
  }

  const curContactKeys = new Set(
    curContacts.map((c) => `${c.name.toLowerCase()}|${(c.companyName || '').toLowerCase()}`)
  )
  for (const contact of oldContacts) {
    if (!contact.name) continue
    const key = `${contact.name.toLowerCase()}|${(contact.companyName || '').toLowerCase()}`
    if (curContactKeys.has(key)) continue
    const mapped = { ...contact, companyId: companyIdMap.get(contact.companyId) ?? contact.companyId }
    if (await api('contacts', mapped)) imported++
  }

  localStorage.setItem(FLAG, '1')
  return imported
}
