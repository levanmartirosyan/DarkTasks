import { format } from "date-fns";
import { CalendarIcon, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "@/lib/api-client";
import { defaultColumns, projects, users, type Task } from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import { Calendar as UiCalendar } from "@/components/ui/calendar";
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

const monthLookup: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

function parseDeadline(value: string) {
  const [month, rawDay] = value.split(" ");
  const day = Number.parseInt(rawDay, 10);
  if (!(month in monthLookup) || Number.isNaN(day)) return undefined;
  return new Date(new Date().getFullYear(), monthLookup[month], day);
}

export function TaskEditModal({
  task,
  onUpdated,
  onClose,
}: {
  task: Task;
  onUpdated: (task: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [projectId, setProjectId] = useState(task.projectId);
  const [repositoryId, setRepositoryId] = useState(task.repositoryId);
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline);
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(() =>
    parseDeadline(task.deadline),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? projects[0],
    [projectId],
  );
  const repositories = selectedProject?.repositories ?? [];

  async function submit() {
    if (saving || !title.trim() || !projectId || !repositoryId || !assigneeId) return;

    setSaving(true);
    setError("");

    try {
      const updated = (await api.updateTask(task.id, {
        title,
        description,
        projectId,
        repositoryId,
        status,
        assigneeId,
        priority,
        deadline,
      })) as Task;

      onUpdated({
        ...task,
        ...updated,
        labels: task.labels ?? [],
        subtasks: task.subtasks ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-border bg-popover p-0 shadow-[var(--shadow-elevated)] sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">Edit task</DialogTitle>
          <DialogDescription className="text-xs">
            Update task details, owner, placement, and deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <Field label="Title">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              className="rounded-xl border-border bg-surface"
            />
          </Field>

          <Field label="Description">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="resize-none rounded-xl border-border bg-surface"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Project">
              <Select
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value);
                  const nextProject = projects.find((project) => project.id === value);
                  setRepositoryId(nextProject?.repositories[0]?.id ?? "");
                }}
              >
                <SelectTrigger className="rounded-xl border-border bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
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

            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="rounded-xl border-border bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {defaultColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.name}
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
                      {user.username || user.name}
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

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !title.trim() || !repositoryId || !assigneeId} onClick={() => void submit()}>
            <Pencil className="h-4 w-4" />
            {saving ? "Saving..." : "Save task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
