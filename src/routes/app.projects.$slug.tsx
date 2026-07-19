import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  Filter,
  CalendarIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users2,
  GitBranch,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import {
  defaultColumns,
  currentUser,
  projects,
  projectBySlug,
  tasks as allTasks,
  users,
  userById,
  type Column,
  type Project,
  type Repository,
  type Task,
} from "@/lib/app-data";
import { TaskCard } from "@/components/app/task-card";
import { TaskDetailSheet } from "@/components/app/task-detail-sheet";
import { TaskEditModal } from "@/components/app/task-edit-modal";
import { AvatarStack } from "@/components/app/user-avatar";
import { DataRefreshButton } from "@/components/app/data-refresh-button";
import { Button } from "@/components/ui/button";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PointerTaskDrag = {
  task: Task;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  targetStatus: string | null;
};

export const Route = createFileRoute("/app/projects/$slug")({
  component: ProjectBoardPage,
  loader: ({ params }) => {
    const project = projectBySlug(params.slug);
    if (!project) throw notFound();
    return { project };
  },
  notFoundComponent: () => (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <div className="text-6xl">D</div>
        <div className="mt-3 text-lg font-semibold">Project not found</div>
        <Link to="/app/projects" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to projects
        </Link>
      </div>
    </div>
  ),
  head: ({ params }) => ({ meta: [{ title: `${params.slug} - DarkTasks` }] }),
});

