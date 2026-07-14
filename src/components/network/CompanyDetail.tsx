import { useState } from 'react';
import { ExternalLink, Plus, Trash2, Search, Users } from 'lucide-react';
import type { Company, Contact, CompanyStatus, CompanyPriority } from '../../db/schema';
import ContactCard from './ContactCard';

interface ResearchAndFindResult {
  researchResult: string | null;
  findResult: { savedCount: number; total: number } | null;
}

interface CompanyDetailProps {
  company: Company;
  contacts: Contact[];
  onUpdateCompany: (partial: Partial<Company>) => void;
  onAddContact: (contact: Partial<Contact>) => void;
  onUpdateContact: (id: string, partial: Partial<Contact>) => void;
  onDeleteCompany: () => void;
  onResearchAndFind: () => Promise<ResearchAndFindResult | undefined>;
  onGenerateMessage: (contactId: string) => void;
}

const COMPANY_STATUSES: CompanyStatus[] = ['open_listing', 'researching', 'networking', 'applied', 'interviewing'];
const PRIORITIES: CompanyPriority[] = ['high', 'medium', 'low'];

export default function CompanyDetail({
  company,
  contacts,
  onUpdateCompany,
  onAddContact,
  onUpdateContact,
  onDeleteCompany,
  onResearchAndFind,
  onGenerateMessage,
}: CompanyDetailProps) {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactLinkedin, setContactLinkedin] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [researching, setResearching] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState(false);

  function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim()) return;
    onAddContact({
      name: contactName.trim(),
      title: contactTitle.trim(),
      linkedinUrl: contactLinkedin.trim(),
      companyId: company.id,
      companyName: company.name,
    });
    setContactName('');
    setContactTitle('');
    setContactLinkedin('');
    setShowContactForm(false);
  }

  async function handleResearchAndFind() {
    setResearching(true);
    setResultMessage(null);
    setResultError(false);
    try {
      const result = await onResearchAndFind();
      if (result) {
        const parts: string[] = [];
        if (result.researchResult === 'done') parts.push('Company info updated');
        if (result.researchResult === 'failed') parts.push('Company not found in database');
        if (result.findResult) {
          if (result.findResult.savedCount > 0) {
            parts.push(`${result.findResult.savedCount} new contact${result.findResult.savedCount === 1 ? '' : 's'} saved`);
          } else if (result.findResult.total > 0) {
            parts.push(`${result.findResult.total} people found (all already saved)`);
          } else {
            parts.push('No contacts found at this company');
          }
        } else if (!result.findResult) {
          parts.push('Contact search unavailable');
        }
        const hasFailure = result.researchResult === 'failed' && (!result.findResult || result.findResult.total === 0);
        setResultError(hasFailure);
        setResultMessage(parts.join(' · ') || 'Done');
      }
    } catch {
      setResultError(true);
      setResultMessage('Research failed — check your connection and try again');
    } finally {
      setResearching(false);
      setTimeout(() => setResultMessage(null), 8000);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 overflow-y-auto">
      {/* Company header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-800">{company.name}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Website <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {company.careersUrl && (
            <a
              href={company.careersUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Careers <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {company.linkedinUrl && (
            <a
              href={company.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              LinkedIn <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Status & Priority dropdowns */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select
            value={company.status}
            onChange={(e) => onUpdateCompany({ status: e.target.value as CompanyStatus })}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {COMPANY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
          <select
            value={company.priority}
            onChange={(e) => onUpdateCompany({ priority: e.target.value as CompanyPriority })}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Why Dream */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-500 mb-1">Why Dream Company?</label>
        <textarea
          defaultValue={company.whyDream}
          onBlur={(e) => {
            if (e.target.value !== company.whyDream) {
              onUpdateCompany({ whyDream: e.target.value });
            }
          }}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          placeholder="What makes this a dream company for you?"
        />
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
        <textarea
          defaultValue={company.notes}
          onBlur={(e) => {
            if (e.target.value !== company.notes) {
              onUpdateCompany({ notes: e.target.value });
            }
          }}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          placeholder="General notes..."
        />
      </div>

      {/* Contacts section */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">
            Contacts ({contacts.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowContactForm(!showContactForm)}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Contact
          </button>
        </div>

        {/* Add contact form */}
        {showContactForm && (
          <form onSubmit={handleAddContact} className="mb-4 p-3 bg-slate-50 rounded-lg space-y-2">
            <input
              type="text"
              placeholder="Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <input
              type="text"
              placeholder="Title"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="LinkedIn URL"
                value={contactLinkedin}
                onChange={(e) => setContactLinkedin(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
              >
                Add
              </button>
            </div>
          </form>
        )}

        {/* Contact cards */}
        <div className="space-y-3">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onUpdate={(partial) => onUpdateContact(contact.id, partial)}
              onGenerateMessage={() => onGenerateMessage(contact.id)}
            />
          ))}
          {contacts.length === 0 && (
            <p className="text-sm text-muted py-4 text-center">No contacts yet</p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-6 pt-4 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResearchAndFind}
            disabled={researching}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <Users className="w-4 h-4" />
            {researching ? 'Researching...' : 'Research & Find People'}
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-urgent hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Are you sure?</span>
              <button
                type="button"
                onClick={onDeleteCompany}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {resultMessage && (
          <div className={`px-3 py-2 text-xs rounded-md ${
            resultError
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}>
            {resultMessage}
          </div>
        )}
      </div>
    </div>
  );
}
