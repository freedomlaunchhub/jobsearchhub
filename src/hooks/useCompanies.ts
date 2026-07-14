import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Company } from '@/db/schema'
import { getAllCompanies, saveCompany, deleteCompany } from '@/db/companies'

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllCompanies().then((loaded) => {
      setCompanies(loaded)
      setLoading(false)
    })
  }, [])

  const addCompany = useCallback(
    async (partial: Partial<Company>): Promise<Company> => {
      const company: Company = {
        id: crypto.randomUUID(),
        name: '',
        industry: '',
        website: '',
        careersUrl: '',
        linkedinUrl: '',
        size: 'Medium',
        priority: 'medium',
        status: 'researching',
        whyDream: '',
        notes: '',
        contactCount: 0,
        createdAt: new Date().toISOString(),
        ...partial,
      }
      await saveCompany(company)
      setCompanies((prev) => [...prev, company])
      return company
    },
    []
  )

  const updateCompany = useCallback(
    async (id: string, partial: Partial<Company>): Promise<void> => {
      setCompanies((prev) => {
        const idx = prev.findIndex((c) => c.id === id)
        if (idx === -1) return prev
        const updated = { ...prev[idx], ...partial }
        saveCompany(updated)
        const next = [...prev]
        next[idx] = updated
        return next
      })
    },
    []
  )

  const removeCompany = useCallback(async (id: string): Promise<void> => {
    await deleteCompany(id)
    setCompanies((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const company of companies) {
      counts[company.status] = (counts[company.status] || 0) + 1
    }
    return counts
  }, [companies])

  const refresh = useCallback(async () => {
    const loaded = await getAllCompanies()
    setCompanies(loaded)
  }, [])

  return { companies, loading, addCompany, updateCompany, removeCompany, statusCounts, refresh }
}
