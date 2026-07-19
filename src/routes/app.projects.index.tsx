import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Filter,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { AvatarStack } from "@/components/app/user-avatar";
import { DataRefreshButton } from "@/components/app/data-refresh-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { currentUser, projects, users, userById, type Project } from "@/lib/app-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/projects/")({
  component: ProjectsPage,
  head: () => ({ meta: [{ title: "Projects - DarkTasks" }] }),
});

function ProjectsPage() {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [menu, setMenu] = useState<{
    project: Project;
    x: number;
    y: number;
    placement: "top" | "bottom";
  } | null>(null);
  const [, setVersion] = useState(0);
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) &&
      (!mineOnly || p.memberIds.includes(currentUser.id)),
  );

  function replaceProject(updated: Project) {
    const index = projects.findIndex((project) => project.id === updated.id);
    if (index >= 0) projects[index] = updated;
    setVersion((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize work across teams and repositories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DataRefreshButton onRefreshed={() => setVersion((value) => value + 1)} />
          <Button
            onClick={() => setCreating(true)}
            className="rounded-xl gradient-primary px-3.5 py-2 text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> New project
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects..."
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring/40 transition"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setMineOnly((value) => !value)}
          className={cn(
            "rounded-xl border-border bg-surface px-3 py-2 hover:bg-surface-2",
            mineOnly && "border-primary/40 bg-primary/10 text-foreground",
          )}
        >
          <Filter className="h-4 w-4" /> Filter
        </Button>
        <div className="flex gap-0.5 rounded-xl border border-border bg-surface p-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("grid")}
            className={cn(
              "h-8 w-9 rounded-lg",
              view === "grid" ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setView("list")}
            className={cn(
              "h-8 w-9 rounded-lg",
              view === "list" ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="group relative rounded-2xl border border-border bg-card p-5 surface-card hover-lift"
            >
              <Link to="/app/projects/$slug" params={{ slug: p.slug }} className="block">
                <div className="flex items-start gap-3 pr-8">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">
                    {p.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold">{p.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {p.description}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-1.5">
                  {p.repositories.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                      {r.name}
                    </span>
                  ))}
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span>{p.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full gradient-primary transition-all group-hover:brightness-110"
                      style={{ width: `${p.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <AvatarStack users={p.memberIds.map(userById)} size={24} />
                  <div className="text-[11px] text-muted-foreground">
                    {p.taskCount} tasks - {p.lastActivity}
                  </div>
                </div>
              </Link>
              <ProjectActions
                open={menu?.project.id === p.id}
                className="absolute right-3 top-3"
                onToggle={(event) => toggleProjectMenu(p, event.currentTarget)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Repositories</th>
                <th className="px-4 py-3 text-left font-medium">Members</th>
                <th className="px-4 py-3 text-left font-medium">Progress</th>
                <th className="px-4 py-3 text-left font-medium">Activity</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-2 transition"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/app/projects/$slug"
                      params={{ slug: p.slug }}
                      className="flex items-center gap-3"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface-2 text-sm">
                        {p.icon}
                      </span>
                      <span className="font-medium">{p.name}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.repositories.length} repos</td>
                  <td className="px-4 py-3">
                    <AvatarStack users={p.memberIds.map(userById)} size={22} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full gradient-primary"
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{p.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.lastActivity}</td>
                  <td className="relative px-4 py-3 text-right">
                    <ProjectActions
                      open={menu?.project.id === p.id}
                      onToggle={(event) => toggleProjectMenu(p, event.currentTarget)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {menu && (
        <ProjectMenu
          menu={menu}
          onClose={() => setMenu(null)}
          onEdit={() => {
            setEditing(menu.project);
            setMenu(null);
          }}
          onDelete={() => {
            setDeleting(menu.project);
            setMenu(null);
          }}
        />
      )}

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
      {editing && (
        <EditProjectModal
          project={editing}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            replaceProject(updated);
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteProjectModal
          project={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            const index = projects.findIndex((project) => project.id === deleting.id);
            if (index >= 0) projects.splice(index, 1);
            setDeleting(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
    </div>
  );

  function toggleProjectMenu(project: Project, button: HTMLElement) {
    const rect = button.getBoundingClientRect();
    const placement = window.innerHeight - rect.bottom < 116 ? "top" : "bottom";

    setMenu((current) =>
      current?.project.id === project.id
        ? null
        : {
            project,
            x: rect.right,
            y: placement === "top" ? rect.top : rect.bottom,
            placement,
          },
    );
  }
}

function ProjectActions({
  open,
  className,
  onToggle,
}: {
  open: boolean;
  className?: string;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className={cn("relative z-10 inline-flex", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle(event);
        }}
        className={cn(
          "h-8 w-8 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          open && "bg-surface-2 text-foreground",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ProjectMenu({
  menu,
  onClose,
  onEdit,
  onDelete,
}: {
  menu: { project: Project; x: number; y: number; placement: "top" | "bottom" };
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-elevated)] animate-scale-in"
        style={{
          left: Math.max(12, Math.min(menu.x - 176, window.innerWidth - 188)),
          top: menu.placement === "bottom" ? menu.y + 6 : undefined,
          bottom: menu.placement === "top" ? window.innerHeight - menu.y + 6 : undefined,
        }}
      >
        <button
          onClick={onEdit}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
        >
          <Pencil className="h-4 w-4" /> Edit project
        </button>
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition"
        >
          <Trash2 className="h-4 w-4" /> Delete project
        </button>
      </div>
    </>
  );
}

function EditProjectModal({
  project,
  onClose,
  onUpdated,
}: {
  project: Project;
  onClose: () => void;
  onUpdated: (project: Project) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [icon, setIcon] = useState(project.icon);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const updated = (await api.updateProject(project.id, {
        name,
        description,
        icon,
      })) as Project;
      onUpdated(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalShell title="Edit project" description="Update project identity and description." onClose={onClose}>
      <Field label="Icon & Name">
        <div className="flex gap-2">
          <Input
            value={icon}
            onChange={(event) => setIcon(event.target.value.slice(0, 2))}
            className="h-10 w-10 rounded-xl border-border bg-surface text-center text-lg"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="flex-1 rounded-xl border-border bg-surface"
          />
        </div>
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="resize-none rounded-xl border-border bg-surface"
        />
      </Field>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <ProjectModalActions onClose={onClose} saving={saving} label="Save project" onSubmit={() => void submit()} />
    </ProjectModalShell>
  );
}

function DeleteProjectModal({
  project,
  onClose,
  onDeleted,
}: {
  project: Project;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function deleteProject() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      await api.deleteProject(project.id);
      onDeleted();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalShell title="Delete project" description="This removes the project, repositories, and tasks." onClose={onClose}>
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Delete {project.name}? This cannot be undone.
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 -mx-5 -mb-5">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="destructive" disabled={saving} onClick={() => void deleteProject()}>
          <Trash2 className="h-4 w-4" /> {saving ? "Deleting..." : "Delete project"}
        </Button>
      </div>
    </ProjectModalShell>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("D");
  const [repoText, setRepoText] = useState("General");
  const [memberIds, setMemberIds] = useState(users.map((user) => user.id).slice(0, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const created = (await api.createProject({
        name,
        description,
        icon,
        memberIds,
        repositories: repoText
          .split(",")
          .map((repo) => repo.trim())
          .filter(Boolean)
          .map((repo) => ({ name: repo })),
      })) as Project;

      projects.unshift(created);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProjectModalShell title="New project" description="Set up a workspace for your team." onClose={onClose}>
      <Field label="Icon & Name">
        <div className="flex gap-2">
          <Input
            value={icon}
            onChange={(event) => setIcon(event.target.value.slice(0, 2))}
            className="h-10 w-10 rounded-xl border-border bg-surface text-center text-lg"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. DarkTasks Mobile"
            className="flex-1 rounded-xl border-border bg-surface"
          />
        </div>
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="What is this project about?"
          className="resize-none rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Repositories">
        <Input
          value={repoText}
          onChange={(event) => setRepoText(event.target.value)}
          placeholder="General, API, Dashboard"
          className="rounded-xl border-border bg-surface"
        />
        <div className="mt-1 text-[11px] text-muted-foreground">
          Separate multiple repositories with commas.
        </div>
      </Field>
      <Field label="Members">
        <div className="grid gap-2 sm:grid-cols-2">
          {users.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs transition hover:bg-surface-2"
            >
              <Checkbox
                checked={memberIds.includes(user.id)}
                onCheckedChange={(checked) =>
                  setMemberIds((ids) =>
                    checked ? [...ids, user.id] : ids.filter((id) => id !== user.id),
                  )
                }
              />
              <span className="truncate">{user.username || user.name}</span>
            </label>
          ))}
        </div>
      </Field>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <ProjectModalActions onClose={onClose} saving={saving} label="Create project" onSubmit={() => void submit()} />
    </ProjectModalShell>
  );
}

function ProjectModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)] animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-base font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

function ProjectModalActions({
  onClose,
  saving,
  label,
  onSubmit,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
  onSubmit: () => void;
}) {
  return (
    <div className="-mx-5 -mb-5 flex items-center justify-end gap-2 border-t border-border px-5 py-3">
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={saving} onClick={onSubmit}>
        {saving ? "Saving..." : label}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
