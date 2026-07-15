import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, ExternalLink } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import type { Contact } from '../../db/schema';

interface FollowUpQueueProps {
  contacts: Contact[];
  onMarkDone: (contactId: string) => void;
}

// Status-based reminders: contacts you've messaged or connected with whose
// status hasn't moved in a week. "Followed up" resets the timer; changing
// their status (e.g. to In Conversation) clears them out naturally.
export default function FollowUpQueue({ contacts, onMarkDone }: FollowUpQueueProps) {
  const [collapsed, setCollapsed] = useState(false);

  const today = new Date();

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <button
        type="button"
        className="flex items-center justify-between w-full p-4 text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Follow-ups Due</h3>
          {contacts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {contacts.length}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted py-2">
              No follow-ups due — contacts appear here a week after you mark them
              "message sent" or "connected" with no further movement
            </p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => {
                const days = differenceInCalendarDays(today, new Date(contact.lastContactDate!));
                const nudge = contact.connectionStatus === 'message_sent'
                  ? `No reply in ${days}d — follow up or move on`
                  : `Connected ${days}d ago — start a conversation`;
                return (
                  <li
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted truncate">{contact.title} · {contact.companyName}</p>
                      <span className="text-xs font-medium text-red-600">{nudge}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-primary hover:bg-slate-100"
                          title="Open LinkedIn profile"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          LinkedIn
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => onMarkDone(contact.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        title="I followed up — restart the 7-day timer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Followed up
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
