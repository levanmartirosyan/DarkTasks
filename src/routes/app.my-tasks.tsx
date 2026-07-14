import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Filter } from "lucide-react";
import { api } from "@/lib/api-client";
import { currentUser, tasks, priorityMeta, userById, projectById, type Task } from "@/lib/app-data";
import { UserAvatar } from "@/components/app/user-avatar";
import { TaskDetailSheet } from "@/components/app/task-detail-sheet";
import { TaskEditModal } from "@/components/app/task-edit-modal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/my-tasks")({
  component: MyTasks,
  head: () => ({ meta: [{ title: "My Tasks - DarkTasks" }] }),
});

const groups = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
  { id: "done", label: "Done" },
];

function MyTasks() {
  const [selected, setSelected] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [q, setQ] = useState("");
  const [priority, setPriority] = useState<"all" | "urgent" | "high" | "medium" | "low">("all");
  const [, setVersion] = useState(0);
  const mine = tasks.filter((t) => {
    const matchesOwner = t.assigneeId === currentUser.id || t.creatorId === currentUser.id;
    const matchesQuery =
      !q ||
      t.title.toLowerCase().includes(q.toLowerCase()) ||
      t.code.toLowerCase().includes(q.toLowerCase());
    const matchesPriority = priority === "all" || t.priority === priority;

    return matchesOwner && matchesQuery && matchesPriority;
  });
  const byGroup = {
    today: mine.filter((t) => ["urgent"].includes(t.priority)),
    week: mine.filter((t) => ["high", "medium"].includes(t.priority) && t.status !== "done"),
    later: mine.filter((t) => t.priority === "low" && t.status !== "done"),
    done: mine.filter((t) => t.status === "done"),
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything assigned to you, grouped by urgency.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search my tasks..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40 transition"
          />
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-0.5">
          {(["all", "urgent", "high", "medium", "low"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPriority(item)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs capitalize transition",
                priority === item
                  ? "bg-surface-3 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {groups.map((g) => {
          const list = (byGroup as any)[g.id] as typeof tasks;
          if (list.length === 0) return null;
          return (
            <section key={g.id}>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-semibold">{g.label}</div>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {list.map((t, i) => {
                  const p = priorityMeta[t.priority];
                  const project = projectById(t.projectId);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={cn(
                        "grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition",
                        i !== list.length - 1 && "border-b border-border/60",
                      )}
                    >
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {t.code}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{project?.name ?? "Project"}</span>-<span>{t.deadline}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="hidden sm:inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: p.bg, color: p.color }}
                        >
                          {p.icon} {p.label}
                        </span>
                        <UserAvatar user={userById(t.assigneeId)} size={22} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <TaskDetailSheet
        task={selected}
        onClose={() => setSelected(null)}
        onEdit={(task) => {
          setEditing(task);
          setSelected(null);
        }}
        onDelete={(task) => {
          void api.deleteTask(task.id).then(() => {
            const index = tasks.findIndex((item) => item.id === task.id);
            if (index >= 0) tasks.splice(index, 1);
            setSelected(null);
            setVersion((value) => value + 1);
          });
        }}
      />
      {editing && (
        <TaskEditModal
          task={editing}
          onUpdated={(updated) => {
            const index = tasks.findIndex((task) => task.id === updated.id);
            if (index >= 0) tasks[index] = updated;
            setEditing(null);
            setVersion((value) => value + 1);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
