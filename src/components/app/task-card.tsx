import { Calendar, MessageSquare, Paperclip } from "lucide-react";
import type { DragEvent, KeyboardEvent, PointerEvent } from "react";
import { UserAvatar } from "@/components/app/user-avatar";
import { priorityMeta, userById, type Task, projectById } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  onClick,
  dragging,
  onDragStart,
  onDragEnd,
  onPointerDown,
  draggable = true,
}: {
  task: Task;
  onClick?: () => void;
  dragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  draggable?: boolean;
}) {
  const assignee = userById(task.assigneeId);
  const project = projectById(task.projectId);
  const repo = project?.repositories.find((r) => r.id === task.repositoryId);
  const p = priorityMeta[task.priority];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onClick?.();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onPointerDown={onPointerDown}
      className={cn(
        "group w-full cursor-grab select-none rounded-xl border border-border bg-card p-3.5 text-left transition-all hover:border-border-strong hover:bg-surface-2 hover:shadow-[var(--shadow-elevated)] active:cursor-grabbing active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        dragging && "rotate-1 scale-[1.02] opacity-70 shadow-[var(--shadow-glow)]",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          {task.code}
        </span>
        {repo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: repo.color }} />
            {repo.name}
          </span>
        )}
        <span
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: p.bg, color: p.color }}
        >
          {p.icon} {p.label}
        </span>
      </div>

      <div className="text-sm font-medium leading-snug text-foreground line-clamp-2">
        {task.title}
      </div>

      {task.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: label.color }} />
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {task.deadline}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {task.activity}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {(task.activity % 3) + 1}
        </div>
        <div className="ml-auto flex items-center -space-x-1.5">
          <UserAvatar user={userById(task.creatorId)} size={20} ring />
          <UserAvatar user={assignee} size={20} ring />
        </div>
      </div>
    </div>
  );
}
