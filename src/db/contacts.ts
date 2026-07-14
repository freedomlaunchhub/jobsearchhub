import { format } from 'date-fns'
import { getDB } from '@/db/connection'
import type { Contact } from '@/db/schema'

export async function getAllContacts(): Promise<Contact[]> {
  const db = await getDB()
  return db.getAll('contacts')
}

export async function getContactsByCompany(companyId: string): Promise<Contact[]> {
  const db = await getDB()
  return db.getAllFromIndex('contacts', 'by-companyId', companyId)
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const db = await getDB()
  return db.get('contacts', id)
}

export async function saveContact(contact: Contact): Promise<void> {
  const db = await getDB()
  await db.put('contacts', contact)
}

export async function deleteContact(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('contacts', id)
}

export async function getOverdueFollowups(): Promise<Contact[]> {
  const db = await getDB()
  const all = await db.getAll('contacts')
  const today = format(new Date(), 'yyyy-MM-dd')
  return all
    .filter((c) => c.nextFollowupDate !== null && c.nextFollowupDate <= today)
    .sort((a, b) => (a.nextFollowupDate! < b.nextFollowupDate! ? -1 : 1))
}
