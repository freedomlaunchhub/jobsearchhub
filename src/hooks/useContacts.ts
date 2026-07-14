import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import type { Contact } from '@/db/schema'
import { getAllContacts, saveContact, deleteContact } from '@/db/contacts'
import { updateContactCount } from '@/db/companies'

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllContacts().then((loaded) => {
      setContacts(loaded)
      setLoading(false)
    })
  }, [])

  const getCompanyContacts = useCallback(
    (companyId: string): Contact[] => {
      return contacts.filter((c) => c.companyId === companyId)
    },
    [contacts]
  )

  const addContact = useCallback(
    async (partial: Partial<Contact>): Promise<Contact> => {
      const contact: Contact = {
        id: crypto.randomUUID(),
        companyId: '',
        companyName: '',
        name: '',
        title: '',
        linkedinUrl: '',
        otherSocial: [],
        rapportNotes: '',
        connectionStatus: 'identified',
        connectionDate: null,
        lastContactDate: null,
        nextFollowupDate: null,
        messageDrafts: [],
        notes: '',
        createdAt: new Date().toISOString(),
        ...partial,
      }
      await saveContact(contact)
      if (contact.companyId) {
        await updateContactCount(contact.companyId, 1)
      }
      setContacts((prev) => [...prev, contact])
      return contact
    },
    []
  )

  const updateContact = useCallback(
    async (id: string, partial: Partial<Contact>): Promise<void> => {
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === id)
        if (idx === -1) return prev
        const updated = { ...prev[idx], ...partial }
        saveContact(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const removeContact = useCallback(
    async (id: string): Promise<void> => {
      const existing = contacts.find((c) => c.id === id)
      await deleteContact(id)
      if (existing?.companyId) {
        await updateContactCount(existing.companyId, -1)
      }
      setContacts((prev) => prev.filter((c) => c.id !== id))
    },
    [contacts]
  )

  const overdueFollowups = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return contacts
      .filter((c) => c.nextFollowupDate !== null && c.nextFollowupDate <= today)
      .sort((a, b) => (a.nextFollowupDate! < b.nextFollowupDate! ? -1 : 1))
  }, [contacts])

  const snoozeFollowup = useCallback(
    async (contactId: string, days: number): Promise<void> => {
      const newDate = format(addDays(new Date(), days), 'yyyy-MM-dd')
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId)
        if (idx === -1) return prev
        const updated = { ...prev[idx], nextFollowupDate: newDate }
        saveContact(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const markFollowupDone = useCallback(
    async (contactId: string): Promise<void> => {
      const today = format(new Date(), 'yyyy-MM-dd')
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId)
        if (idx === -1) return prev
        const updated = {
          ...prev[idx],
          lastContactDate: today,
          nextFollowupDate: null,
        }
        saveContact(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  return {
    contacts,
    loading,
    getCompanyContacts,
    addContact,
    updateContact,
    removeContact,
    overdueFollowups,
    snoozeFollowup,
    markFollowupDone,
  }
}
