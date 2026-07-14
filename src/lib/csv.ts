import type { Company, CompanyPriority, CompanyStatus } from '@/db/schema'

/**
 * Parse a CSV string into an array of string arrays.
 * Handles quoted fields containing commas and escaped quotes.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let current = ''
  let inQuotes = false
  let row: string[] = []

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(current.trim())
      current = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
        i++
      }
      row.push(current.trim())
      current = ''
      if (row.some((cell) => cell !== '')) {
        rows.push(row)
      }
      row = []
    } else {
      current += ch
    }
  }

  // Last row
  row.push(current.trim())
  if (row.some((cell) => cell !== '')) {
    rows.push(row)
  }

  return rows
}

const VALID_PRIORITIES = new Set<string>(['high', 'medium', 'low'])
const VALID_STATUSES = new Set<string>(['researching', 'networking', 'applied', 'interviewing'])

/**
 * Parse a CSV string into an array of partial Company objects.
 * Expects a header row with columns: name, industry, priority, website, linkedinUrl, whyDream, notes
 * Only "name" is required; other columns are optional.
 */
export function parseCompaniesCSV(text: string): Partial<Company>[] {
  const rows = parseCSV(text)
  if (rows.length < 2) return []

  const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, ''))
  const dataRows = rows.slice(1)

  const col = (name: string): number => headers.indexOf(name)

  const nameIdx = col('name')
  if (nameIdx === -1) return []

  const industryIdx = col('industry')
  const priorityIdx = col('priority')
  const statusIdx = col('status')
  const websiteIdx = col('website')
  const linkedinIdx = col('linkedinurl')
  const whyIdx = col('whydream')
  const notesIdx = col('notes')

  const results: Partial<Company>[] = []

  for (const row of dataRows) {
    const name = row[nameIdx]?.trim()
    if (!name) continue

    const partial: Partial<Company> = { name }

    if (industryIdx !== -1 && row[industryIdx]) partial.industry = row[industryIdx]
    if (websiteIdx !== -1 && row[websiteIdx]) partial.website = row[websiteIdx]
    if (linkedinIdx !== -1 && row[linkedinIdx]) partial.linkedinUrl = row[linkedinIdx]
    if (whyIdx !== -1 && row[whyIdx]) partial.whyDream = row[whyIdx]
    if (notesIdx !== -1 && row[notesIdx]) partial.notes = row[notesIdx]

    if (priorityIdx !== -1 && row[priorityIdx]) {
      const p = row[priorityIdx].toLowerCase()
      if (VALID_PRIORITIES.has(p)) partial.priority = p as CompanyPriority
    }

    if (statusIdx !== -1 && row[statusIdx]) {
      const s = row[statusIdx].toLowerCase()
      if (VALID_STATUSES.has(s)) partial.status = s as CompanyStatus
    }

    results.push(partial)
  }

  return results
}
