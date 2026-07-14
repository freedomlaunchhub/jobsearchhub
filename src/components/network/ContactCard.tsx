import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, MessageSquare } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import type { Contact, ConnectionStatus } from '../../db/schema';
import StatusBadge from '../common/StatusBadge';

interface ContactCardProps {
  contact: Contact;
  onUpdate: (partial: Partial<Contact>) => void;
  onGenerateMessage: () => void;
}

const CONNECTION_STATUSES: ConnectionStatus[] = [
  'identified',
  'message_sent',
  'connected',
  'in_conversation',
];

function getFollowUpUrgency(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null;
  const days = differenceInCalendarDays(new Date(dateStr), new Date());
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, className: 'text-red-600' };
  if (days === 0) return { label: 'Due today', className: 'text-amber-600' };
  return { label: `In ${days}d`, className: 'text-green-600' };
}

export default function ContactCard({ contact, onUpdate, onGenerateMessage }: ContactCardProps) {
  const [expanded, setExpanded] = useState(false);

  const urgency = getFollowUpUrgency(contact.nextFollowupDate);

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{contact.name}</p>
          <p className="text-sm text-muted truncate">{contact.title}</p>
        </div>
        <StatusBadge status={contact.connectionStatus} variant="contact" />
      </div>

      {/* LinkedIn link */}
      {contact.linkedinUrl && (
        <a
          href={contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
        >
          LinkedIn <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Follow-up & status row */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <div className="flex items-center gap-3">
          {urgency && (
            <span className={`text-xs font-medium ${urgency.className}`}>
              {urgency.label}
            </span>
          )}
          <input
            type="date"
            value={contact.nextFollowupDate ?? ''}
            onChange={(e) => onUpdate({ nextFollowupDate: e.target.value || null })}
            className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
            title="Next follow-up date"
          />
        </div>
        <select
          value={contact.connectionStatus}
          onChange={(e) => onUpdate({ connectionStatus: e.target.value as ConnectionStatus })}
          className="rounded border border-slate-300 px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {CONNECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Expandable section */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-3 text-xs text-slate-500 hover:text-slate-700"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? 'Less' : 'More'}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Rapport Notes</label>
            <textarea
              defaultValue={contact.rapportNotes}
              onBlur={(e) => {
                if (e.target.value !== contact.rapportNotes) {
                  onUpdate({ rapportNotes: e.target.value });
                }
              }}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="What do you have in common?"
            />
          </div>

          {contact.messageDrafts.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Message Drafts</label>
              <ul className="space-y-1">
                {contact.messageDrafts.map((draft, i) => (
                  <li key={i} className="text-xs text-slate-600 bg-white rounded p-2 border border-slate-200 whitespace-pre-wrap">
                    {draft}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              defaultValue={contact.notes}
              onBlur={(e) => {
                if (e.target.value !== contact.notes) {
                  onUpdate({ notes: e.target.value });
                }
              }}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              placeholder="Additional notes..."
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200">
        <button
          type="button"
          onClick={onGenerateMessage}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Draft Message
        </button>
      </div>
    </div>
  );
}
