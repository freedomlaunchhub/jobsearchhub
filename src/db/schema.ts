export interface Settings {
  id: 'config'
  jobTitles: string[]
  location: string
  remoteIncluded: boolean
  jobSources: JobSource[]
  dailyTarget: number
  streak: {
    current: number
    longest: number
    lastActiveDate: string | null
  }
  preferredIndustries: string[]
  preferredCompanySizes: string[]
  lastDailyRefresh?: string
}

export interface JobSource {
  id: string
  name: string
  enabled: boolean
}

export type JobStatus = 'new' | 'saved' | 'applied' | 'interview' | 'offer' | 'pass'

export interface StatusHistoryEntry {
  status: JobStatus
  date: string
}

export interface Job {
  id: string
  title: string
  company: string
  location: string
  remote: boolean
  source: string
  sourceUrl: string
  postedDate: string
  description: string
  salaryRange: string | null
  requirements: string[]
  status: JobStatus
  statusHistory: StatusHistoryEntry[]
  notes: string
  appliedDate: string | null
  createdAt: string
}

export type CompanySize = 'Small' | 'Medium' | 'Large' | 'Enterprise'
export type CompanyPriority = 'high' | 'medium' | 'low'
export type CompanyStatus = 'open_listing' | 'new' | 'researched' | 'networking' | 'applied' | 'interviewing'

export interface Company {
  id: string
  name: string
  industry: string
  website: string
  careersUrl: string
  linkedinUrl: string
  size: CompanySize
  priority: CompanyPriority
  status: CompanyStatus
  whyDream: string
  notes: string
  contactCount: number
  createdAt: string
}

export type ConnectionStatus = 'identified' | 'message_sent' | 'connected' | 'in_conversation'

export interface SocialProfile {
  platform: string
  url: string
}

export interface Contact {
  id: string
  companyId: string
  companyName: string
  name: string
  title: string
  linkedinUrl: string
  otherSocial: SocialProfile[]
  rapportNotes: string
  connectionStatus: ConnectionStatus
  connectionDate: string | null
  lastContactDate: string | null
  nextFollowupDate: string | null
  messageDrafts: string[]
  notes: string
  createdAt: string
}

export interface DailyLog {
  date: string
  applicationsCount: number
  connectionsSent: number
  followupsDone: number
  jobsReviewed: number
  notes: string
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'config',
  jobTitles: [
    'Project Manager',
    'Senior Project Manager',
    'Agile Project Manager',
    'Change Manager',
    'Change Management Lead',
    'Transformation Lead',
    'Program Manager',
    'Scrum Master',
  ],
  location: 'Calgary, AB, Canada',
  remoteIncluded: true,
  jobSources: [
    { id: 'linkedin', name: 'LinkedIn Jobs', enabled: true },
    { id: 'indeed', name: 'Indeed Canada', enabled: true },
    { id: 'company_careers', name: 'Company Career Pages', enabled: true },
  ],
  dailyTarget: 5,
  preferredIndustries: [],
  preferredCompanySizes: [],
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: null,
  },
}
