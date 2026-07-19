import {
  Calendar,
  Clock,
  Flag,
  Folder,
  GitBranch,
  Paperclip,
  Pencil,
  Send,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { UserAvatar } from "@/components/app/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import {
  currentUser,
  defaultColumns,
  priorityMeta,
  projectById,
  userById,
  type Task,
  type TaskComment,
} from "@/lib/app-data";
import { cn } from "@/lib/utils";

export function TaskDetailSheet({
  task,
  onClose,
  onEdit,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    if (!task) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [task]);

  useEffect(() => {
    setCommentText("");
    setComments(task?.comments ?? []);
    setCommentError("");
  }, [task]);

  async function submitComment() {
    const body = commentText.trim();
    if (!task || savingComment || !body) return;

    setSavingComment(true);
    setCommentError("");

    try {
      const created = (await api.createTaskComment(task.id, body)) as TaskComment;
      const nextComments = [...comments, created];
      task.comments = nextComments;
      setComments(nextComments);
      setCommentText("");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Could not add comment.");
    } finally {
      setSavingComment(false);
    }
  }

  if (!task) return null;

  const assignee = userById(task.assigneeId);
  const creator = userById(task.creatorId);
  const project = projectById(task.projectId);
  const repo = project?.repositories.find((r) => r.id === task.repositoryId);
  const p = priorityMeta[task.priority];
  const status = defaultColumns.find((column) => column.id === task.status);
  const activity = [{ user: creator, action: "created this task", time: task.createdAt }];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col border-l border-border bg-background shadow-[var(--shadow-elevated)] animate-scale-in">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <span className="rounded-md bg-surface-2 px-2 py-1 text-[11px] font-mono text-muted-foreground">
            {task.code}
          </span>
          <span className="text-xs text-muted-foreground">in</span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: repo?.color }} />
            <span className="font-medium">{project?.name ?? "Project"}</span>
            <span className="text-muted-foreground">/ {repo?.name}</span>
          </span>
          <div className="ml-auto flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(task)}
                className="h-8 w-8 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(task)}
                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_260px]">
          <div className="overflow-y-auto px-6 py-6">
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">{task.title}</h1>

            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Description
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{task.description}</p>
            </div>

            {task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Subtasks - {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                  {task.subtasks.map((s, i) => (
                    <label
                      key={`${s.title}-${i}`}
                      className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0 cursor-pointer hover:bg-surface-2 transition"
                    >
                      <Checkbox defaultChecked={s.done} />
                      <span className={cn("text-sm", s.done && "text-muted-foreground line-through")}>
                        {s.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Attachments
              </div>
              <div className="rounded-xl border border-dashed border-border bg-surface px-3 py-6 text-center text-xs text-muted-foreground">
                <Paperclip className="mx-auto mb-2 h-4 w-4" />
                No attachments yet.
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Activity
              </div>
              <div className="relative space-y-4 pl-6">
                <div className="absolute left-[10px] top-1 bottom-1 w-px bg-border" />
                {activity.map((item, index) => (
                  <div key={index} className="relative">
                    <div className="absolute -left-6 top-0.5">
                      <UserAvatar user={item.user} size={20} ring />
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{item.user.username || item.user.name}</span>{" "}
                      <span className="text-muted-foreground">{item.action}</span>
                      <span className="text-muted-foreground"> - {item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Comments
              </div>
              {comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-muted-foreground">
                  No comments yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const author = userById(comment.userId);
                    return (
                      <div
                        key={comment.id}
                        className="flex gap-3 rounded-xl border border-border bg-surface px-3.5 py-3"
                      >
                        <UserAvatar user={author} size={26} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium">{author.name}</span>
                            <span className="text-muted-foreground">{comment.time}</span>
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                            {comment.body}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-surface p-3">
              <div className="flex gap-3">
                <UserAvatar user={currentUser} size={26} />
                <div className="min-w-0 flex-1">
                  <Textarea
                    rows={2}
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Write a comment..."
                    className="min-h-0 resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                  />
                  {commentError && <div className="mt-2 text-xs text-destructive">{commentError}</div>}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-[11px] text-muted-foreground">Text comments only</div>
                    <Button
                      size="sm"
                      disabled={savingComment || !commentText.trim()}
                      onClick={() => void submitComment()}
                      className="h-8 rounded-lg gradient-primary px-3 text-xs text-primary-foreground hover:opacity-95 disabled:opacity-60"
                    >
                      <Send className="h-3 w-3" /> {savingComment ? "Posting..." : "Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="hidden overflow-y-auto border-l border-border bg-surface/30 md:block">
            <div className="space-y-1 p-5">
              <Meta icon={<Flag className="h-3.5 w-3.5" />} label="Status">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {status?.name ?? task.status}
                </span>
              </Meta>
              <Meta icon={<Flag className="h-3.5 w-3.5" />} label="Priority">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium"
                  style={{ background: p.bg, color: p.color }}
                >
                  {p.icon} {p.label}
                </span>
              </Meta>
              <Meta icon={<User className="h-3.5 w-3.5" />} label="Assignee">
                <div className="flex items-center gap-2">
                  <UserAvatar user={assignee} size={20} />
                  <span className="text-xs">{assignee.name}</span>
                </div>
              </Meta>
              <Meta icon={<Calendar className="h-3.5 w-3.5" />} label="Deadline">
                <span className="text-xs">{task.deadline}</span>
              </Meta>
              <Meta icon={<Folder className="h-3.5 w-3.5" />} label="Project">
                <span className="text-xs">{project?.name ?? "Project"}</span>
              </Meta>
              <Meta icon={<GitBranch className="h-3.5 w-3.5" />} label="Repository">
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: repo?.color }} />
                  {repo?.name}
                </span>
              </Meta>
              <Meta icon={<User className="h-3.5 w-3.5" />} label="Created by">
                <div className="flex items-center gap-2">
                  <UserAvatar user={creator} size={20} />
                  <span className="text-xs">{creator.name}</span>
                </div>
              </Meta>
              <Meta icon={<Clock className="h-3.5 w-3.5" />} label="Created">
                <span className="text-xs">{task.createdAt}</span>
              </Meta>
              <Meta icon={<Tag className="h-3.5 w-3.5" />} label="Labels">
                <div className="flex flex-wrap gap-1">
                  {task.labels.map((label) => (
                    <span
                      key={label.name}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: label.color }} />
                      {label.name}
                    </span>
                  ))}
                </div>
              </Meta>
            </div>
          </aside>
        </div>
      </aside>
    </>
  );
}

function Meta({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/50 transition">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground pt-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
