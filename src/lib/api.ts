interface SearchJobsParams {
  titles: string[]
  location: string
  includeRemote: boolean
  country?: string
  brightDataApiKey: string
}

interface ResearchCompanyParams {
  companyName: string
  location: string
  brightDataApiKey: string
  anthropicApiKey: string
}

interface ResearchContactParams {
  name: string
  title: string
  company: string
  linkedinUrl: string
  brightDataApiKey: string
  anthropicApiKey: string
}

interface GenerateMessageParams {
  contactName: string
  contactTitle: string
  company: string
  rapportNotes: string
  messageType: 'connection' | 'follow_up' | 'thank_you' | 'check_in'
  previousMessages: string[]
  additionalContext: string
  anthropicApiKey: string
}

interface JobStatusParams {
  snapshotId: string
  brightDataApiKey: string
}

async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(errBody.error || errBody.message || `API error: ${response.status}`)
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

export function checkJobStatus(params: JobStatusParams) {
  return apiCall<JobStatusResult>('job-status', params)
}

export function researchCompany(params: ResearchCompanyParams) {
  return apiCall('research-company', params)
}

export function researchContact(params: ResearchContactParams) {
  return apiCall('research-contact', params)
}

export function generateMessage(params: GenerateMessageParams) {
  return apiCall<{ message: string }>('generate-message', params)
}

interface FindContactsParams {
  companyName: string
  industry: string
  targetRoles: string[]
  brightDataApiKey: string
  anthropicApiKey: string
}

export function findContacts(params: FindContactsParams) {
  return apiCall<{ contacts: Array<{ name: string; title: string; linkedinUrl: string }> }>(
    'find-contacts',
    params
  )
}
