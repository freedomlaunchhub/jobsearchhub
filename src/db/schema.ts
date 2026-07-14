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
  discoveryCountry: string
  discoveryLocation: string
  lastDailyRefresh?: string
}

export const LINKEDIN_INDUSTRIES = [
  'Accounting',
  'Automotive',
  'Aviation & Aerospace',
  'Banking',
  'Biotechnology',
  'Civil Engineering',
  'Computer Software',
  'Construction',
  'Defense & Space',
  'Education',
  'Electrical/Electronic Manufacturing',
  'Entertainment',
  'Environmental Services',
  'Farming',
  'Financial Services',
  'Food & Beverages',
  'Government Administration',
  'Hospital & Health Care',
  'Hospitality',
  'Human Resources',
  'Information Technology',
  'Insurance',
  'Internet',
  'Legal Services',
  'Logistics and Supply Chain',
  'Management Consulting',
  'Manufacturing',
  'Marketing and Advertising',
  'Mechanical or Industrial Engineering',
  'Media Production',
  'Mining & Metals',
  'Nonprofit Organization Management',
  'Oil & Energy',
  'Pharmaceuticals',
  'Real Estate',
  'Renewables & Environment',
  'Retail',
  'Software Development',
  'Staffing and Recruiting',
  'Telecommunications',
  'Transportation/Trucking/Railroad',
  'Utilities',
] as const

export const COMPANY_SIZES = [
  { value: '2-10', label: '2-10' },
  { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' },
  { value: '201-500', label: '201-500' },
  { value: '501-1,000', label: '501-1,000' },
  { value: '1,001-5,000', label: '1,001-5,000' },
  { value: '5,001-10,000', label: '5,001-10,000' },
  { value: '10,001+', label: '10,001+' },
] as const

export const DISCOVERY_COUNTRIES = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
] as const

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
export type CompanyStatus = 'open_listing' | 'new' | 'queued' | 'researched' | 'networking' | 'applied' | 'interviewing' | 'not_interested'

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
  discoveryCountry: 'CA',
  discoveryLocation: '',
  streak: {
    current: 0,
    longest: 0,
    lastActiveDate: null,
  },
}
