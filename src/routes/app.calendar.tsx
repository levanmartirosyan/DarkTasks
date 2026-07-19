import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { priorityMeta, projectById, projects, tasks, userById } from "@/lib/app-data";
import { DataRefreshButton } from "@/components/app/data-refresh-button";
import { UserAvatar } from "@/components/app/user-avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar - DarkTasks" }] }),
});

const monthLookup: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function parseDeadline(value: string) {
  const text = value.trim().toLowerCase();
  const monthToken = text.match(/[a-z]+/)?.[0];
  const day = Number(text.match(/\d{1,2}/)?.[0]);
  const month = monthToken ? monthLookup[monthToken] : undefined;

  if (!day || month === undefined) return null;
  return { month, day };
}

function CalendarPage() {
  const [view, setView] = useState<"Month" | "Week" | "Day">("Month");
  const [, setVersion] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const todayDate = new Date();
  const baseDate = visibleMonth;
  const monthName = baseDate.toLocaleString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  const firstDay = baseDate.getDay();
  const today =
    baseDate.getFullYear() === todayDate.getFullYear() &&
    baseDate.getMonth() === todayDate.getMonth()
      ? todayDate.getDate()
      : -1;
  const firstProject = projects[0];

  const tasksByDay: Record<number, typeof tasks> = {};
  tasks.forEach((task) => {
    const deadline = parseDeadline(task.deadline);
    if (
      deadline &&
      deadline.month === baseDate.getMonth() &&
      deadline.day >= 1 &&
      deadline.day <= daysInMonth
    ) {
      (tasksByDay[deadline.day] ||= []).push(task);
    }
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let i = 1; i <= daysInMonth; i += 1) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  const agendaTasks = tasks.filter((task) => {
    const deadline = parseDeadline(task.deadline);
    if (!deadline || deadline.month !== baseDate.getMonth()) return false;
    if (view === "Month") return true;
    if (view === "Week") return deadline.day >= today && deadline.day < today + 7;
    return deadline.day === today;
  });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deadlines and scheduled work.</p>
        </div>
        <div className="flex items-center gap-2">
          <DataRefreshButton onRefreshed={() => setVersion((value) => value + 1)} />
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            <button
              onClick={() =>
                setVisibleMonth(
                  (value) => new Date(value.getFullYear(), value.getMonth() - 1, 1),
                )
              }
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-surface-2 transition"
            >
              {monthName}
            </button>
            <button
              onClick={() =>
                setVisibleMonth(
                  (value) => new Date(value.getFullYear(), value.getMonth() + 1, 1),
                )
              }
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-0.5 rounded-xl border border-border bg-surface p-0.5 text-xs">
            {(["Month", "Week", "Day"] as const).map((item) => (
              <button
                key={item}
                onClick={() => setView(item)}
                className={`rounded-lg px-2.5 py-1.5 transition ${view === item ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <Link
            to={firstProject ? "/app/projects/$slug" : "/app/projects"}
            params={firstProject ? { slug: firstProject.slug } : undefined}
            className="inline-flex items-center gap-2 rounded-xl gradient-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95 transition"
          >
            <Plus className="h-4 w-4" /> Schedule
          </Link>
        </div>
      </div>

      {view === "Month" ? (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-surface/40">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-[minmax(120px,1fr)]">
          {cells.map((day, index) => {
            const isToday = day === today;
            const dayTasks = day ? (tasksByDay[day] || []).slice(0, 3) : [];
            return (
              <div
                key={index}
                className={cn(
                  "group relative border-b border-r border-border p-2 transition hover:bg-surface-2/40",
                  (index + 1) % 7 === 0 && "border-r-0",
                  index >= cells.length - 7 && "border-b-0",
                  !day && "bg-surface/20",
                )}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "grid h-6 w-6 place-items-center rounded-full text-xs",
                          isToday
                            ? "gradient-primary text-primary-foreground font-semibold shadow-[var(--shadow-glow)]"
                            : "text-muted-foreground",
                        )}
                      >
                        {day}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">{dayTasks.length}</span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {dayTasks.map((task) => {
                        const priority = priorityMeta[task.priority];
                        const project = projectById(task.projectId) ?? firstProject;
                        return (
                          <Link
                            key={task.id}
                            to="/app/projects/$slug"
                            params={{ slug: project?.slug ?? "" }}
                            className="flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-1.5 py-1 text-[10px] hover:bg-surface-2 transition cursor-pointer"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: priority.color }}
                            />
                            <span className="truncate flex-1 text-foreground/90">{task.title}</span>
                            <UserAvatar user={userById(task.assigneeId)} size={14} />
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="mb-4 text-sm font-semibold">
            {view === "Week" ? "This week" : "Today"} in {monthName}
          </div>
          {agendaTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              No scheduled tasks for this view.
            </div>
          ) : (
            <div className="space-y-2">
              {agendaTasks.map((task) => {
                const priority = priorityMeta[task.priority];
                const project = projectById(task.projectId) ?? firstProject;
                return (
                  <Link
                    key={task.id}
                    to="/app/projects/$slug"
                    params={{ slug: project?.slug ?? "" }}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition"
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg text-xs font-medium"
                      style={{ background: priority.bg, color: priority.color }}
                    >
                      {task.deadline.split(" ")[1]}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{task.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {task.code} - {task.deadline}
                      </div>
                    </div>
                    <UserAvatar user={userById(task.assigneeId)} size={22} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
