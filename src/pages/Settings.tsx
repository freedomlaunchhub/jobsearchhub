import { useState } from 'react'
import { Download, Upload, Trash2, LogOut, Compass } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import TagInput from '@/components/common/TagInput'
import { discoverCompanies } from '@/lib/api'
import { getAllJobs, saveJobs } from '@/db/jobs'
import { getAllCompanies, saveCompany } from '@/db/companies'
import { getAllContacts, saveContact } from '@/db/contacts'
import { getSettings, saveSettings } from '@/db/settings'

export default function Settings() {
  const { settings, loading, updateSettings } = useSettings()
  const [confirmClear, setConfirmClear] = useState<string | null>(null)
  const [discovering, setDiscovering] = useState(false)
  const [discoverResult, setDiscoverResult] = useState<string | null>(null)
  const [discoverError, setDiscoverError] = useState(false)

  if (loading || !settings) {
    return <div className="text-muted">Loading settings...</div>
  }

  const handleSourceToggle = (sourceId: string) => {
    const updated = settings.jobSources.map((s) =>
      s.id === sourceId ? { ...s, enabled: !s.enabled } : s
    )
    updateSettings({ jobSources: updated })
  }

  const handleDiscover = async () => {
    const hasFilters = settings.preferredIndustries.length > 0 ||
      settings.preferredCompanySizes.length > 0 ||
      settings.discoveryLocation
    if (!hasFilters) return

    setDiscovering(true)
    setDiscoverResult(null)
    setDiscoverError(false)
    try {
      const result = await discoverCompanies({
        industry: settings.preferredIndustries[0] || undefined,
        location: settings.discoveryLocation || undefined,
        companySizes: settings.preferredCompanySizes.length > 0 ? settings.preferredCompanySizes : undefined,
      })
      if (result.savedCount > 0) {
        setDiscoverResult(`Added ${result.savedCount} new companies to your list`)
      } else if (result.total > 0) {
        setDiscoverResult(`Found ${result.total} companies (all already in your list)`)
      } else {
        setDiscoverResult('No companies found — try different criteria')
        setDiscoverError(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setDiscoverResult(`Discovery failed: ${msg}`)
      setDiscoverError(true)
    } finally {
      setDiscovering(false)
      setTimeout(() => setDiscoverResult(null), 8000)
    }
  }

  const handleExport = async () => {
    const [exportSettings, jobs, companies, contacts] = await Promise.all([
      getSettings(),
      getAllJobs(),
      getAllCompanies(),
      getAllContacts(),
    ])
    const data = { settings: exportSettings, jobs, companies, contacts }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-search-hub-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      if (data.settings) await saveSettings(data.settings)
      if (data.jobs) await saveJobs(data.jobs)
      if (data.companies) for (const c of data.companies) await saveCompany(c)
      if (data.contacts) for (const c of data.contacts) await saveContact(c)
      window.location.reload()
    }
    input.click()
  }

  const handleClear = async (store: string) => {
    if (confirmClear !== store) {
      setConfirmClear(store)
      return
    }
    const stores = store === 'all' ? ['jobs', 'companies', 'contacts'] : [store]
    for (const s of stores) {
      const res = await fetch(`/api/data/${s}/clear`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const items = s === 'jobs' ? await getAllJobs()
          : s === 'companies' ? await getAllCompanies()
          : await getAllContacts()
        for (const item of items) {
          await fetch(`/api/data/${s}?id=${(item as { id: string }).id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        }
      }
    }
    setConfirmClear(null)
    window.location.reload()
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.reload()
  }

  const canDiscover = settings.preferredIndustries.length > 0 ||
    settings.preferredCompanySizes.length > 0 ||
    settings.discoveryLocation

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      <Section title="Job Search Configuration">
        <Field label="Job Titles">
          <TagInput
            tags={settings.jobTitles}
            onChange={(jobTitles) => updateSettings({ jobTitles })}
            placeholder="Add a job title..."
          />
        </Field>

        <Field label="Location">
          <input
            type="text"
            value={settings.location}
            onChange={(e) => updateSettings({ location: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-muted mt-1">Used for job search results</p>
        </Field>

        <div className="flex items-center gap-3 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.remoteIncluded}
              onChange={(e) => updateSettings({ remoteIncluded: e.target.checked })}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            Include remote positions
          </label>
        </div>

        <Field label="Job Sources">
          <div className="space-y-2">
            {settings.jobSources.map((source) => (
              <label key={source.id} className="flex items-center gap-3 text-sm">
                <button
                  onClick={() => handleSourceToggle(source.id)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    source.enabled ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      source.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                {source.name}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Daily Application Target">
          <div className="flex items-center gap-3">
            <button
              onClick={() => updateSettings({ dailyTarget: Math.max(1, settings.dailyTarget - 1) })}
              className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100"
            >
              -
            </button>
            <span className="font-mono text-lg font-semibold w-8 text-center">
              {settings.dailyTarget}
            </span>
            <button
              onClick={() => updateSettings({ dailyTarget: settings.dailyTarget + 1 })}
              className="w-8 h-8 rounded-lg border border-slate-300 flex items-center justify-center hover:bg-slate-100"
            >
              +
            </button>
            <span className="text-sm text-muted">applications per day</span>
          </div>
        </Field>

      </Section>

      <Section title="Company Discovery">
        <Field label="Preferred Industries">
          <TagInput
            tags={settings.preferredIndustries}
            onChange={(preferredIndustries) => updateSettings({ preferredIndustries })}
            placeholder="Add an industry (e.g., Technology, Energy, Healthcare)..."
          />
        </Field>

        <Field label="Discovery Location">
          <input
            type="text"
            value={settings.discoveryLocation}
            onChange={(e) => updateSettings({ discoveryLocation: e.target.value })}
            placeholder="e.g., Alberta, Canada or Calgary"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <p className="text-xs text-muted mt-1">Can differ from job search location — use a broader or narrower area</p>
        </Field>

        <Field label="Preferred Company Sizes">
          <div className="space-y-2">
            {['1-50', '51-200', '201-1000', '1001-5000', '5001-10000', '10001+'].map((size) => (
              <label key={size} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settings.preferredCompanySizes.includes(size)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...settings.preferredCompanySizes, size]
                      : settings.preferredCompanySizes.filter((s) => s !== size)
                    updateSettings({ preferredCompanySizes: updated })
                  }}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                {size} employees
              </label>
            ))}
          </div>
        </Field>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-muted mb-3">
            Searches LinkedIn for companies matching your industry, location, and size preferences.
            New companies are added to your Network HQ list with "New" status.
          </p>
          <button
            onClick={handleDiscover}
            disabled={discovering || !canDiscover}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Compass size={16} />
            {discovering ? 'Discovering...' : 'Discover Companies Now'}
          </button>
          {discoverResult && (
            <p className={`mt-2 text-sm px-3 py-2 rounded-md ${
              discoverError ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {discoverResult}
            </p>
          )}
        </div>
      </Section>

      <Section title="Data Management">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            <Download size={16} /> Export Data
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            <Upload size={16} /> Import Data
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          {(['jobs', 'companies', 'contacts', 'all'] as const).map((store) => (
            <button
              key={store}
              onClick={() => handleClear(store)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg ${
                confirmClear === store
                  ? 'bg-urgent text-white'
                  : 'border border-urgent text-urgent hover:bg-red-50'
              }`}
            >
              <Trash2 size={16} />
              {confirmClear === store ? `Confirm Clear ${capitalize(store)}?` : `Clear ${capitalize(store)}`}
            </button>
          ))}
        </div>
        {confirmClear && (
          <button
            onClick={() => setConfirmClear(null)}
            className="text-sm text-muted underline mt-2"
          >
            Cancel
          </button>
        )}
      </Section>

      <Section title="About">
        <p className="text-sm text-muted">Job Search Hub v1.0.0</p>
      </Section>
    </div>
  )
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
        {title}
      </h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
