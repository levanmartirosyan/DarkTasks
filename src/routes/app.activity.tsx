import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  Calendar as CalIcon,
  CheckCircle2,
  Filter,
  MessageSquare,
  Plus,
  Search,
  User as UserIcon,
} from "lucide-react";
import { activity, userById } from "@/lib/app-data";
import { DataRefreshButton } from "@/components/app/data-refresh-button";
import { UserAvatar } from "@/components/app/user-avatar";

export const Route = createFileRoute("/app/activity")({
  component: ActivityPage,
  head: () => ({ meta: [{ title: "Activity - DarkTasks" }] }),
});

const iconFor = (action: string) => {
  if (action.includes("moved")) return <ArrowRight className="h-3 w-3" />;
  if (action.includes("commented")) return <MessageSquare className="h-3 w-3" />;
  if (action.includes("assigned")) return <UserIcon className="h-3 w-3" />;
  if (action.includes("completed")) return <CheckCircle2 className="h-3 w-3" />;
  if (action.includes("deadline")) return <CalIcon className="h-3 w-3" />;
  if (action.includes("created")) return <Plus className="h-3 w-3" />;
  return <ActivityIcon className="h-3 w-3" />;
};

function ActivityPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [version, setVersion] = useState(0);
  const visibleActivity = useMemo(() => {
    const query = q.toLowerCase();
    return activity.filter((item) => {
      const matchesQuery =
        !query ||
        item.action.toLowerCase().includes(query) ||
        item.target.toLowerCase().includes(query) ||
        userById(item.user).name.toLowerCase().includes(query);
      const matchesFilter =
        filter === "All" ||
        (filter === "Comments" && item.action.includes("commented")) ||
        (filter === "Assignments" && item.action.includes("assigned")) ||
        (filter === "Status" && (item.action.includes("moved") || item.action.includes("updated"))) ||
        (filter === "Deadlines" && item.action.includes("deadline"));

      return matchesQuery && matchesFilter;
    });
  }, [filter, q, version]);
  const days = [
    { label: "Today", items: visibleActivity.slice(0, 3) },
    { label: "Yesterday", items: visibleActivity.slice(3, 5) },
    { label: "This week", items: visibleActivity.slice(5) },
  ].filter((day) => day.items.length > 0);

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every change across your workspace.</p>
        </div>
        <DataRefreshButton onRefreshed={() => setVersion((value) => value + 1)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search activity..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40 transition"
          />
        </div>
        {["All", "Comments", "Assignments", "Status", "Deadlines"].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`rounded-xl border px-3 py-2 text-xs transition ${filter === item ? "border-primary/40 bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
        <button
          onClick={() => {
            setQ("");
            setFilter("All");
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2 transition"
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {days.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
          No activity matches your filters.
        </div>
      )}

      {days.map((day) => (
        <section key={day.label}>
          <div className="sticky top-16 z-10 mb-3 -mx-2 bg-background/80 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
            {day.label}
          </div>
          <div className="relative rounded-2xl border border-border bg-card p-5 surface-card">
            <div className="absolute left-[42px] top-6 bottom-6 w-px bg-border" />
            <div className="space-y-5">
              {day.items.map((item) => {
                const user = userById(item.user);
                return (
                  <div
                    key={item.id}
                    className="relative grid grid-cols-[28px_1fr_auto] items-start gap-3"
                  >
                    <div className="relative z-10">
                      <div className="grid h-7 w-7 place-items-center rounded-full border border-border bg-surface text-muted-foreground">
                        {iconFor(item.action)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2 text-sm">
                        <UserAvatar user={user} size={18} />
                        <span className="font-medium">{user.username || user.name}</span>
                        <span className="text-muted-foreground">{item.action}</span>
                        <span>{item.target}</span>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground pt-1.5">{item.time}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
