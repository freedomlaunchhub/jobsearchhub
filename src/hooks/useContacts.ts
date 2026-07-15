import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Contact } from '@/db/schema'
import { getAllContacts, saveContact, deleteContact } from '@/db/contacts'
import { updateContactCount } from '@/db/companies'

// A contact is due for follow-up when their networking status has sat
// unchanged this long since the last recorded touch
export const FOLLOWUP_AFTER_DAYS = 7

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
        location: '',
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
        // A status change is a networking touch — stamp it so the follow-up
        // queue can measure how long a contact has sat without movement
        const stamped =
          partial.connectionStatus && partial.connectionStatus !== prev[idx].connectionStatus
            ? { ...partial, lastContactDate: new Date().toISOString() }
            : partial
        const updated = { ...prev[idx], ...stamped }
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

  // Status-based follow-up queue: contacts you've messaged (or connected
  // with) whose status hasn't moved in FOLLOWUP_AFTER_DAYS — no manual dates
  const overdueFollowups = useMemo(() => {
    const cutoff = Date.now() - FOLLOWUP_AFTER_DAYS * 24 * 60 * 60 * 1000
    return contacts
      .filter(
        (c) =>
          (c.connectionStatus === 'message_sent' || c.connectionStatus === 'connected') &&
          c.lastContactDate !== null &&
          new Date(c.lastContactDate).getTime() <= cutoff
      )
      .sort((a, b) => (a.lastContactDate! < b.lastContactDate! ? -1 : 1))
  }, [contacts])

  // "I followed up" — reset the timer without changing status
  const markFollowupDone = useCallback(
    async (contactId: string): Promise<void> => {
      setContacts((prev) => {
        const idx = prev.findIndex((c) => c.id === contactId)
        if (idx === -1) return prev
        const updated = { ...prev[idx], lastContactDate: new Date().toISOString() }
        saveContact(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const refresh = useCallback(async () => {
    const loaded = await getAllContacts()
    setContacts(loaded)
  }, [])

  return {
    contacts,
    loading,
    getCompanyContacts,
    addContact,
    updateContact,
    removeContact,
    overdueFollowups,
    markFollowupDone,
    refresh,
  }
}
