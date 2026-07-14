import { useState, useRef, useMemo } from 'react';
import { Plus, Search, Upload, Compass } from 'lucide-react';
import type { Company, CompanyPriority, CompanyStatus } from '../../db/schema';
import { LINKEDIN_INDUSTRIES, COMPANY_SIZES } from '../../db/schema';
import type { DiscoverCompaniesResult } from '../../lib/api';
import StatusBadge from '../common/StatusBadge';

interface DiscoverOverrides {
  industries?: string[];
  companySizes?: string[];
  preview?: boolean;
  searchAfter?: unknown[];
}

interface CompanyListProps {
  companies: Company[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (company: Partial<Company>) => void;
  onImport: (csvText: string) => void;
  onDiscover: (overrides?: DiscoverOverrides) => Promise<DiscoverCompaniesResult>;
  canDiscover: boolean;
}

const PRIORITY_DOT_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-400',
};

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_LABELS: Record<CompanyStatus, string> = {
  open_listing: 'Open listing',
  new: 'New',
  queued: 'Queued for research',
  researched: 'Researched',
  networking: 'Networking',
  applied: 'Applied',
  interviewing: 'Interviewing',
  not_interested: 'Not interested',
};

// Largest-first ordering for the size sort; matches dataset bucket strings
// like "1,001-5,000 employees"
const SIZE_ORDER = ['10,001+', '5,001-10,000', '1,001-5,000', '501-1,000', '201-500', '51-200', '11-50', '2-10'];

function sizeRank(size: string): number {
  if (!size) return SIZE_ORDER.length;
  const idx = SIZE_ORDER.findIndex((bucket) => size.startsWith(bucket));
  return idx === -1 ? SIZE_ORDER.length : idx;
}

type SortOption = 'priority' | 'alpha' | 'size' | 'newest';

const PAGE_RENDER_LIMIT = 250;

