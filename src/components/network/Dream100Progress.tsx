interface Dream100ProgressProps {
  total: number;
  statusCounts: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  open_listing: 'bg-slate-400',
  new: 'bg-blue-400',
  researched: 'bg-indigo-400',
  networking: 'bg-teal-500',
  applied: 'bg-teal-600',
  interviewing: 'bg-amber-500',
};

export default function Dream100Progress({ total, statusCounts }: Dream100ProgressProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">
          {total}/100 Dream Companies
        </h3>
      </div>
      <div className="h-3 rounded-full bg-slate-200 overflow-hidden flex">
        {Object.entries(STATUS_COLORS).map(([status, color]) => {
          const count = statusCounts[status] ?? 0;
          if (count === 0) return null;
          const widthPercent = (count / 100) * 100;
          return (
            <div
              key={status}
              className={`${color} h-full`}
              style={{ width: `${widthPercent}%` }}
              title={`${status}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 flex-wrap">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="capitalize">{status.replace(/_/g, ' ')}</span>
            <span className="font-medium text-slate-700">{statusCounts[status] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
