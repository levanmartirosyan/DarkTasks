import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderKanban,
  TrendingUp,
  ArrowUpRight,
  Activity as ActivityIcon,
} from "lucide-react";
import { activity, currentUser, projects, tasks, userById, priorityMeta } from "@/lib/app-data";
import { UserAvatar, AvatarStack } from "@/components/app/user-avatar";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard - DarkTasks" },
      { name: "description", content: "Your workspace at a glance." },
    ],
  }),
});

function Dashboard() {
  const [rangeDays, setRangeDays] = useState(14);
  const assigned = tasks.filter((t) => t.assigneeId === currentUser.id);
  const completed = tasks.filter((t) => t.status === "done");
  const overdue = tasks.filter((t) => t.priority === "urgent" || t.priority === "high").slice(0, 3);
  const upcoming = tasks.slice(0, 4);
  const throughputBars = Array.from({ length: rangeDays }, (_, index) => {
    const source = tasks[index % Math.max(tasks.length, 1)];
    const boost = source ? { urgent: 35, high: 25, medium: 15, low: 8 }[source.priority] : 0;
    return Math.min(95, 18 + boost + ((index + completed.length) % 6) * 8);
  });
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function downloadReport() {
    const lines = [
      "DarkTasks Weekly Report",
      todayLabel,
      "",
      `Assigned: ${assigned.length}`,
      `Completed: ${completed.length}`,
      `High priority: ${overdue.length}`,
      `Projects: ${projects.length}`,
      `Report range: ${rangeDays} days`,
      "",
      "Upcoming deadlines:",
      ...upcoming.map((task) => `- ${task.code}: ${task.title} (${task.deadline})`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "darktasks-weekly-report.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">{todayLabel}</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Good morning, {currentUser.name || "there"}.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening across your workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRangeDays(7)}
            className={`rounded-xl border border-border bg-surface px-3.5 py-2 text-sm hover:bg-surface-2 transition ${rangeDays === 7 ? "border-primary/40 bg-primary/10 text-foreground" : ""}`}
          >
            This week
          </button>
          <button
            onClick={downloadReport}
            className="rounded-xl gradient-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95 transition"
          >
            Weekly report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Assigned"
          value={assigned.length}
          delta="Live"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tint="oklch(0.66 0.19 275)"
        />
        <StatCard
          label="Completed"
          value={completed.length}
          delta="Live"
          icon={<TrendingUp className="h-4 w-4" />}
          tint="oklch(0.72 0.15 155)"
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          delta="Live"
          icon={<AlertTriangle className="h-4 w-4" />}
          tint="oklch(0.75 0.18 22)"
        />
        <StatCard
          label="Projects"
          value={projects.length}
          delta="Live"
          icon={<FolderKanban className="h-4 w-4" />}
          tint="oklch(0.78 0.14 75)"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Throughput</div>
              <div className="text-xs text-muted-foreground">
                Tasks completed over the last {rangeDays} days
              </div>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5 text-xs">
              {[
                { label: "14d", value: 14 },
                { label: "30d", value: 30 },
                { label: "90d", value: 90 },
              ].map((range) => (
                <button
                  key={range.label}
                  onClick={() => setRangeDays(range.value)}
                  className={`rounded-md px-2.5 py-1 transition ${rangeDays === range.value ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <ChartPlaceholder bars={throughputBars} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent activity</div>
            <Link
              to="/app/activity"
              className="text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {activity.slice(0, 5).map((a) => {
              const u = userById(a.user);
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <UserAvatar user={u} size={26} />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{u.name}</span>{" "}
                    <span className="text-muted-foreground">{a.action}</span>{" "}
                    <span>{a.target}</span>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{a.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Active projects</div>
            <Link
              to="/app/projects"
              className="text-xs text-muted-foreground hover:text-foreground transition"
            >
              See all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project from the Projects page."
              />
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  to="/app/projects/$slug"
                  params={{ slug: p.slug }}
                  className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 hover:bg-surface-2 hover:border-border-strong transition"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-base">
                      {p.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full gradient-primary"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <div className="w-9 text-right text-xs font-medium text-muted-foreground">
                        {p.progress}%
                      </div>
                    </div>
                    <AvatarStack users={p.memberIds.map(userById)} size={22} max={3} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Upcoming deadlines</div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4 space-y-2.5">
            {upcoming.length === 0 ? (
              <EmptyState
                title="No deadlines"
                description="New tasks with deadlines will appear here."
              />
            ) : (
              upcoming.map((t) => {
                const p = priorityMeta[t.priority];
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition"
                  >
                    <span
                      className="grid h-8 w-8 place-items-center rounded-lg text-xs font-medium"
                      style={{ background: p.bg, color: p.color }}
                    >
                      {t.deadline.split(" ")[1]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {t.code} - {t.deadline}
                      </div>
                    </div>
                    <UserAvatar user={userById(t.assigneeId)} size={22} />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  icon,
  tint,
}: {
  label: string;
  value: number;
  delta: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 surface-card hover-lift">
      <div className="flex items-center justify-between">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${tint} 15%, transparent)`, color: tint }}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">{delta}</span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="pointer-events-none absolute -right-8 -bottom-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
        style={{ background: tint }}
      />
    </div>
  );
}

function ChartPlaceholder({ bars }: { bars: number[] }) {
  return (
    <div className="mt-6 h-48 flex items-end gap-1.5">
      {bars.map((h, i) => (
        <div key={i} className="group relative flex-1">
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${h}%`,
              background: `linear-gradient(180deg, oklch(0.66 0.19 275 / ${0.4 + h / 200}), oklch(0.66 0.19 275 / 0.1))`,
              borderTop: "2px solid oklch(0.66 0.19 275)",
            }}
          />
          <div className="mt-1.5 text-center text-[9px] text-muted-foreground">{i + 1}</div>
        </div>
      ))}
    </div>
  );
}
