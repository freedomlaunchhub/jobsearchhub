import { Flame } from 'lucide-react';
import ProgressRing from '../common/ProgressRing';

interface StatsBarProps {
  streak: number;
  todayApplied: number;
  dailyTarget: number;
  pipelineCounts: Record<string, number>;
}

function getFlameColor(streak: number): string {
  if (streak === 0) return 'text-slate-500';
  if (streak < 7) return 'text-attention';
  if (streak < 14) return 'text-primary';
  if (streak < 30) return 'text-accent';
  return 'text-yellow-400';
}

const PIPELINE_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interviewing',
  offer: 'Offers',
};

const DOT_COLORS: Record<string, string> = {
  saved: 'bg-indigo-400',
  applied: 'bg-teal-500',
  interview: 'bg-teal-600',
  offer: 'bg-green-500',
};

export default function StatsBar({
  streak,
  todayApplied,
  dailyTarget,
  pipelineCounts,
}: StatsBarProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center gap-6">
        {/* Streak */}
        <div className="flex items-center gap-2">
          <Flame className={`w-6 h-6 ${getFlameColor(streak)}`} />
          <span className="text-2xl font-bold text-slate-800">{streak}</span>
          <span className="text-sm text-muted">day streak</span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200 hidden sm:block" />

        {/* Today's progress */}
        <div className="flex items-center gap-3">
          <ProgressRing value={todayApplied} max={dailyTarget} />
          <span className="text-sm text-muted">applications today</span>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200 hidden sm:block" />

        {/* Pipeline counts */}
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(PIPELINE_LABELS).map(([key, label]) => {
            const count = pipelineCounts[key] ?? 0;
            return (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${DOT_COLORS[key]}`}
                />
                <span className="text-sm text-slate-700">
                  {count} {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
