interface BriefingProgress {
  phase: string;
  detail: string;
  current: number;
  total: number;
}

interface DailyBriefingProps {
  isRefreshing: boolean;
  progress: BriefingProgress;
  error: string | null;
  onSkip: () => void;
  onRetry: () => void;
}

export default function DailyBriefing({
  isRefreshing,
  progress,
  error,
  onSkip,
  onRetry,
}: DailyBriefingProps) {
  if (!isRefreshing && !error) return null;

  const percent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <span className="text-4xl" role="img" aria-label="briefcase">
            💼
          </span>
          <h2 className="mt-3 text-xl font-semibold text-slate-800">
            Preparing Your Daily Briefing
          </h2>
        </div>

        {error ? (
          /* Error state */
          <div className="text-center">
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3">
              <p className="text-sm text-urgent">{error}</p>
            </div>
            <button
              onClick={onRetry}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Retry
            </button>
          </div>
        ) : (
          /* Progress state */
          <div className="animate-pulse-subtle">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  {progress.phase}
                </span>
                <span className="text-xs text-muted">
                  {progress.current}/{progress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            {/* Detail text */}
            {progress.detail && (
              <p className="text-center text-sm text-muted">
                {progress.detail}
              </p>
            )}
          </div>
        )}

        {/* Skip button */}
        <div className="mt-6 text-center">
          <button
            onClick={onSkip}
            className="text-sm text-muted transition-colors hover:text-slate-700"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Inline style for the subtle pulse animation */}
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