export default function CompanyList({
  companies, selectedId, onSelect, onAdd, onImport, onDiscover, canDiscover,
}: CompanyListProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  const [statusFilter, setStatusFilter] = useState<'all' | CompanyStatus>('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [formName, setFormName] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formPriority, setFormPriority] = useState<CompanyPriority>('medium');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<string | null>(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discIndustry, setDiscIndustry] = useState('');
  const [discSize, setDiscSize] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  function discoverOverrides(): DiscoverOverrides {
    return {
      // '' = fall back to Settings; '__any' = no filter at all
      industries: discIndustry === '' ? undefined : discIndustry === '__any' ? [] : [discIndustry],
      companySizes: discSize === '' ? undefined : discSize === '__any' ? [] : [discSize],
    };
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewCount(null);
    try {
      const result = await onDiscover({ ...discoverOverrides(), preview: true });
      setPreviewCount(result.totalMatching ?? 0);
    } catch {
      setDiscoverResult('Preview failed — try again');
      setTimeout(() => setDiscoverResult(null), 6000);
    } finally {
      setPreviewing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onImport(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const industries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of companies) {
      if (c.industry) counts.set(c.industry, (counts.get(c.industry) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [companies]);

  const sizes = useMemo(() => {
    const present = new Set(companies.map((c) => c.size).filter(Boolean));
    return SIZE_ORDER.filter((bucket) => [...present].some((s) => String(s).startsWith(bucket)));
  }, [companies]);

  const filtered = useMemo(() => companies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    // 'Not interested' companies are hidden unless explicitly filtered for —
    // they stay in the database so Discover never re-imports them
    .filter((c) => statusFilter === 'all' ? c.status !== 'not_interested' : c.status === statusFilter)
    .filter((c) => industryFilter === 'all' || c.industry === industryFilter)
    .filter((c) => sizeFilter === 'all' || String(c.size).startsWith(sizeFilter))
    .sort((a, b) => {
      switch (sortBy) {
        case 'priority': {
          const diff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case 'size': {
          const diff = sizeRank(String(a.size)) - sizeRank(String(b.size));
          return diff !== 0 ? diff : a.name.localeCompare(b.name);
        }
        case 'newest':
          return (b.createdAt || '').localeCompare(a.createdAt || '');
        default:
          return a.name.localeCompare(b.name);
      }
    }), [companies, search, statusFilter, industryFilter, sizeFilter, sortBy]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE_RENDER_LIMIT);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;
    onAdd({
      name: formName.trim(),
      industry: formIndustry.trim(),
      priority: formPriority,
    });
    setFormName('');
    setFormIndustry('');
    setFormPriority('medium');
    setShowForm(false);
  }

  async function handleDiscover() {
    setDiscovering(true);
    setDiscoverResult(null);
    // The server returns up to ~100 companies per call with a cursor; keep
    // calling until the pool is exhausted so the pull covers everything the
    // criteria match, with live progress along the way.
    let saved = 0;
    let existed = 0;
    let seen = 0;
    let totalMatching: number | null = null;
    let cursor: unknown[] | undefined;
    try {
      do {
        const result = await onDiscover({ ...discoverOverrides(), searchAfter: cursor });
        saved += result.savedCount;
        existed += result.alreadyExisted;
        seen += result.total;
        totalMatching = result.totalMatching ?? totalMatching;
        cursor = result.nextCursor ?? undefined;
        setDiscoverResult(
          `Pulling companies... ${seen}${totalMatching ? ` of ${totalMatching.toLocaleString()}` : ''} (${saved} new)`
        );
      } while (cursor);

      if (saved > 0) {
        setDiscoverResult(
          `Added ${saved} new companies${existed > 0 ? ` (${existed} were already in your list)` : ''}`
        );
      } else if (seen > 0) {
        setDiscoverResult(`Found ${seen} companies (all already in your list)`);
      } else {
        setDiscoverResult('No companies found — try different criteria');
      }
      setShowDiscover(false);
      setPreviewCount(null);
      setTimeout(() => setDiscoverResult(null), 8000);
    } catch {
      setDiscoverResult(
        saved > 0
          ? `Pull interrupted after ${saved} new companies — click Pull again to continue`
          : 'Discovery failed — check your criteria and try again'
      );
      setTimeout(() => setDiscoverResult(null), 10000);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Companies</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowDiscover(!showDiscover); setPreviewCount(null); }}
              disabled={discovering || !canDiscover}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              title={canDiscover ? 'Pull companies matching criteria you choose' : 'Set discovery criteria in Settings first'}
            >
              <Compass className="w-3.5 h-3.5" />
              {discovering ? 'Pulling...' : 'Discover'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Upload className="w-3.5 h-3.5" />
              CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>

        {discoverResult && (
          <p className="mb-3 text-xs text-indigo-700 bg-indigo-50 rounded-lg px-3 py-2">{discoverResult}</p>
        )}

        {/* Discover panel: choose criteria per pull, preview count before pulling */}
        {showDiscover && (
          <div className="mb-3 p-3 bg-indigo-50/60 rounded-lg space-y-2">
            <select
              value={discIndustry}
              onChange={(e) => { setDiscIndustry(e.target.value); setPreviewCount(null); }}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All my preferred industries</option>
              <option value="__any">Any industry</option>
              {LINKEDIN_INDUSTRIES.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            <select
              value={discSize}
              onChange={(e) => { setDiscSize(e.target.value); setPreviewCount(null); }}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">All my preferred sizes</option>
              <option value="__any">Any size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size.value} value={size.value}>{size.label} employees</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewing || discovering}
                className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
              >
                {previewing ? 'Checking...' : 'Preview count'}
              </button>
              {previewCount !== null && (
                <span className="text-xs text-slate-600">
                  {previewCount === 0 ? 'No matches' : `${previewCount.toLocaleString()} companies match`}
                </span>
              )}
              {previewCount !== null && previewCount > 0 && (
                <button
                  type="button"
                  onClick={handleDiscover}
                  disabled={discovering}
                  className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                >
                  {discovering ? 'Pulling...' : `Pull all ${previewCount.toLocaleString()}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-3 p-3 bg-slate-50 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="Company name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="text"
              placeholder="Industry"
              value={formIndustry}
              onChange={(e) => setFormIndustry(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex items-center gap-2">
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as CompanyPriority)}
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {/* Search + sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Sort companies"
          >
            <option value="priority">Priority</option>
            <option value="alpha">A-Z</option>
            <option value="size">Largest first</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | CompanyStatus)}
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Filter by status"
          >
            <option value="all">All statuses</option>
            {(Object.entries(STATUS_LABELS) as [CompanyStatus, string][]).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Filter by industry"
          >
            <option value="all">All industries</option>
            {industries.map(([industry, count]) => (
              <option key={industry} value={industry}>{industry} ({count})</option>
            ))}
          </select>
          <select
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/50"
            title="Filter by company size"
          >
            <option value="all">All sizes</option>
            {sizes.map((bucket) => (
              <option key={bucket} value={bucket}>{bucket}</option>
            ))}
          </select>
        </div>

        <p className="mt-2 text-xs text-muted">
          {filtered.length === companies.length
            ? `${companies.length} companies`
            : `${filtered.length} of ${companies.length} companies`}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">No companies found</p>
        ) : (
          <ul>
            {visible.map((company) => {
              const isSelected = company.id === selectedId;
              return (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(company.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT_COLORS[company.priority] ?? 'bg-slate-400'}`}
                          title={`${company.priority} priority`}
                        />
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {company.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {company.contactCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-full">
                            {company.contactCount}
                          </span>
                        )}
                        <StatusBadge status={company.status} variant="company" />
                      </div>
                    </div>
                    {company.industry && (
                      <span className="inline-block mt-1 text-xs text-muted bg-slate-100 rounded px-1.5 py-0.5">
                        {company.industry}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!showAll && filtered.length > PAGE_RENDER_LIMIT && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full py-3 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border-t border-slate-100"
          >
            Show all {filtered.length} companies
          </button>
        )}
      </div>
    </div>
  );
}
