import type { Company } from '@/db/schema'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`/api/data/${path}`, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getAllCompanies(): Promise<Company[]> {
  return api('companies')
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const all: Company[] = await api('companies')
  return all.find(c => c.id === id)
}

export async function saveCompany(company: Company): Promise<void> {
  if (company.createdAt) {
    await api('companies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company),
    })
  } else {
    await api('companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company),
    })
  }
}

export async function deleteCompany(id: string): Promise<void> {
  await api(`companies?id=${id}`, { method: 'DELETE' })
}

export async function updateContactCount(companyId: string, delta: number): Promise<void> {
  const company = await getCompany(companyId)
  if (!company) return
  company.contactCount = Math.max(0, company.contactCount + delta)
  await saveCompany(company)
}
