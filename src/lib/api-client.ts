import { getSessionToken } from "./auth-session";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8787/api";
export const API_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15_000);
const BOOTSTRAP_TIMEOUT_MS = Number(import.meta.env.VITE_BOOTSTRAP_TIMEOUT_MS ?? 15_000);

function authHeaders(): Record<string, string> {
  const token = getSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("VITE_API_BASE_URL is not configured.");
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const abortRequest = () => controller.abort();

  if (init?.signal?.aborted) {
    controller.abort();
  } else {
    init?.signal?.addEventListener("abort", abortRequest, { once: true });
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...init?.headers,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`API request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw new Error("API server is not running. Start it with bun run dev or bun run api:dev.");
  } finally {
    globalThis.clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abortRequest);
  }

  if (!response.ok) {
    let message = `API request failed: ${response.status} ${response.statusText}`;

    try {
      const data = (await response.clone().json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep the status message when the server did not return JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const api = {
  login: (credentials: { username: string; password: string }) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),
  bootstrap: (timeoutMs = BOOTSTRAP_TIMEOUT_MS) => request("/bootstrap", undefined, timeoutMs),
  users: () => request("/users"),
  createUser: (user: { name: string; email: string; role: "Admin" | "User"; password?: string }) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(user),
    }),
  updateUser: (
    id: string,
    user: { name: string; email: string; role: "Admin" | "User" },
  ) =>
    request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(user),
    }),
  deleteUser: (id: string) =>
    request(`/users/${id}`, {
      method: "DELETE",
    }),
  profile: () => request("/profile"),
  updateProfile: (profile: { name: string; email: string }) =>
    request("/profile", {
      method: "PATCH",
      body: JSON.stringify(profile),
    }),
  changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
    request("/profile/password", {
      method: "PATCH",
      body: JSON.stringify(passwords),
    }),
  projects: () => request("/projects"),
  createProject: (project: {
    name: string;
    description: string;
    icon: string;
    memberIds: string[];
    repositories: { name: string; color?: string }[];
  }) =>
    request("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    }),
  project: (slug: string) => request(`/projects/${slug}`),
  updateProject: (projectId: string, project: { name: string; description: string; icon: string }) =>
    request(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(project),
    }),
  deleteProject: (projectId: string) =>
    request(`/projects/${projectId}`, {
      method: "DELETE",
    }),
  updateProjectMembers: (projectId: string, memberIds: string[]) =>
    request(`/projects/${projectId}/members`, {
      method: "PATCH",
      body: JSON.stringify({ memberIds }),
    }),
  createRepository: (projectId: string, repository: { name: string; color?: string }) =>
    request(`/projects/${projectId}/repositories`, {
      method: "POST",
      body: JSON.stringify(repository),
    }),
  updateRepository: (repositoryId: string, repository: { name: string; color?: string }) =>
    request(`/repositories/${repositoryId}`, {
      method: "PATCH",
      body: JSON.stringify(repository),
    }),
  deleteRepository: (repositoryId: string) =>
    request(`/repositories/${repositoryId}`, {
      method: "DELETE",
    }),
  tasks: (params?: { projectId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.projectId) query.set("projectId", params.projectId);
    if (params?.status) query.set("status", params.status);
    const suffix = query.size ? `?${query.toString()}` : "";
    return request(`/tasks${suffix}`);
  },
  createTask: (task: {
    title: string;
    description: string;
    status: string;
    priority: string;
    deadline: string;
    assigneeId: string;
    repositoryId: string;
    projectId: string;
    codePrefix?: string;
  }) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),
  updateTask: (
    id: string,
    task: {
      title: string;
      description: string;
      status: string;
      priority: string;
      deadline: string;
      assigneeId: string;
      repositoryId: string;
      projectId: string;
    },
  ) =>
    request(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(task),
    }),
  updateTaskStatus: (id: string, status: string) =>
    request(`/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteTask: (id: string) =>
    request(`/tasks/${id}`, {
      method: "DELETE",
    }),
  createTaskComment: (taskId: string, body: string) =>
    request(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  createColumn: (column: { name: string; hint?: string }) =>
    request("/columns", {
      method: "POST",
      body: JSON.stringify(column),
    }),
  updateColumn: (id: string, column: { name: string; hint?: string }) =>
    request(`/columns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(column),
    }),
  deleteColumn: (id: string, moveTo: string) =>
    request(`/columns/${id}?moveTo=${encodeURIComponent(moveTo)}`, {
      method: "DELETE",
    }),
  activity: () => request("/activity"),
  notifications: () => request("/notifications"),
  markNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "PATCH",
    }),
};
