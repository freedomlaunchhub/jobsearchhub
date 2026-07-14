import { useState } from 'react'
import { Download, Upload, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import TagInput from '@/components/common/TagInput'
import { getDB } from '@/db/connection'

export default function Settings() {
  const { settings, loading, updateSettings } = useSettings()
  const [showBrightDataKey, setShowBrightDataKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [confirmClear, setConfirmClear] = useState<string | null>(null)

  if (loading || !settings) {
    return <div className="text-muted">Loading settings...</div>
  }

  const handleSourceToggle = (sourceId: string) => {
    const updated = settings.jobSources.map((s) =>
      s.id === sourceId ? { ...s, enabled: !s.enabled } : s
    )
    updateSettings({ jobSources: updated })
  }

  const handleExport = async () => {
    const db = await getDB()
    const data = {
      settings: await db.get('settings', 'config'),
      jobs: await db.getAll('jobs'),
      companies: await db.getAll('companies'),
      contacts: await db.getAll('contacts'),
      dailyLogs: await db.getAll('dailyLogs'),
    }
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
      const db = await getDB()
      const tx = db.transaction(
        ['settings', 'jobs', 'companies', 'contacts', 'dailyLogs'],
        'readwrite'
      )
      if (data.settings) await tx.objectStore('settings').put(data.settings)
      for (const job of data.jobs || []) await tx.objectStore('jobs').put(job)
      for (const company of data.companies || []) await tx.objectStore('companies').put(company)
      for (const contact of data.contacts || []) await tx.objectStore('contacts').put(contact)
      for (const log of data.dailyLogs || []) await tx.objectStore('dailyLogs').put(log)
      await tx.done
      window.location.reload()
    }
    input.click()
  }

  const handleClear = async (store: string) => {
    if (confirmClear !== store) {
      setConfirmClear(store)
      return
    }
    const db = await getDB()
    if (store === 'all') {
      await db.clear('jobs')
      await db.clear('companies')
      await db.clear('contacts')
      await db.clear('dailyLogs')
    } else {
      await db.clear(store)
    }
    setConfirmClear(null)
    window.location.reload()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

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

      <Section title="API Configuration">
        <Field label="Bright Data API Key">
          <div className="relative">
            <input
              type={showBrightDataKey ? 'text' : 'password'}
              value={settings.brightDataApiKey}
              onChange={(e) => updateSettings({ brightDataApiKey: e.target.value })}
              placeholder="Enter your Bright Data API key"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={() => setShowBrightDataKey(!showBrightDataKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-slate-700"
            >
              {showBrightDataKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <Field label="Anthropic API Key">
          <div className="relative">
            <input
              type={showAnthropicKey ? 'text' : 'password'}
              value={settings.anthropicApiKey}
              onChange={(e) => updateSettings({ anthropicApiKey: e.target.value })}
              placeholder="Enter your Anthropic API key"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <button
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-slate-700"
            >
              {showAnthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <p className="text-xs text-muted mb-4">
          API keys are stored locally in your browser. They are only sent to their respective
          services through the backend proxy.
        </p>

        <button
          onClick={() => window.dispatchEvent(new Event('run-daily-briefing'))}
          disabled={!settings.brightDataApiKey || !settings.anthropicApiKey}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} /> Run Daily Briefing Now
        </button>
        {(!settings.brightDataApiKey || !settings.anthropicApiKey) && (
          <p className="text-xs text-urgent mt-1">Enter both API keys above to enable the daily briefing.</p>
        )}
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
