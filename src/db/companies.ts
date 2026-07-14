import { getDB } from '@/db/connection'
import type { Company } from '@/db/schema'

export async function getAllCompanies(): Promise<Company[]> {
  const db = await getDB()
  return db.getAll('companies')
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const db = await getDB()
  return db.get('companies', id)
}

export async function saveCompany(company: Company): Promise<void> {
  const db = await getDB()
  await db.put('companies', company)
}

export async function deleteCompany(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('companies', id)
}

export async function updateContactCount(companyId: string, delta: number): Promise<void> {
  const db = await getDB()
  const company = await db.get('companies', companyId)
  if (!company) return
  company.contactCount += delta
  await db.put('companies', company)
}
