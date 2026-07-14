export type Priority = "low" | "medium" | "high" | "urgent";
export type User = {
  id: string;
  name: string;
  avatar: string;
  role: "Admin" | "User";
  email: string;
  initials: string;
  color: string;
};

export type Repository = { id: string; name: string; color: string };
export type Project = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  progress: number;
  taskCount: number;
  memberIds: string[];
  lastActivity: string;
  repositories: Repository[];
};

export type Column = { id: string; name: string; hint: string };
export type Task = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  deadline: string;
  assigneeId: string;
  creatorId: string;
  createdAt: string;
  labels: { name: string; color: string }[];
  repositoryId: string;
  projectId: string;
  activity: number;
  subtasks?: { title: string; done: boolean }[];
  comments?: TaskComment[];
};

export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: string;
  time: string;
};

export type ActivityEvent = {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  time: string;
  read: boolean;
};

export const users: User[] = [];
export const currentUser: User = {
  id: "",
  name: "",
  avatar: "",
  role: "User",
  email: "",
  initials: "",
  color: "oklch(0.66 0.19 275)",
};
export const projects: Project[] = [];
export const defaultColumns: Column[] = [];
export const tasks: Task[] = [];
export const activity: ActivityEvent[] = [];
export const notifications: NotificationItem[] = [];

export const priorityMeta: Record<
  Priority,
  { label: string; color: string; bg: string; icon: string }
> = {
  urgent: { label: "Urgent", color: "oklch(0.75 0.18 22)", bg: "oklch(0.65 0.19 22 / 0.15)", icon: "!" },
  high: { label: "High", color: "oklch(0.82 0.15 45)", bg: "oklch(0.78 0.14 45 / 0.15)", icon: "^" },
  medium: { label: "Medium", color: "oklch(0.82 0.13 230)", bg: "oklch(0.72 0.13 230 / 0.15)", icon: "-" },
  low: { label: "Low", color: "oklch(0.7 0.02 260)", bg: "oklch(0.5 0.02 260 / 0.15)", icon: "v" },
};

export function userById(id: string) {
  return users.find((user) => user.id === id) ?? users[0] ?? currentUser;
}

export function projectById(id: string) {
  return projects.find((project) => project.id === id);
}

export function projectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}

export function repoById(projectId: string, repoId: string) {
  return projectById(projectId)?.repositories.find((repo) => repo.id === repoId);
}

export function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next);
}
