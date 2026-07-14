import { ExternalLink, MapPin } from 'lucide-react';
import type { Contact, ConnectionStatus } from '../../db/schema';
import StatusBadge from '../common/StatusBadge';

interface ContactCardProps {
  contact: Contact;
  onUpdate: (partial: Partial<Contact>) => void;
}

const CONNECTION_STATUSES: ConnectionStatus[] = [
  'identified',
  'message_sent',
  'connected',
  'in_conversation',
];

export default function ContactCard({ contact, onUpdate }: ContactCardProps) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      {/* Name, title, status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800 truncate">{contact.name}</p>
          <p className="text-sm text-muted truncate">{contact.title}</p>
          <p className="text-xs text-muted truncate">
            {contact.companyName}
            {contact.location && (
              <span className="inline-flex items-center gap-0.5 ml-2">
                <MapPin className="w-3 h-3" />
                {contact.location}
              </span>
            )}
          </p>
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
          LinkedIn profile <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Networking status */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-500 mb-1">Networking status</label>
        <select
          value={contact.connectionStatus}
          onChange={(e) => onUpdate({ connectionStatus: e.target.value as ConnectionStatus })}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {CONNECTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          defaultValue={contact.notes}
          onBlur={(e) => {
            if (e.target.value !== contact.notes) {
              onUpdate({ notes: e.target.value });
            }
          }}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          placeholder="How you met, what you have in common, next steps..."
        />
      </div>
    </div>
  );
}
