interface SearchJobsParams {
  titles: string[]
  location: string
  includeRemote: boolean
  country?: string
}

interface ResearchCompanyParams {
  companyName: string
}

interface GenerateMessageParams {
  contactName: string
  contactTitle: string
  company: string
  rapportNotes: string
  messageType: 'connection' | 'follow_up' | 'thank_you' | 'check_in'
  previousMessages: string[]
  additionalContext: string
}

interface FindContactsParams {
  companyName: string
  companyId: string
  targetRoles?: string[]
  autoSave?: boolean
}

async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let errMsg = `API error ${response.status}`
    try {
      const errBody = JSON.parse(text)
      errMsg = errBody.error || errBody.message || errMsg
    } catch {
      errMsg = text ? `${errMsg}: ${text.slice(0, 200)}` : errMsg
    }
    throw new Error(errMsg)
  }
  return response.json()
}

export interface SearchJobsResult {
  jobs?: unknown[]
  pending?: boolean
  snapshotId?: string
  error?: string
}

export function searchJobs(params: SearchJobsParams) {
  return apiCall<SearchJobsResult>('search-jobs', params)
}

export interface JobStatusResult {
  jobs?: unknown[]
  pending?: boolean
  error?: string
}

export function checkJobStatus(params: { snapshotId: string }) {
  return apiCall<JobStatusResult>('job-status', params)
}

export interface CompanyResearchResult {
  name: string
  website: string | null
  careersUrl: string | null
  linkedinUrl: string | null
  industry: string | null
  size: string | null
  summary: string | null
  headquarters: string | null
  specialties: string | null
  founded: string | null
  notFound?: boolean
}

export function researchCompany(params: ResearchCompanyParams) {
  return apiCall<CompanyResearchResult>('research-company', params)
}

export function generateMessage(params: GenerateMessageParams) {
  return apiCall<{ message: string }>('generate-message', params)
}

export interface FindContactsResult {
  contacts: Array<{ name: string; title: string; linkedinUrl: string; city: string; about: string }>
  companyName: string
  savedCount: number
  searchedAt: string
}

export function findContacts(params: FindContactsParams) {
  return apiCall<FindContactsResult>('find-contacts', params)
}

export interface DiscoverCompaniesParams {
  industries?: string[]
  country?: string
  region?: string
  companySizes?: string[]
  limit?: number
  preview?: boolean
}

export interface DiscoverCompaniesResult {
  companies: Array<{
    name: string
    website: string | null
    linkedinUrl: string | null
    industry: string | null
    size: string | null
    headquarters: string | null
    alreadyExists: boolean
  }>
  savedCount: number
  total: number
  alreadyExisted: number
  totalMatching: number | null
  preview?: boolean
}

export function discoverCompanies(params: DiscoverCompaniesParams) {
  return apiCall<DiscoverCompaniesResult>('discover-companies', params)
}
