import { useState, useCallback } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { useContacts } from '@/hooks/useContacts'
import { useSettings } from '@/hooks/useSettings'
import { useDailyLog } from '@/hooks/useDailyLog'
import Dream100Progress from '@/components/network/Dream100Progress'
import FollowUpQueue from '@/components/network/FollowUpQueue'
import CompanyList from '@/components/network/CompanyList'
import CompanyDetail from '@/components/network/CompanyDetail'
import { researchCompany, findContacts, generateMessage } from '@/lib/api'
import { parseCompaniesCSV } from '@/lib/csv'
import type { Company, Contact } from '@/db/schema'

interface BulkProgress {
  current: number
  total: number
  companyName: string
}

export default function NetworkDashboard() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null)
  const { settings } = useSettings()
  const { companies, loading: companiesLoading, addCompany, updateCompany, removeCompany, statusCounts, refresh: refreshCompanies } = useCompanies()
  const { loading: contactsLoading, getCompanyContacts, addContact, updateContact, removeContact, overdueFollowups, snoozeFollowup, markFollowupDone, refresh: refreshContacts } = useContacts()
  const { incrementField } = useDailyLog()

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null
  const selectedContacts = selectedCompanyId ? getCompanyContacts(selectedCompanyId) : []

  const handleAddCompany = async (partial: Partial<Company>) => {
    const company = await addCompany(partial)
    setSelectedCompanyId(company.id)
  }

  const handleDeleteCompany = async () => {
    if (!selectedCompanyId) return
    const companyContacts = getCompanyContacts(selectedCompanyId)
    for (const contact of companyContacts) {
      await removeContact(contact.id)
    }
    await removeCompany(selectedCompanyId)
    setSelectedCompanyId(null)
  }

  const handleAddContact = async (partial: Partial<Contact>) => {
    if (!selectedCompany) return
    await addContact({
      ...partial,
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
    })
  }

  const handleFollowupDone = async (contactId: string) => {
    await markFollowupDone(contactId)
    await incrementField('followupsDone')
  }

  const researchAndFindForCompany = useCallback(async (company: Company) => {
    let researchResult: string | null = null
    let findResult: { savedCount: number; total: number } | null = null

    try {
      const result = await researchCompany({ companyName: company.name })
      if (result.notFound) {
        researchResult = 'failed'
      } else {
        const updates: Partial<Company> = {}
        if (result.website && !company.website) updates.website = result.website
        if (result.careersUrl && !company.careersUrl) updates.careersUrl = result.careersUrl
        if (result.linkedinUrl && !company.linkedinUrl) updates.linkedinUrl = result.linkedinUrl
        if (result.industry && !company.industry) updates.industry = result.industry
        if (result.size && !company.size) updates.size = result.size as Company['size']
        if (result.summary) {
          updates.notes = company.notes
            ? company.notes + '\n\n' + result.summary
            : result.summary
        }
        if (Object.keys(updates).length > 0) {
          await updateCompany(company.id, updates)
        }
        researchResult = 'done'
      }
    } catch {
      researchResult = 'failed'
    }

    try {
      const result = await findContacts({
        companyName: company.name,
        companyId: company.id,
      })
      findResult = { savedCount: result.savedCount, total: result.contacts.length }
      if (result.savedCount > 0) {
        await refreshContacts()
        await refreshCompanies()
      }
    } catch {
      findResult = null
    }

    return { researchResult, findResult }
  }, [updateCompany, refreshContacts, refreshCompanies])

  const handleResearchAndFind = async () => {
    if (!selectedCompany) return
    return researchAndFindForCompany(selectedCompany)
  }

  const handleResearchAll = useCallback(async () => {
    if (bulkProgress) return
    const unresearched = companies.filter(
      (c) => !c.notes || c.notes.trim() === '' || c.contactCount === 0
    )
    if (unresearched.length === 0) return
    const total = unresearched.length
    for (let i = 0; i < unresearched.length; i++) {
      const company = unresearched[i]
      setBulkProgress({ current: i + 1, total, companyName: company.name })
      await researchAndFindForCompany(company)
    }
    setBulkProgress(null)
    await refreshCompanies()
    await refreshContacts()
  }, [companies, bulkProgress, researchAndFindForCompany, refreshCompanies, refreshContacts])

  const handleGenerateMessage = async (contactId: string) => {
    if (!settings) return
    const contact = selectedContacts.find((c) => c.id === contactId)
    if (!contact) return
    try {
      const result = await generateMessage({
        contactName: contact.name,
        contactTitle: contact.title,
        company: contact.companyName,
        rapportNotes: contact.rapportNotes,
        messageType: 'connection',
        previousMessages: contact.messageDrafts,
        additionalContext: '',
      })
      await updateContact(contactId, {
        messageDrafts: [...contact.messageDrafts, result.message],
      })
    } catch {
      // API failed silently
    }
  }

  const handleImportCompanies = async (csvText: string) => {
    const parsed = parseCompaniesCSV(csvText)
    for (const partial of parsed) {
      await addCompany(partial)
    }
  }

  if (companiesLoading || contactsLoading) {
    return <div className="text-muted">Loading...</div>
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Dream100Progress total={companies.length} statusCounts={statusCounts} />
        <FollowUpQueue
          contacts={overdueFollowups}
          onMarkDone={handleFollowupDone}
          onSnooze={snoozeFollowup}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-2/5">
          <CompanyList
            companies={companies}
            selectedId={selectedCompanyId}
            onSelect={setSelectedCompanyId}
            onAdd={handleAddCompany}
            onImport={handleImportCompanies}
            onResearchAll={handleResearchAll}
            bulkProgress={bulkProgress}
          />
        </div>

        <div className="w-full md:w-3/5">
          {selectedCompany ? (
            <CompanyDetail
              company={selectedCompany}
              contacts={selectedContacts}
              onUpdateCompany={(partial) => updateCompany(selectedCompany.id, partial)}
              onAddContact={handleAddContact}
              onUpdateContact={updateContact}
              onDeleteCompany={handleDeleteCompany}
              onResearchAndFind={handleResearchAndFind}
              onGenerateMessage={handleGenerateMessage}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm p-8 text-center text-muted">
              Select a company from the list to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
