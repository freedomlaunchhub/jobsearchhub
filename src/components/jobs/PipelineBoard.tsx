import { useMemo } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { ChevronDown } from 'lucide-react';
import type { Job, JobStatus } from '../../db/schema';
import PipelineColumn from './PipelineColumn';

interface PipelineBoardProps {
  jobs: Job[];
  onStatusChange: (id: string, status: JobStatus) => void;
}

const COLUMNS: { status: JobStatus; title: string }[] = [
  { status: 'saved', title: 'Saved' },
  { status: 'applied', title: 'Applied' },
  { status: 'interview', title: 'Interview' },
  { status: 'offer', title: 'Offer' },
];

export default function PipelineBoard({
  jobs,
  onStatusChange,
}: PipelineBoardProps) {
  const jobsByStatus = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const col of COLUMNS) {
      map[col.status] = [];
    }
    map['pass'] = [];
    for (const job of jobs) {
      if (map[job.status]) {
        map[job.status].push(job);
      }
    }
    return map;
  }, [jobs]);

  const passedCount = jobsByStatus['pass']?.length ?? 0;

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as JobStatus;
    onStatusChange(draggableId, newStatus);
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto">
          {COLUMNS.map((col) => (
            <PipelineColumn
              key={col.status}
              title={col.title}
              status={col.status}
              jobs={jobsByStatus[col.status] ?? []}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Collapsed passed section */}
      {passedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-500">
          <ChevronDown className="w-4 h-4" />
          <span>
            {passedCount} passed job{passedCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