function ProjectBoardPage() {
  const { project } = Route.useLoaderData();
  const params = Route.useParams();
  const navigate = useNavigate();
  const [repoId, setRepoId] = useState<string>("all");
  const [columns, setColumns] = useState(defaultColumns);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [columnName, setColumnName] = useState("");
  const [creatingTaskStatus, setCreatingTaskStatus] = useState<string | null>(null);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [editingRepo, setEditingRepo] = useState<Repository | null>(null);
  const [deletingRepo, setDeletingRepo] = useState<Repository | null>(null);
  const [repoMenuId, setRepoMenuId] = useState<string | null>(null);
  const [managingMembers, setManagingMembers] = useState(false);
  const [managingColumn, setManagingColumn] = useState<Column | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [pointerDrag, setPointerDrag] = useState<PointerTaskDrag | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [groupPriority, setGroupPriority] = useState(false);
  const [version, setVersion] = useState(0);
  const pointerDragRef = useRef<PointerTaskDrag | null>(null);
  const suppressClickRef = useRef(false);

  const projectTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.projectId === project.id &&
          (repoId === "all" || t.repositoryId === repoId) &&
          (!mineOnly || t.assigneeId === currentUser.id || t.creatorId === currentUser.id),
      ),
    [project.id, repoId, mineOnly, version],
  );
  async function moveTask(taskId: string, status: string) {
    const task = allTasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;

    const previousStatus = task.status;
    task.status = status;
    setVersion((value) => value + 1);

    try {
      await api.updateTaskStatus(taskId, status);
    } catch (error) {
      task.status = previousStatus;
      setVersion((value) => value + 1);
      console.error(error);
    }
  }

  function getDraggedTaskId(event: DragEvent) {
    return event.dataTransfer.getData("application/x-darktasks-task") || draggingTaskId;
  }

  function setPointerDragState(next: PointerTaskDrag | null) {
    pointerDragRef.current = next;
    setPointerDrag(next);
  }

  function columnIdFromPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y);
    return element?.closest<HTMLElement>("[data-column-id]")?.dataset.columnId ?? null;
  }

  function beginPointerDrag(task: Task, event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    setPointerDragState({
      task,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      targetStatus: null,
    });
    setDraggingTaskId(task.id);
  }

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      const current = pointerDragRef.current;
      if (!current) return;

      const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      const active = current.active || distance > 6;

      if (active) event.preventDefault();

      setPointerDragState({
        ...current,
        x: event.clientX,
        y: event.clientY,
        active,
        targetStatus: active ? columnIdFromPoint(event.clientX, event.clientY) : null,
      });
    }

    function onPointerUp(event: PointerEvent) {
      const current = pointerDragRef.current;
      if (!current) return;

      const targetStatus = current.targetStatus ?? columnIdFromPoint(event.clientX, event.clientY);
      if (current.active && targetStatus && targetStatus !== current.task.status) {
        void moveTask(current.task.id, targetStatus);
      }

      suppressClickRef.current = current.active;
      setPointerDragState(null);
      setDraggingTaskId(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  async function createColumn() {
    const name = columnName.trim();
    if (!name) return;

    const created = (await api.createColumn({ name })) as Column;
    defaultColumns.push(created);
    setColumns([...defaultColumns]);
    setColumnName("");
    setAddingColumn(false);
  }

  function openTaskModal(
    status = columns.find((column) => column.id === "todo")?.id ?? columns[0]?.id ?? "backlog",
  ) {
    setCreatingTaskStatus(status);
  }

  async function deleteTask(task: Task) {
    await api.deleteTask(task.id);
    const index = allTasks.findIndex((item) => item.id === task.id);
    if (index >= 0) allTasks.splice(index, 1);
    setSelectedTask(null);
    setVersion((value) => value + 1);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Project header */}
      <div className="border-b border-border px-4 sm:px-6 lg:px-8 py-4">
        {/* Breadcrumbs */}
        <div className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link to="/app/projects" className="hover:text-foreground transition">
            Projects
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{project.name}</span>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">
            {project.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{project.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <DataRefreshButton onRefreshed={() => setVersion((value) => value + 1)} />
            <div className="hidden md:flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5">
              <Users2 className="h-3.5 w-3.5 text-muted-foreground" />
              <AvatarStack users={project.memberIds.map(userById)} size={22} />
              <button
                onClick={() => setManagingMembers(true)}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={() => openTaskModal()}
              className="inline-flex items-center gap-2 rounded-xl gradient-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-95 transition"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
            <Button
              variant="outline"
              onClick={() => setEditingProject(true)}
              className="rounded-xl border-border bg-surface px-3 py-2 hover:bg-surface-2"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeletingProject(true)}
              className="rounded-xl border-border bg-surface px-3 py-2 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Repository selector - segmented control */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" /> Repositories
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
            <RepoPill active={repoId === "all"} onClick={() => setRepoId("all")}>
              <span>All</span>
              <span className="rounded-md bg-surface-3 px-1 text-[10px]">
                {allTasks.filter((t) => t.projectId === project.id).length}
              </span>
            </RepoPill>
            {project.repositories.map((r: { id: string; name: string; color: string }) => {
              const count = allTasks.filter(
                (t) => t.projectId === project.id && t.repositoryId === r.id,
              ).length;
              return (
                <div key={r.id} className="flex items-center gap-0.5">
                  <RepoPill active={repoId === r.id} onClick={() => setRepoId(r.id)}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                    <span>{r.name}</span>
                    <span className="rounded-md bg-surface-3 px-1 text-[10px]">{count}</span>
                  </RepoPill>
                  <div className="relative">
                    <button
                      onClick={() => setRepoMenuId((id) => (id === r.id ? null : r.id))}
                      className="rounded-lg px-1.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                    {repoMenuId === r.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setRepoMenuId(null)} />
                        <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-elevated)]">
                          <button
                            onClick={() => {
                              setEditingRepo(r);
                              setRepoMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 transition"
                          >
                            <Pencil className="h-4 w-4" /> Edit repo
                          </button>
                          <button
                            onClick={() => {
                              setDeletingRepo(r);
                              setRepoMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition"
                          >
                            <Trash2 className="h-4 w-4" /> Delete repo
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setCreatingRepo(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
            >
              <Plus className="h-3 w-3" /> Repo
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setMineOnly((value) => !value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-surface-2 transition",
                mineOnly && "border-primary/40 bg-primary/10 text-foreground",
              )}
            >
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <button
              onClick={() => setGroupPriority((value) => !value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-surface-2 transition",
                groupPriority && "border-primary/40 bg-primary/10 text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Group by
            </button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 px-4 sm:px-6 lg:px-8 py-5">
          {columns.map((col) => {
            const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
            const colTasks = projectTasks
              .filter((t) => t.status === col.id)
              .sort((a, b) =>
                groupPriority ? priorityRank[a.priority] - priorityRank[b.priority] : 0,
              );
            return (
              <div key={col.id} className="flex h-full w-[320px] shrink-0 flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: colColor(col.id) }}
                  />
                  <span className="text-sm font-semibold">{col.name}</span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {colTasks.length}
                  </span>
                  <button
                    onClick={() => openTaskModal(col.id)}
                    className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setManagingColumn(col)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground transition"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div
                  data-column-id={col.id}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const taskId = getDraggedTaskId(event);
                    if (taskId) void moveTask(taskId, col.id);
                    setDraggingTaskId(null);
                  }}
                  className={cn(
                    "flex-1 overflow-y-auto rounded-2xl border border-border bg-surface/40 p-2 space-y-2 transition",
                    pointerDrag?.active &&
                      pointerDrag.targetStatus === col.id &&
                      "border-primary/70 bg-primary/[0.08] shadow-[inset_0_0_0_1px_var(--color-primary)]",
                  )}
                >
                  {colTasks.length === 0 ? (
                    <EmptyColumn />
                  ) : (
                    colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("application/x-darktasks-task", t.id);
                          event.dataTransfer.setData("text/plain", t.id);
                          setDraggingTaskId(t.id);
                        }}
                        onDragEnd={() => setDraggingTaskId(null)}
                        onPointerDown={(event) => beginPointerDrag(t, event)}
                        task={t}
                        draggable={false}
                        dragging={draggingTaskId === t.id}
                        onClick={() => {
                          if (!draggingTaskId && !suppressClickRef.current) setSelectedTask(t);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          {/* Add column */}
          <div className="w-[280px] shrink-0">
            {addingColumn ? (
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-3">
                <Input
                  value={columnName}
                  onChange={(event) => setColumnName(event.target.value)}
                  autoFocus
                  placeholder="Column name"
                  className="rounded-lg border-border bg-surface"
                />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => void createColumn()}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingColumn(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-transparent px-3 py-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground hover:border-primary/50 transition"
              >
                <Plus className="h-4 w-4" /> Add column
              </button>
            )}
          </div>
        </div>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={(task) => {
          setEditingTask(task);
          setSelectedTask(null);
        }}
        onDelete={(task) => void deleteTask(task)}
      />
      {pointerDrag?.active && (
        <div
          className="pointer-events-none fixed z-[70] w-[300px] -translate-x-1/2 -translate-y-8 opacity-95"
          style={{ left: pointerDrag.x, top: pointerDrag.y }}
        >
          <TaskCard task={pointerDrag.task} dragging draggable={false} />
        </div>
      )}
      {creatingRepo && (
        <CreateRepositoryModal
          projectId={project.id}
          onCreated={(repository) => {
            project.repositories.push(repository);
            setVersion((value) => value + 1);
            setCreatingRepo(false);
          }}
          onClose={() => setCreatingRepo(false)}
        />
      )}
      {editingProject && (
        <EditProjectModal
          project={project}
          onClose={() => setEditingProject(false)}
          onUpdated={(updated) => {
            Object.assign(project, updated);
            const index = projects.findIndex((item) => item.id === updated.id);
            if (index >= 0) projects[index] = updated;
            setEditingProject(false);
            setVersion((value) => value + 1);
            if (updated.slug !== params.slug) {
              navigate({ to: "/app/projects/$slug", params: { slug: updated.slug } });
            }
          }}
        />
      )}
      {deletingProject && (
        <DeleteProjectModal
          project={project}
          onClose={() => setDeletingProject(false)}
          onDeleted={() => {
            const index = projects.findIndex((item) => item.id === project.id);
            if (index >= 0) projects.splice(index, 1);
            setDeletingProject(false);
            navigate({ to: "/app/projects" });
          }}
        />
      )}
      {editingRepo && (
        <EditRepositoryModal
          repository={editingRepo}
          onClose={() => setEditingRepo(null)}
          onUpdated={(updated) => {
            const index = project.repositories.findIndex((repo: Repository) => repo.id === updated.id);
            if (index >= 0) project.repositories[index] = updated;
            setEditingRepo(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {deletingRepo && (
        <DeleteRepositoryModal
          repository={deletingRepo}
          taskCount={allTasks.filter((task) => task.repositoryId === deletingRepo.id).length}
          onClose={() => setDeletingRepo(null)}
          onDeleted={() => {
            const index = project.repositories.findIndex((repo: Repository) => repo.id === deletingRepo.id);
            if (index >= 0) project.repositories.splice(index, 1);
            if (repoId === deletingRepo.id) setRepoId("all");
            setDeletingRepo(null);
            setVersion((value) => value + 1);
          }}
        />
      )}
      {managingMembers && (
        <ProjectMembersModal
          project={project}
          onClose={() => setManagingMembers(false)}
          onSaved={(updated) => {
            project.memberIds = updated.memberIds;
            setVersion((value) => value + 1);
            setManagingMembers(false);
          }}
        />
      )}
      {creatingTaskStatus && (
        <CreateTaskModal
          projectId={project.id}
          repositories={project.repositories}
          columns={columns}
          defaultStatus={creatingTaskStatus}
          onCreated={(task) => {
            allTasks.unshift(task);
            setVersion((value) => value + 1);
            setCreatingTaskStatus(null);
          }}
          onClose={() => setCreatingTaskStatus(null)}
        />
      )}
      {managingColumn && (
        <ColumnManagementModal
          column={managingColumn}
          columns={columns}
          onUpdated={(updated) => {
            const index = defaultColumns.findIndex((column) => column.id === updated.id);
            if (index >= 0) defaultColumns[index] = updated;
            setColumns([...defaultColumns]);
            setManagingColumn(null);
          }}
          onDeleted={(deletedId, moveTo) => {
            allTasks.forEach((task) => {
              if (task.status === deletedId) task.status = moveTo;
            });
            const index = defaultColumns.findIndex((column) => column.id === deletedId);
            if (index >= 0) defaultColumns.splice(index, 1);
            setColumns([...defaultColumns]);
            setVersion((value) => value + 1);
            setManagingColumn(null);
          }}
          onClose={() => setManagingColumn(null)}
        />
      )}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          onUpdated={(updated) => {
            const index = allTasks.findIndex((task) => task.id === updated.id);
            if (index >= 0) allTasks[index] = updated;
            setVersion((value) => value + 1);
            setEditingTask(null);
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

function RepoPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition",
        active
          ? "bg-surface-3 text-foreground shadow-[inset_0_0_0_1px_var(--color-border-strong)]"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
      )}
    >
      {children}
    </button>
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
      const updated = (await api.updateProject(project.id, { name, description, icon })) as Project;
      onUpdated(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit project"
      description="Update project identity and description."
      onClose={onClose}
    >
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
      <ModalActions onClose={onClose} saving={saving} label="Save project" onSubmit={() => void submit()} />
    </ModalShell>
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
    <ModalShell
      title="Delete project"
      description="This removes the project, repositories, and all tasks inside it."
      onClose={onClose}
    >
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Delete {project.name}? This cannot be undone.
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" disabled={saving} onClick={() => void deleteProject()}>
          <Trash2 className="h-4 w-4" /> {saving ? "Deleting..." : "Delete project"}
        </Button>
      </div>
    </ModalShell>
  );
}

function ProjectMembersModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (project: Project) => void;
}) {
  const [memberIds, setMemberIds] = useState(project.memberIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const updated = (await api.updateProjectMembers(project.id, memberIds)) as Project;
      onSaved(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update project members.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Project members"
      description="Choose who can work in this project."
      onClose={onClose}
    >
      <div className="space-y-3">
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
              <span className="truncate">{user.name}</span>
            </label>
          ))}
        </div>
        {error && <div className="text-xs text-destructive">{error}</div>}
      </div>
      <ModalActions
        onClose={onClose}
        saving={saving}
        label="Save members"
        onSubmit={() => void submit()}
      />
    </ModalShell>
  );
}

function CreateRepositoryModal({
  projectId,
  onCreated,
  onClose,
}: {
  projectId: string;
  onCreated: (repository: Repository) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("oklch(0.66 0.19 275)");
  const [saving, setSaving] = useState(false);
  const swatches = [
    "oklch(0.66 0.19 275)",
    "oklch(0.7 0.17 220)",
    "oklch(0.72 0.15 155)",
    "oklch(0.78 0.14 75)",
    "oklch(0.7 0.18 340)",
  ];

  async function submit() {
    if (saving || !name.trim()) return;
    setSaving(true);
    const created = (await api.createRepository(projectId, { name, color })) as Repository;
    onCreated(created);
  }

  return (
    <ModalShell
      title="New repository"
      description="Create a place to group related tasks."
      onClose={onClose}
    >
      <Field label="Repository name">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          placeholder="API"
          className="rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Color">
        <div className="flex gap-2">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              onClick={() => setColor(swatch)}
              className={cn(
                "h-8 w-8 rounded-xl transition",
                color === swatch && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </Field>
      <ModalActions
        onClose={onClose}
        saving={saving}
        label="Create repository"
        onSubmit={() => void submit()}
      />
    </ModalShell>
  );
}

function EditRepositoryModal({
  repository,
  onUpdated,
  onClose,
}: {
  repository: Repository;
  onUpdated: (repository: Repository) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(repository.name);
  const [color, setColor] = useState(repository.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const swatches = [
    "oklch(0.66 0.19 275)",
    "oklch(0.7 0.17 220)",
    "oklch(0.72 0.15 155)",
    "oklch(0.78 0.14 75)",
    "oklch(0.7 0.18 340)",
  ];

  async function submit() {
    if (saving || !name.trim()) return;
    setSaving(true);
    setError("");

    try {
      const updated = (await api.updateRepository(repository.id, { name, color })) as Repository;
      onUpdated(updated);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update repository.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Edit repository"
      description="Rename this repository or adjust its board color."
      onClose={onClose}
    >
      <Field label="Repository name">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          className="rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Color">
        <div className="flex gap-2">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              onClick={() => setColor(swatch)}
              className={cn(
                "h-8 w-8 rounded-xl transition",
                color === swatch && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </Field>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <ModalActions onClose={onClose} saving={saving} label="Save repository" onSubmit={() => void submit()} />
    </ModalShell>
  );
}

function DeleteRepositoryModal({
  repository,
  taskCount,
  onDeleted,
  onClose,
}: {
  repository: Repository;
  taskCount: number;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function deleteRepository() {
    if (saving || taskCount > 0) return;
    setSaving(true);
    setError("");

    try {
      await api.deleteRepository(repository.id);
      onDeleted();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete repository.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Delete repository"
      description="Repositories can only be deleted when no tasks are assigned to them."
      onClose={onClose}
    >
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {taskCount > 0
          ? `${repository.name} has ${taskCount} task${taskCount === 1 ? "" : "s"}. Move or delete those tasks first.`
          : `Delete ${repository.name}? This cannot be undone.`}
      </div>
      {error && <div className="text-xs text-destructive">{error}</div>}
      <div className="-mx-5 -mb-5 mt-1 flex items-center justify-end gap-2 border-t border-border px-5 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={saving || taskCount > 0}
          onClick={() => void deleteRepository()}
        >
          <Trash2 className="h-4 w-4" /> {saving ? "Deleting..." : "Delete repository"}
        </Button>
      </div>
    </ModalShell>
  );
}

function CreateTaskModal({
  task,
  projectId,
  repositories,
  columns,
  defaultStatus,
  onCreated,
  onUpdated,
  onClose,
}: {
  task?: Task;
  projectId: string;
  repositories: Repository[];
  columns: Column[];
  defaultStatus: string;
  onCreated: (task: Task) => void;
  onUpdated?: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState(task?.priority ?? "medium");
  const [status, setStatus] = useState(task?.status ?? defaultStatus);
  const [deadline, setDeadline] = useState(task?.deadline ?? "");
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [repositoryId, setRepositoryId] = useState(task?.repositoryId ?? repositories[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? users[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving || !title.trim() || !repositoryId || !assigneeId) return;
    setSaving(true);

    const payload = {
      title,
      description,
      priority,
      deadline,
      repositoryId,
      assigneeId,
      projectId,
      status,
    };

    if (task) {
      const updated = (await api.updateTask(task.id, payload)) as Task;
      onUpdated?.({
        ...task,
        ...updated,
        labels: task.labels ?? [],
        subtasks: task.subtasks ?? [],
      });
    } else {
      const created = (await api.createTask(payload)) as Task;
      onCreated({ ...created, labels: created.labels ?? [], subtasks: created.subtasks ?? [] });
    }
  }

  return (
    <ModalShell
      title={task ? "Edit task" : "New task"}
      description={task ? "Update task details and placement." : "Add work to this project board."}
      onClose={onClose}
    >
      <Field label="Title">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          placeholder="Write a clear task title"
          className="rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Optional details"
          className="resize-none rounded-xl border-border bg-surface"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="rounded-xl border-border bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columns.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Repository">
          <Select value={repositoryId} onValueChange={setRepositoryId}>
            <SelectTrigger className="rounded-xl border-border bg-surface">
              <SelectValue placeholder="Choose repository" />
            </SelectTrigger>
            <SelectContent>
              {repositories.map((repository) => (
                <SelectItem key={repository.id} value={repository.id}>
                  {repository.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assignee">
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger className="rounded-xl border-border bg-surface">
              <SelectValue placeholder="Choose assignee" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as Task["priority"])}
          >
            <SelectTrigger className="rounded-xl border-border bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Deadline">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start rounded-xl border-border bg-surface font-normal"
              >
                <CalendarIcon className="h-4 w-4" />
                {deadline || "Pick deadline"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <UiCalendar
                mode="single"
                selected={deadlineDate}
                onSelect={(date) => {
                  setDeadlineDate(date);
                  if (date) setDeadline(format(date, "MMM d"));
                }}
              />
            </PopoverContent>
          </Popover>
        </Field>
      </div>
      <ModalActions
        onClose={onClose}
        saving={saving}
        label={task ? "Save task" : "Create task"}
        onSubmit={() => void submit()}
      />
    </ModalShell>
  );
}

function ColumnManagementModal({
  column,
  columns,
  onUpdated,
  onDeleted,
  onClose,
}: {
  column: Column;
  columns: Column[];
  onUpdated: (column: Column) => void;
  onDeleted: (deletedId: string, moveTo: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(column.name);
  const [hint, setHint] = useState(column.hint);
  const [moveTo, setMoveTo] = useState(columns.find((item) => item.id !== column.id)?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function updateColumn() {
    if (saving || !name.trim()) return;
    setSaving(true);
    const updated = (await api.updateColumn(column.id, { name, hint })) as Column;
    onUpdated(updated);
  }

  async function deleteColumn() {
    if (saving || !moveTo) return;
    setSaving(true);
    await api.deleteColumn(column.id, moveTo);
    onDeleted(column.id, moveTo);
  }

  return (
    <ModalShell
      title="Column management"
      description="Rename this column or move its tasks into another column before deleting it."
      onClose={onClose}
    >
      <Field label="Column name">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Hint">
        <Input
          value={hint}
          onChange={(event) => setHint(event.target.value)}
          className="rounded-xl border-border bg-surface"
        />
      </Field>
      <Field label="Move tasks to">
        <Select value={moveTo} onValueChange={setMoveTo}>
          <SelectTrigger className="rounded-xl border-border bg-surface">
            <SelectValue placeholder="Choose target column" />
          </SelectTrigger>
          <SelectContent>
            {columns
              .filter((item) => item.id !== column.id)
              .map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="-mx-5 -mb-5 mt-1 flex items-center justify-between gap-2 border-t border-border px-5 py-3">
        <Button
          variant="destructive"
          disabled={saving || !moveTo}
          onClick={() => void deleteColumn()}
        >
          <Trash2 className="h-4 w-4" /> Delete column
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void updateColumn()}>
            <Pencil className="h-4 w-4" /> Save column
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border bg-popover p-0 shadow-[var(--shadow-elevated)] sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function ModalActions({
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
    <DialogFooter className="-mx-5 -mb-5 mt-1 border-t border-border px-5 py-3">
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={saving} onClick={onSubmit}>
        {saving ? "Saving..." : label}
      </Button>
    </DialogFooter>
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

function EmptyColumn() {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border py-8 text-center">
      <div className="text-2xl opacity-50">*</div>
      <div className="mt-1 text-xs text-muted-foreground">Drop a task here</div>
    </div>
  );
}

function colColor(id: string) {
  const map: Record<string, string> = {
    backlog: "oklch(0.6 0.02 260)",
    todo: "oklch(0.72 0.13 230)",
    in_progress: "oklch(0.66 0.19 275)",
    testing: "oklch(0.78 0.14 75)",
    done: "oklch(0.72 0.15 155)",
  };
  return map[id] ?? "oklch(0.66 0.19 275)";
}
