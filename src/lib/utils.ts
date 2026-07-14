import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  const daysDiff = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (daysDiff < 14) return formatDistanceToNow(date, { addSuffix: true })
  return format(date, 'MMM d, yyyy')
}

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy')
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function capitalize(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-400',
  saved: 'bg-indigo-400',
  applied: 'bg-teal-500',
  interview: 'bg-teal-600',
  offer: 'bg-green-500',
  pass: 'bg-slate-300',
}

export const COMPANY_STATUS_COLORS: Record<string, string> = {
  open_listing: 'bg-slate-400',
  new: 'bg-blue-400',
  researched: 'bg-indigo-400',
  networking: 'bg-teal-500',
  applied: 'bg-teal-600',
  interviewing: 'bg-amber-500',
}

export const CONTACT_STATUS_COLORS: Record<string, string> = {
  identified: 'bg-slate-400',
  message_sent: 'bg-teal-500',
  connected: 'bg-teal-600',
  in_conversation: 'bg-amber-500',
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-urgent',
  medium: 'text-attention',
  low: 'text-primary',
}

// LinkedIn's job_summary field arrives as one flattened paragraph; the
// job_description_formatted field keeps structure as HTML. Convert the HTML
// to plain text with line breaks and bullets so descriptions stay readable
// (JobCard renders with whitespace-pre-line).
export function jobDescriptionText(raw: Record<string, unknown>): string {
  const html = raw.job_description_formatted
  if (typeof html === 'string' && html.trim()) {
    return html
      .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)[^>]*>/gi, '\n')
      .replace(/<\s*li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&(#39|apos);/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  return (raw.job_summary as string) || ''
}
