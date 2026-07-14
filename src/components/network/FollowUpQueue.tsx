import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, Clock } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import type { Contact } from '../../db/schema';
import { formatRelativeDate } from '../../lib/utils';

interface FollowUpQueueProps {
  contacts: Contact[];
  onMarkDone: (contactId: string) => void;
  onSnooze: (contactId: string, days: number) => void;
}

export default function FollowUpQueue({ contacts, onMarkDone, onSnooze }: FollowUpQueueProps) {
  const [collapsed, setCollapsed] = useState(false);

  const today = new Date();
  const dueContacts = contacts
    .filter((c) => c.nextFollowupDate && new Date(c.nextFollowupDate) <= today)
    .sort((a, b) => new Date(a.nextFollowupDate!).getTime() - new Date(b.nextFollowupDate!).getTime());

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <button
        type="button"
        className="flex items-center justify-between w-full p-4 text-left"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Follow-ups Due</h3>
          {dueContacts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {dueContacts.length}
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
          {dueContacts.length === 0 ? (
            <p className="text-sm text-muted py-2">No follow-ups due</p>
          ) : (
            <ul className="space-y-2">
              {dueContacts.map((contact) => {
                const daysOverdue = differenceInCalendarDays(
                  today,
                  new Date(contact.nextFollowupDate!)
                );
                return (
                  <li
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted truncate">{contact.companyName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-medium text-red-600">
                          {daysOverdue === 0 ? 'Due today' : `${daysOverdue}d overdue`}
                        </span>
                        {contact.lastContactDate && (
                          <span className="text-xs text-slate-400">
                            Last: {formatRelativeDate(contact.lastContactDate)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onMarkDone(contact.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        title="Mark done"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => onSnooze(contact.id, 3)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                        title="Snooze 3 days"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        +3d
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
