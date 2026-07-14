import { Droppable, Draggable } from '@hello-pangea/dnd';
import { X } from 'lucide-react';
import type { Job, JobStatus } from '../../db/schema';

interface PipelineColumnProps {
  title: string;
  status: JobStatus;
  jobs: Job[];
  onStatusChange: (id: string, status: JobStatus) => void;
}

function daysInStatus(job: Job): number {
  const history = job.statusHistory;
  if (history.length === 0) return 0;
  const lastEntry = history[history.length - 1];
  const diffMs = Date.now() - new Date(lastEntry.date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export default function PipelineColumn({
  title,
  status,
  jobs,
  onStatusChange,
}: PipelineColumnProps) {
  return (
    <div className="bg-slate-100 rounded-lg p-3 min-h-[200px]">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium text-slate-600 bg-slate-200 rounded-full">
          {jobs.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2 min-h-[120px] rounded transition-colors ${
              snapshot.isDraggingOver ? 'bg-slate-200/60' : ''
            }`}
          >
            {jobs.map((job, index) => (
              <Draggable key={job.id} draggableId={job.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={`bg-white rounded-md p-3 shadow-sm border border-slate-200 ${
                      dragSnapshot.isDragging ? 'shadow-md ring-2 ring-primary/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {job.company}
                        </p>
                      </div>
                      <button
                        onClick={() => onStatusChange(job.id, 'pass')}
                        className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        title="Pass"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {daysInStatus(job)}d in {status}
                    </p>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
