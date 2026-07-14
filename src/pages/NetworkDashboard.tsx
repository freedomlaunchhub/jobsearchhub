import { useState } from 'react'
import { useCompanies } from '@/hooks/useCompanies'
import { useContacts } from '@/hooks/useContacts'
import { useDailyLog } from '@/hooks/useDailyLog'
import Dream100Progress from '@/components/network/Dream100Progress'
import FollowUpQueue from '@/components/network/FollowUpQueue'
import CompanyList from '@/components/network/CompanyList'
import CompanyDetail from '@/components/network/CompanyDetail'
import type { Company, Contact } from '@/db/schema'

export default function NetworkDashboard() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const { companies, loading: companiesLoading, addCompany, updateCompany, removeCompany, statusCounts } = useCompanies()
  const { loading: contactsLoading, getCompanyContacts, addContact, updateContact, removeContact, overdueFollowups, snoozeFollowup, markFollowupDone } = useContacts()
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
              onResearchCompany={() => {}}
              onResearchContact={() => {}}
              onGenerateMessage={() => {}}
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
