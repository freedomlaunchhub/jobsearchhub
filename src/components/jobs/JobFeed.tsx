import { useState, useMemo } from 'react';
import { Search, Loader2, SlidersHorizontal } from 'lucide-react';
import type { Job, JobStatus } from '../../db/schema';
import JobCard from './JobCard';

interface JobFeedProps {
  jobs: Job[];
  onStatusChange: (id: string, status: JobStatus) => void;
  onSearch: () => void;
  loading: boolean;
}

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'pass', label: 'Pass' },
];

type SortOption = 'newest' | 'company';

export default function JobFeed({
  jobs,
  onStatusChange,
  onSearch,
  loading,
}: JobFeedProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<JobStatus[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sources = useMemo(() => {
    const unique = new Set(jobs.map((j) => j.source));
    return Array.from(unique).sort();
  }, [jobs]);

  const toggleStatus = (status: JobStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  const filteredJobs = useMemo(() => {
    let result = jobs;

    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(lower) ||
          j.company.toLowerCase().includes(lower) ||
          j.location.toLowerCase().includes(lower)
      );
    }

    if (selectedStatuses.length > 0) {
      result = result.filter((j) => selectedStatuses.includes(j.status));
    }

    if (selectedSources.length > 0) {
      result = result.filter((j) => selectedSources.includes(j.source));
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
        );
      }
      return a.company.localeCompare(b.company);
    });

    return result;
  }, [jobs, searchText, selectedStatuses, selectedSources, sortBy]);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={onSearch}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? 'Searching...' : 'Search for New Jobs'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <div className="flex items-center gap-2 mb-3">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filters</span>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* Text search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search title, company, location..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleStatus(opt.value)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  selectedStatuses.includes(opt.value)
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Source filter */}
          {sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    selectedSources.includes(source)
                      ? 'bg-accent text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
          )}

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="newest">Newest first</option>
            <option value="company">Company A-Z</option>
          </select>
        </div>
      </div>

      {/* Job list */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">
            No jobs found. Click &quot;Search for New Jobs&quot; to search.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={onStatusChange}
              expanded={expandedId === job.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === job.id ? null : job.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
