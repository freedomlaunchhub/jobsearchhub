import { useState, useRef } from 'react';
import { Plus, Search, ArrowUpDown, Upload } from 'lucide-react';
import type { Company, CompanyPriority } from '../../db/schema';
import StatusBadge from '../common/StatusBadge';

interface CompanyListProps {
  companies: Company[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (company: Partial<Company>) => void;
  onImport: (csvText: string) => void;
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

export default function CompanyList({ companies, selectedId, onSelect, onAdd, onImport }: CompanyListProps) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'alpha'>('priority');
  const [formName, setFormName] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formPriority, setFormPriority] = useState<CompanyPriority>('medium');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Reset so the same file can be re-imported
    e.target.value = '';
  }

  const filtered = companies
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      }
      return a.name.localeCompare(b.name);
    });

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

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">Companies</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Import CSV
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
              Add Company
            </button>
          </div>
        </div>

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
          <button
            type="button"
            onClick={() => setSortBy(sortBy === 'priority' ? 'alpha' : 'priority')}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            title={sortBy === 'priority' ? 'Sort alphabetically' : 'Sort by priority'}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === 'priority' ? 'Priority' : 'A-Z'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">No companies found</p>
        ) : (
          <ul>
            {filtered.map((company) => {
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
      </div>
    </div>
  );
}
