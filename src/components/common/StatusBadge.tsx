interface StatusBadgeProps {
  status: string;
  variant?: 'job' | 'company' | 'contact';
}

const jobColors: Record<string, string> = {
  new: 'bg-slate-400',
  saved: 'bg-indigo-400',
  applied: 'bg-teal-500',
  interview: 'bg-teal-600',
  offer: 'bg-green-500',
  pass: 'bg-slate-300',
};

const companyColors: Record<string, string> = {
  researching: 'bg-indigo-400',
  networking: 'bg-teal-500',
  applied: 'bg-teal-600',
  interviewing: 'bg-amber-500',
};

const contactColors: Record<string, string> = {
  identified: 'bg-slate-400',
  message_sent: 'bg-teal-500',
  connected: 'bg-teal-600',
  in_conversation: 'bg-amber-500',
};

const colorMaps: Record<string, Record<string, string>> = {
  job: jobColors,
  company: companyColors,
  contact: contactColors,
};

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, variant = 'job' }: StatusBadgeProps) {
  const colorMap = colorMaps[variant];
  const bgColor = colorMap[status] ?? 'bg-slate-400';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${bgColor}`}
    >
      {formatStatus(status)}
    </span>
  );
}
