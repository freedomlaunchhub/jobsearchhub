import { useState } from 'react'
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

export default function NetworkDashboard() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const { settings } = useSettings()
  const { companies, loading: companiesLoading, addCompany, updateCompany, removeCompany, statusCounts } = useCompanies()
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

  const handleResearchCompany = async () => {
    if (!selectedCompany) return
    try {
      const result = await researchCompany({
        companyName: selectedCompany.name,
      })
      await updateCompany(selectedCompany.id, {
        website: result.website || selectedCompany.website,
        careersUrl: result.careersUrl || selectedCompany.careersUrl,
        linkedinUrl: result.linkedinUrl || selectedCompany.linkedinUrl,
        industry: result.industry || selectedCompany.industry,
        size: (result.size as Company['size']) || selectedCompany.size,
        notes: selectedCompany.notes
          ? selectedCompany.notes + '\n\n' + (result.summary || '')
          : (result.summary || ''),
      })
    } catch {
      // API failed silently
    }
  }

  const handleFindPeople = async () => {
    if (!selectedCompany) return
    try {
      const result = await findContacts({
        companyName: selectedCompany.name,
        companyId: selectedCompany.id,
      })
      if (result.savedCount > 0) {
        await refreshContacts()
      }
      return result
    } catch {
      // API failed silently
    }
  }

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
              onResearchCompany={handleResearchCompany}
              onFindPeople={handleFindPeople}
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
