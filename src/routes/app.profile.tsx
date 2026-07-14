import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MapPin, Calendar as CalIcon, Trophy, Zap, CheckCircle2 } from "lucide-react";
import { currentUser, tasks, activity, userById, priorityMeta, projectById } from "@/lib/app-data";
import { UserAvatar } from "@/components/app/user-avatar";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: `${currentUser.name} - DarkTasks` }] }),
});

function ProfilePage() {
  const assigned = tasks.filter((t) => t.assigneeId === currentUser.id);
  const completed = tasks.filter(
    (t) => t.status === "done" && (t.assigneeId === currentUser.id || t.creatorId === currentUser.id),
  ).length;
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      {/* Cover */}
      <div className="relative overflow-hidden rounded-2xl border border-border">
        <div className="aurora-bg h-40" />
        <div className="absolute inset-x-0 bottom-0 translate-y-1/2 px-6">
          <UserAvatar
            user={currentUser}
            size={96}
            className="!ring-4 !ring-background shadow-[var(--shadow-elevated)]"
          />
        </div>
      </div>
      <div className="pt-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{currentUser.name}</h1>
            <span className="rounded-md gradient-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              {currentUser.role}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              {currentUser.email}
            </div>
            <div className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              Amsterdam, NL
            </div>
            <div className="inline-flex items-center gap-1.5">
              <CalIcon className="h-3 w-3" />
              Joined Mar 2025
            </div>
          </div>
        </div>
        <Link to="/app/settings" className="rounded-xl border border-border bg-surface px-3.5 py-2 text-sm hover:bg-surface-2 transition">
          Edit profile
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Assigned"
          value={assigned.length}
          tint="oklch(0.66 0.19 275)"
        />
        <MiniStat
          icon={<Trophy className="h-4 w-4" />}
          label="Completed"
          value={completed}
          tint="oklch(0.72 0.15 155)"
        />
        <MiniStat
          icon={<Zap className="h-4 w-4" />}
          label="Created"
          value={tasks.filter((t) => t.creatorId === currentUser.id).length}
          tint="oklch(0.78 0.14 75)"
        />
        <MiniStat
          icon={<CalIcon className="h-4 w-4" />}
          label="This week"
          value={assigned.filter((task) => task.status !== "done").length}
          tint="oklch(0.7 0.18 340)"
        />
      </div>

      {/* Row: tasks + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="text-sm font-semibold">Assigned tasks</div>
          <div className="mt-3 space-y-2">
            {assigned.slice(0, 5).map((t) => {
              const p = priorityMeta[t.priority];
              const proj = projectById(t.projectId);
              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 hover:bg-surface-2 transition"
                >
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {t.code}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {proj?.name ?? "Project"} - {t.deadline}
                    </div>
                  </div>
                  <span className="text-[10px]" style={{ color: p.color }}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 surface-card">
          <div className="text-sm font-semibold">Recent activity</div>
          <div className="mt-4 space-y-3">
            {activity.slice(0, 6).map((a) => {
              const u = userById(a.user);
              return (
                <div key={a.id} className="flex items-start gap-3 text-sm">
                  <UserAvatar user={u} size={24} />
                  <div className="min-w-0 flex-1">
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
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  suffix,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 surface-card hover-lift">
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${tint} 15%, transparent)`, color: tint }}
        >
          {icon}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">
        {value}
        {suffix}
      </div>
    </div>
  );
}



