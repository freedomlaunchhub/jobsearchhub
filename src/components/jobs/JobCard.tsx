import { useState } from 'react';
import {
  Bookmark,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Wifi,
  Globe,
  Calendar,
  DollarSign,
} from 'lucide-react';
import type { Job, JobStatus } from '../../db/schema';
import { formatRelativeDate, classNames } from '../../lib/utils';
import StatusBadge from '../common/StatusBadge';

interface JobCardProps {
  job: Job;
  onStatusChange: (id: string, status: JobStatus) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const ALL_STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'pass', label: 'Pass' },
];

export default function JobCard({
  job,
  onStatusChange,
  expanded = false,
  onToggleExpand,
}: JobCardProps) {
  const [notes, setNotes] = useState(job.notes);

  const handleApply = () => {
    window.open(job.sourceUrl, '_blank', 'noopener,noreferrer');
    onStatusChange(job.id, 'applied');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      {/* Header */}
      <div
        className={classNames(
          'cursor-pointer',
          onToggleExpand && 'select-none'
        )}
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">
              {job.title}
            </h3>
            <p className="text-muted text-sm">{job.company}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={job.status} variant="job" />
            {onToggleExpand &&
              (expanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ))}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {job.location}
          </span>
          {job.remote && (
            <span className="inline-flex items-center gap-1 text-teal-600 bg-teal-50 rounded px-1.5 py-0.5 text-xs font-medium">
              <Wifi className="w-3 h-3" />
              Remote
            </span>
          )}
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            {job.source}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatRelativeDate(job.postedDate)}
          </span>
        </div>

        {/* Salary */}
        {job.salaryRange && (
          <div className="flex items-center gap-1 mt-2 text-sm">
            <DollarSign className="w-3.5 h-3.5 text-green-600" />
            <span className="font-mono text-sm text-slate-700">
              {job.salaryRange}
            </span>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        {(job.status === 'new' || job.status === 'saved') && (
          <>
            {job.status === 'new' && (
              <button
                onClick={() => onStatusChange(job.id, 'saved')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Save
              </button>
            )}
            <button
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Apply
            </button>
            <button
              onClick={() => onStatusChange(job.id, 'pass')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
              Pass
            </button>
          </>
        )}
        {job.status !== 'new' && job.status !== 'saved' && (
          <select
            value={job.status}
            onChange={(e) =>
              onStatusChange(job.id, e.target.value as JobStatus)
            }
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {ALL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-1">
              Description
            </h4>
            <p className="text-sm text-slate-600 whitespace-pre-line">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          {job.requirements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-1">
                Requirements
              </h4>
              <ul className="list-disc list-inside space-y-1">
                {job.requirements.map((req, i) => (
                  <li key={i} className="text-sm text-slate-600">
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-1">Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
              placeholder="Add notes about this job..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
