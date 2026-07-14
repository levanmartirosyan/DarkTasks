import type { InferSelectModel } from "drizzle-orm";

import {
  activityEvents,
  boardColumns,
  labels,
  notifications,
  projectMembers,
  projects,
  repositories,
  subtasks,
  taskComments,
  tasks,
  users,
} from "@/db/schema";

type User = InferSelectModel<typeof users>;
type Project = InferSelectModel<typeof projects>;
type Repository = InferSelectModel<typeof repositories>;
type ProjectMember = InferSelectModel<typeof projectMembers>;
type Task = InferSelectModel<typeof tasks>;
type Label = InferSelectModel<typeof labels>;
type Subtask = InferSelectModel<typeof subtasks>;
type TaskComment = InferSelectModel<typeof taskComments>;
type TaskLabel = { taskId: string; labelId: string };
type Activity = InferSelectModel<typeof activityEvents>;
type Notification = InferSelectModel<typeof notifications>;
type Column = InferSelectModel<typeof boardColumns>;

export function serializeProjects(
  rows: Project[],
  repoRows: Repository[],
  memberRows: ProjectMember[],
  taskRows: Task[] = [],
) {
  return rows.map((project) => {
    const projectTasks = taskRows.filter((task) => task.projectId === project.id);
    const doneTasks = projectTasks.filter((task) => task.status === "done").length;
    const taskCount = projectTasks.length || project.taskCount;

    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      icon: project.icon,
      progress: taskCount > 0 ? Math.round((doneTasks / taskCount) * 100) : project.progress,
      taskCount,
      lastActivity: project.lastActivity,
      memberIds: memberRows
        .filter((member) => member.projectId === project.id)
        .map((member) => member.userId),
      repositories: repoRows
        .filter((repo) => repo.projectId === project.id)
        .map((repo) => ({ id: repo.id, name: repo.name, color: repo.color })),
    };
  });
}

export function serializeTasks(
  rows: Task[],
  labelRows: Label[],
  taskLabelRows: TaskLabel[],
  subtaskRows: Subtask[],
  commentRows: TaskComment[] = [],
) {
  return rows.map((task) => ({
    id: task.id,
    code: task.code,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    deadline: task.deadline,
    assigneeId: task.assigneeId,
    creatorId: task.creatorId,
    createdAt: task.createdAtLabel,
    repositoryId: task.repositoryId,
    projectId: task.projectId,
    activity: task.activity,
    labels: taskLabelRows
      .filter((join) => join.taskId === task.id)
      .map((join) => labelRows.find((label) => label.id === join.labelId))
      .filter((label): label is Label => Boolean(label))
      .map((label) => ({ name: label.name, color: label.color })),
    subtasks: subtaskRows
      .filter((subtask) => subtask.taskId === task.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((subtask) => ({ title: subtask.title, done: subtask.done })),
    comments: commentRows
      .filter((comment) => comment.taskId === task.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((comment) => ({
        id: comment.id,
        taskId: comment.taskId,
        userId: comment.userId,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        time: formatRelativeTime(comment.createdAt),
      })),
  }));
}

export function serializeTaskComment(comment: TaskComment) {
  return {
    id: comment.id,
    taskId: comment.taskId,
    userId: comment.userId,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    time: formatRelativeTime(comment.createdAt),
  };
}

export function serializeUsers(rows: User[]) {
  return rows.map(({ createdAt, updatedAt, passwordHash, ...user }) => user);
}

export function serializeColumns(rows: Column[]) {
  return rows
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder, ...column }) => column);
}

export function serializeActivity(rows: Activity[]) {
  return rows.map(({ userId, ...activity }) => ({ ...activity, user: userId }));
}

export function serializeNotifications(rows: Notification[]) {
  return rows.map(({ createdAt, userId, ...notification }) => notification);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
