interface SearchJobsParams {
  titles: string[]
  location: string
  includeRemote: boolean
  sources: string[]
  brightDataApiKey: string
  anthropicApiKey: string
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

async function apiCall<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `API error: ${response.status}`)
  }
  return response.json()
}

export function searchJobs(params: SearchJobsParams) {
  return apiCall('search-jobs', params)
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
