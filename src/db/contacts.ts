import type { Contact } from '@/db/schema'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getAllContacts(): Promise<Contact[]> {
  return api('contacts')
}

export async function getContactsByCompany(companyId: string): Promise<Contact[]> {
  return api(`contacts?companyId=${companyId}`)
}

export async function getContact(id: string): Promise<Contact | undefined> {
  const all: Contact[] = await api('contacts')
  return all.find(c => c.id === id)
}

export async function saveContact(contact: Contact): Promise<void> {
  if (contact.createdAt) {
    await api('contacts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    })
  } else {
    await api('contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contact),
    })
  }
}

export async function deleteContact(id: string): Promise<void> {
  await api(`contacts?id=${id}`, { method: 'DELETE' })
}

export async function getOverdueFollowups(): Promise<Contact[]> {
  return api('contacts?overdue=true')
}
