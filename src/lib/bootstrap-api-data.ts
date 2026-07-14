import { API_BASE_URL, api } from "./api-client";
import {
  activity,
  currentUser,
  defaultColumns,
  notifications,
  projects,
  replaceArray,
  tasks,
  users,
  type Project,
  type Task,
  type User,
} from "./app-data";

type BootstrapData = {
  users: User[];
  currentUser: User | null;
  projects: Project[];
  defaultColumns: typeof defaultColumns;
  tasks: Task[];
  activity: typeof activity;
  notifications: typeof notifications;
};

let bootstrapPromise: Promise<void> | null = null;

async function loadBootstrapData(timeoutMs?: number) {
  if (!API_BASE_URL) return;

  const data = (await api.bootstrap(timeoutMs)) as BootstrapData;

  replaceArray(users, data.users);
  if (data.currentUser) Object.assign(currentUser, data.currentUser);
  replaceArray(projects, data.projects);
  replaceArray(defaultColumns, data.defaultColumns);
  replaceArray(tasks, data.tasks);
  replaceArray(activity, data.activity);
  replaceArray(notifications, data.notifications);
}

export async function bootstrapApiData({ timeoutMs }: { timeoutMs?: number } = {}) {
  bootstrapPromise ??= loadBootstrapData(timeoutMs).finally(() => {
    bootstrapPromise = null;
  });

  try {
    await bootstrapPromise;
  } catch (error) {
    console.error("Database bootstrap failed.", error);
    throw error;
  }
}
