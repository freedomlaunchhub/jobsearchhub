import { useState, useCallback, useRef } from 'react'
import type { Job, Company, Contact, Settings } from '@/db/schema'
import { searchJobs, researchCompany, researchContact, generateMessage, findContacts } from '@/lib/api'
import { getSettings, saveSettings } from '@/db/settings'

interface Progress {
  phase: string
  detail: string
  current: number
  total: number
}

interface DailyRefreshResult {
  isRefreshing: boolean
  progress: Progress
  error: string | null
  runDailyRefresh: () => Promise<void>
  forceRefresh: () => Promise<void>
  lastRefreshDate: string | null
}

interface DailyRefreshParams {
  settings: Settings | null
  jobs: Job[]
  companies: Company[]
  contacts: Contact[]
  addJobs: (jobs: Job[]) => Promise<void>
  addCompany: (partial: Partial<Company>) => Promise<Company>
  updateCompany: (id: string, partial: Partial<Company>) => Promise<void>
  addContact: (partial: Partial<Contact>) => Promise<Contact>
  updateContact: (id: string, partial: Partial<Contact>) => Promise<void>
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getTodayDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function useDailyRefresh({
  settings,
  jobs,
  companies,
  contacts,
  addJobs,
  addCompany,
  updateCompany,
  addContact,
  updateContact,
}: DailyRefreshParams): DailyRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [progress, setProgress] = useState<Progress>({
    phase: '',
    detail: '',
    current: 0,
    total: 0,
  })
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshDate, setLastRefreshDate] = useState<string | null>(
    settings?.lastDailyRefresh ?? null
  )
  const abortRef = useRef(false)

  const runRefreshInternal = useCallback(async (force: boolean) => {
    if (!settings) {
      setError('Settings not loaded')
      return
    }

    if (!settings.brightDataApiKey || !settings.anthropicApiKey) {
      setError('API keys not configured. Please add your Bright Data and Anthropic API keys in Settings.')
      return
    }

    const today = getTodayDate()
    if (!force && settings.lastDailyRefresh === today) {
      return
    }

    setIsRefreshing(true)
    setError(null)
    abortRef.current = false

    try {
      // Phase 1: Search Jobs
      const enabledSources = settings.jobSources.filter((s) => s.enabled)
      const searchCombinations = settings.jobTitles.length * enabledSources.length
      let searchIndex = 0

      setProgress({
        phase: 'Searching for jobs',
        detail: `Searching for jobs... (0/${searchCombinations})`,
        current: 0,
        total: searchCombinations,
      })

      const allNewJobs: Job[] = []

      for (const source of enabledSources) {
        try {
          const result = await searchJobs({
            titles: settings.jobTitles,
            location: settings.location,
            includeRemote: settings.remoteIncluded,
            sources: [source.id],
            brightDataApiKey: settings.brightDataApiKey,
            anthropicApiKey: settings.anthropicApiKey,
          })

          const resultJobs = result as unknown as Job[]
          if (Array.isArray(resultJobs)) {
            allNewJobs.push(...resultJobs)
          }
        } catch {
          // Continue on individual search failures
        }

        searchIndex++
        setProgress({
          phase: 'Searching for jobs',
          detail: `Searching for jobs... (${searchIndex}/${searchCombinations})`,
          current: searchIndex,
          total: searchCombinations,
        })

        await delay(500)
      }

      // Deduplicate against existing jobs by title + company
      const existingKeys = new Set(
        jobs.map((j) => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`)
      )
      const uniqueNewJobs = allNewJobs.filter(
        (j) => !existingKeys.has(`${j.title.toLowerCase()}|${j.company.toLowerCase()}`)
      )

      if (uniqueNewJobs.length > 0) {
        const jobsWithStatus = uniqueNewJobs.map((j) => ({
          ...j,
          status: 'new' as const,
        }))
        await addJobs(jobsWithStatus)
      }

      // Phase 2: Research Companies
      const unresearchedCompanies = companies.filter(
        (c) => !c.notes || c.notes.trim() === ''
      )
      const totalCompanies = unresearchedCompanies.length

      setProgress({
        phase: 'Researching companies',
        detail: `Researching companies... (0/${totalCompanies})`,
        current: 0,
        total: totalCompanies,
      })

      for (let i = 0; i < unresearchedCompanies.length; i++) {
        const company = unresearchedCompanies[i]
        try {
          const result = await researchCompany({
            companyName: company.name,
            location: settings.location,
            brightDataApiKey: settings.brightDataApiKey,
            anthropicApiKey: settings.anthropicApiKey,
          })

          const researchData = result as Record<string, unknown>
          await updateCompany(company.id, {
            notes: (researchData.notes as string) ?? '',
            industry: (researchData.industry as string) ?? company.industry,
            website: (researchData.website as string) ?? company.website,
            linkedinUrl: (researchData.linkedinUrl as string) ?? company.linkedinUrl,
            size: (researchData.size as Company['size']) ?? company.size,
          })
        } catch {
          // Continue on individual research failures
        }

        setProgress({
          phase: 'Researching companies',
          detail: `Researching companies... (${i + 1}/${totalCompanies})`,
          current: i + 1,
          total: totalCompanies,
        })

        await delay(500)
      }

      // Phase 3: Find Contacts
      const companiesWithNoContacts = companies.filter((c) => c.contactCount === 0)
      const totalFindContacts = companiesWithNoContacts.length

      setProgress({
        phase: 'Finding contacts',
        detail: `Finding contacts... (0/${totalFindContacts})`,
        current: 0,
        total: totalFindContacts,
      })

      for (let i = 0; i < companiesWithNoContacts.length; i++) {
        const company = companiesWithNoContacts[i]
        try {
          const result = await findContacts({
            companyName: company.name,
            industry: company.industry,
            targetRoles: ['Hiring Manager', 'Recruiter', 'HR Director'],
            brightDataApiKey: settings.brightDataApiKey,
            anthropicApiKey: settings.anthropicApiKey,
          })

          if (result.contacts && Array.isArray(result.contacts)) {
            for (const contactData of result.contacts) {
              await addContact({
                companyId: company.id,
                companyName: company.name,
                name: contactData.name,
                title: contactData.title,
                linkedinUrl: contactData.linkedinUrl,
              })
              await delay(100)
            }
          }
        } catch {
          // Continue on individual find failures
        }

        setProgress({
          phase: 'Finding contacts',
          detail: `Finding contacts... (${i + 1}/${totalFindContacts})`,
          current: i + 1,
          total: totalFindContacts,
        })

        await delay(500)
      }

      // Phase 4: Research Contacts
      const unresearchedContacts = contacts.filter(
        (c) => !c.rapportNotes || c.rapportNotes.trim() === ''
      )
      const totalResearchContacts = unresearchedContacts.length

      setProgress({
        phase: 'Researching contacts',
        detail: `Researching contacts... (0/${totalResearchContacts})`,
        current: 0,
        total: totalResearchContacts,
      })

      for (let i = 0; i < unresearchedContacts.length; i++) {
        const contact = unresearchedContacts[i]
        try {
          const result = await researchContact({
            name: contact.name,
            title: contact.title,
            company: contact.companyName,
            linkedinUrl: contact.linkedinUrl,
            brightDataApiKey: settings.brightDataApiKey,
            anthropicApiKey: settings.anthropicApiKey,
          })

          const researchData = result as Record<string, unknown>
          await updateContact(contact.id, {
            rapportNotes: (researchData.rapportNotes as string) ?? '',
            messageDrafts: (researchData.messageDrafts as string[]) ?? contact.messageDrafts,
          })
        } catch {
          // Continue on individual research failures
        }

        setProgress({
          phase: 'Researching contacts',
          detail: `Researching contacts... (${i + 1}/${totalResearchContacts})`,
          current: i + 1,
          total: totalResearchContacts,
        })

        await delay(500)
      }

      // Phase 5: Generate Messages
      const contactsNeedingMessages = contacts.filter(
        (c) => !c.messageDrafts || c.messageDrafts.length === 0
      )
      const totalMessages = contactsNeedingMessages.length

      setProgress({
        phase: 'Generating messages',
        detail: `Generating messages... (0/${totalMessages})`,
        current: 0,
        total: totalMessages,
      })

      for (let i = 0; i < contactsNeedingMessages.length; i++) {
        const contact = contactsNeedingMessages[i]
        try {
          const result = await generateMessage({
            contactName: contact.name,
            contactTitle: contact.title,
            company: contact.companyName,
            rapportNotes: contact.rapportNotes,
            messageType: 'connection',
            previousMessages: [],
            additionalContext: '',
            anthropicApiKey: settings.anthropicApiKey,
          })

          await updateContact(contact.id, {
            messageDrafts: [result.message],
          })
        } catch {
          // Continue on individual generation failures
        }

        setProgress({
          phase: 'Generating messages',
          detail: `Generating messages... (${i + 1}/${totalMessages})`,
          current: i + 1,
          total: totalMessages,
        })

        await delay(500)
      }

      // Mark refresh complete — persist to settings DB
      const currentSettings = await getSettings()
      await saveSettings({ ...currentSettings, lastDailyRefresh: today })
      setLastRefreshDate(today)
      setProgress({
        phase: 'Complete',
        detail: 'Daily refresh complete',
        current: 1,
        total: 1,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Daily refresh failed')
    } finally {
      setIsRefreshing(false)
    }
  }, [settings, jobs, companies, contacts, addJobs, addCompany, updateCompany, addContact, updateContact])

  const runDailyRefresh = useCallback(() => runRefreshInternal(false), [runRefreshInternal])
  const forceRefresh = useCallback(() => runRefreshInternal(true), [runRefreshInternal])

  return { isRefreshing, progress, error, runDailyRefresh, forceRefresh, lastRefreshDate }
}
