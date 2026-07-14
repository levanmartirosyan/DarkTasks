import "dotenv/config";

import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { desc, eq, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { cors } from "hono/cors";

import { db } from "@/db/client";
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
  taskLabels,
  tasks,
  userSessions,
  users,
} from "@/db/schema";
import {
  createSessionToken,
  hashPassword,
  hashSessionToken,
  sessionExpiry,
  verifyPassword,
} from "./auth";
import {
  serializeActivity,
  serializeColumns,
  serializeNotifications,
  serializeProjects,
  serializeTaskComment,
  serializeTasks,
  serializeUsers,
} from "./serialize";

const app = new Hono();
const api = new Hono();
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS ?? 15_000);
const colors = [
  "oklch(0.66 0.19 275)",
  "oklch(0.7 0.17 220)",
  "oklch(0.72 0.15 155)",
  "oklch(0.78 0.14 75)",
  "oklch(0.7 0.18 340)",
];

function isDuplicateTaskCodeError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as {
    code?: string;
    constraint_name?: string;
    cause?: { code?: string; constraint_name?: string };
  };

  return (
    record.code === "23505" ||
    record.constraint_name === "tasks_code_unique" ||
    record.cause?.code === "23505" ||
    record.cause?.constraint_name === "tasks_code_unique"
  );
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `project-${Date.now()}`;
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

async function currentUserFromRequest(c: Context) {
  const header = c.req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (token) {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.tokenHash, hashSessionToken(token)))
      .limit(1);

    if (session && session.expiresAt > new Date()) {
      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (user) return user;
    }
  }

  const fallbackId = process.env.CURRENT_USER_ID;
  if (fallbackId) {
    const [user] = await db.select().from(users).where(eq(users.id, fallbackId)).limit(1);
    if (user) return user;
  }

  const [firstUser] = await db.select().from(users).limit(1);
  return firstUser ?? null;
}

async function nextTaskCode(prefix: string) {
  const taskRows = await db.select({ code: tasks.code }).from(tasks);
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
  const highest = taskRows.reduce((max, task) => {
    const match = task.code.match(pattern);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

async function addActivity(userId: string | undefined, action: string, target: string) {
  if (!userId) return;

  await db.insert(activityEvents).values({
    id: randomUUID(),
    userId,
    action,
    target,
    time: "Just now",
  });
}

app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()) ?? "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: error.message || "Internal server error" }, 500);
});

api.use("*", async (c, next) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      next(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("API_TIMEOUT")), API_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "API_TIMEOUT") {
      return c.json(
        { error: `Request timed out after ${Math.round(API_TIMEOUT_MS / 1000)} seconds` },
        504,
      );
    }

    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
});

async function getBootstrapData(currentUserId?: string) {
  const userRows = await db.select().from(users);
  const projectRows = await db.select().from(projects);
  const projectMemberRows = await db.select().from(projectMembers);
  const repositoryRows = await db.select().from(repositories);
  const columnRows = await db.select().from(boardColumns);
  const taskRows = await db.select().from(tasks);
  const labelRows = await db.select().from(labels);
  const taskLabelRows = await db.select().from(taskLabels);
  const subtaskRows = await db.select().from(subtasks);
  const commentRows = await db.select().from(taskComments);
  const activityRows = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt));
  const notificationRows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));

  const serializedUsers = serializeUsers(userRows);

  return {
    users: serializedUsers,
    currentUser:
      serializedUsers.find((user) => user.id === currentUserId) ??
      serializedUsers.find((user) => user.id === process.env.CURRENT_USER_ID) ??
      serializedUsers[0] ??
      null,
    projects: serializeProjects(projectRows, repositoryRows, projectMemberRows, taskRows),
    defaultColumns: serializeColumns(columnRows),
    tasks: serializeTasks(taskRows, labelRows, taskLabelRows, subtaskRows, commentRows),
    activity: serializeActivity(activityRows),
    notifications: serializeNotifications(notificationRows),
  };
}

api.get("/health", (c) => c.json({ ok: true, service: "darktasks-api" }));

api.get("/capabilities", (c) =>
  c.json({
    ok: true,
    comments: true,
  }),
);

api.get("/ready", async (c) => {
  await db.execute(sql`select 1`);
  return c.json({ ok: true, database: "ready" });
});

api.post("/auth/login", async (c) => {
  const body = (await c.req.json()) as { username?: string; password?: string };
  const username = body.username?.trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, username.toLowerCase())))
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const token = createSessionToken();

  await db.insert(userSessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: sessionExpiry(),
  });

  return c.json({
    token,
    user: serializeUsers([user])[0],
  });
});

api.get("/bootstrap", async (c) => {
  const user = await currentUserFromRequest(c);
  return c.json(await getBootstrapData(user?.id));
});

api.get("/users", async (c) => c.json(serializeUsers(await db.select().from(users))));

api.post("/users", async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    email?: string;
    role?: "Admin" | "User";
    password?: string;
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) return c.json({ error: "Name and email are required" }, 400);

  const usernameBase = email.split("@")[0]?.replace(/[^a-z0-9_.-]/gi, "").toLowerCase() || "user";
  const id = randomUUID();

  const [created] = await db
    .insert(users)
    .values({
      id,
      username: `${usernameBase}-${id.slice(0, 6)}`,
      name,
      email,
      role: body.role ?? "User",
      passwordHash: hashPassword(body.password || "DarkTasks123!"),
      initials: initials(name),
      color: colors[Math.floor(Math.random() * colors.length)],
    })
    .returning();

  return c.json(serializeUsers([created])[0], 201);
});

api.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as {
    name?: string;
    email?: string;
    role?: "Admin" | "User";
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) return c.json({ error: "Name and email are required" }, 400);

  const [updated] = await db
    .update(users)
    .set({
      name,
      email,
      role: body.role ?? "User",
      initials: initials(name),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) return c.json({ error: "User not found" }, 404);
  return c.json(serializeUsers([updated])[0]);
});

api.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  const currentUser = await currentUserFromRequest(c);

  if (currentUser?.id === id) return c.json({ error: "You cannot delete your own account" }, 400);

  await db.delete(users).where(eq(users.id, id));
  return c.json({ ok: true });
});

api.get("/profile", async (c) => {
  const user = await currentUserFromRequest(c);
  if (!user) return c.json({ error: "User not found" }, 404);

  return c.json(serializeUsers([user])[0]);
});

api.patch("/profile", async (c) => {
  const user = await currentUserFromRequest(c);
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = (await c.req.json()) as { name?: string; email?: string };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) return c.json({ error: "Name and email are required" }, 400);

  const [updated] = await db
    .update(users)
    .set({ name, email, initials: initials(name), updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  return c.json(serializeUsers([updated])[0]);
});

api.patch("/profile/password", async (c) => {
  const user = await currentUserFromRequest(c);
  if (!user) return c.json({ error: "User not found" }, 404);

  const body = (await c.req.json()) as { currentPassword?: string; newPassword?: string };
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";

  if (newPassword.length < 6) {
    return c.json({ error: "New password must be at least 6 characters" }, 400);
  }

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return c.json({ error: "Current password is incorrect" }, 401);
  }

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return c.json({ ok: true });
});

api.get("/projects", async (c) => {
  const projectRows = await db.select().from(projects);
  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const taskRows = await db.select().from(tasks);

  return c.json(serializeProjects(projectRows, repositoryRows, memberRows, taskRows));
});

api.post("/projects", async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    description?: string;
    icon?: string;
    memberIds?: string[];
    repositories?: { name: string; color?: string }[];
  };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Project name is required" }, 400);

  const id = randomUUID();
  const slug = slugify(name);
  const currentUser = await currentUserFromRequest(c);
  const memberIds = Array.from(new Set([currentUser?.id, ...(body.memberIds ?? [])].filter(Boolean)));
  const repoInputs = (body.repositories ?? []).filter((repo) => repo.name.trim());
  const repoRows = repoInputs.length
    ? repoInputs.map((repo, index) => ({
        id: randomUUID(),
        projectId: id,
        name: repo.name.trim(),
        color: repo.color || colors[index % colors.length],
      }))
    : [
        {
          id: randomUUID(),
          projectId: id,
          name: "General",
          color: colors[0],
        },
      ];

  const [created] = await db
    .insert(projects)
    .values({
      id,
      slug,
      name,
      description: body.description?.trim() ?? "",
      icon: body.icon?.trim() ?? "D",
      lastActivity: "Just now",
    })
    .returning();

  if (memberIds.length > 0) {
    await db
      .insert(projectMembers)
      .values(memberIds.map((userId) => ({ projectId: id, userId })))
      .onConflictDoNothing();
  }

  await db.insert(repositories).values(repoRows);
  await addActivity(currentUser?.id, "created project", name);

  return c.json(serializeProjects([created], repoRows, memberIds.map((userId) => ({ projectId: id, userId })))[0], 201);
});

api.get("/projects/:slug", async (c) => {
  const slug = c.req.param("slug");
  const projectRows = await db.select().from(projects).where(eq(projects.slug, slug));
  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const project = serializeProjects(projectRows, repositoryRows, memberRows)[0];

  if (!project) return c.json({ error: "Project not found" }, 404);
  return c.json(project);
});

api.patch("/projects/:id/members", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json()) as { memberIds?: string[] };
  const memberIds = Array.from(new Set(body.memberIds ?? [])).filter(Boolean);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return c.json({ error: "Project not found" }, 404);

  await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));

  if (memberIds.length > 0) {
    await db
      .insert(projectMembers)
      .values(memberIds.map((userId) => ({ projectId, userId })))
      .onConflictDoNothing();
  }

  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const taskRows = await db.select().from(tasks);
  const user = await currentUserFromRequest(c);
  await addActivity(user?.id, "updated project members", project.name);

  return c.json(serializeProjects([project], repositoryRows, memberRows, taskRows)[0]);
});

api.post("/projects/:id/repositories", async (c) => {
  const projectId = c.req.param("id");
  const body = (await c.req.json()) as { name?: string; color?: string };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Repository name is required" }, 400);

  const [created] = await db
    .insert(repositories)
    .values({
      id: randomUUID(),
      projectId,
      name,
      color: body.color || colors[Math.floor(Math.random() * colors.length)],
    })
    .returning();
  const user = await currentUserFromRequest(c);
  await addActivity(user?.id, "created repository", name);

  return c.json({ id: created.id, name: created.name, color: created.color }, 201);
});

api.get("/tasks", async (c) => {
  const taskRows = await db.select().from(tasks);
  const labelRows = await db.select().from(labels);
  const taskLabelRows = await db.select().from(taskLabels);
  const subtaskRows = await db.select().from(subtasks);
  const commentRows = await db.select().from(taskComments);

  const projectId = c.req.query("projectId");
  const status = c.req.query("status");
  const rows = taskRows.filter(
    (task) => (!projectId || task.projectId === projectId) && (!status || task.status === status),
  );

  return c.json(serializeTasks(rows, labelRows, taskLabelRows, subtaskRows, commentRows));
});

api.post("/tasks", async (c) => {
  const body = await c.req.json();
  const user = await currentUserFromRequest(c);
  const title = body.title?.trim();

  if (!title) return c.json({ error: "Task title is required" }, 400);

  const codePrefix = body.codePrefix ?? "DT";
  const providedCode = body.code?.trim();
  let created: typeof tasks.$inferSelect | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = providedCode || (await nextTaskCode(codePrefix));

    try {
      [created] = await db
        .insert(tasks)
        .values({
          id: randomUUID(),
          code,
          title,
          description: body.description ?? "",
          status: body.status ?? "backlog",
          priority: body.priority ?? "medium",
          deadline: body.deadline ?? "",
          assigneeId: body.assigneeId,
          creatorId: user?.id ?? body.creatorId,
          createdAtLabel: "Today",
          repositoryId: body.repositoryId,
          projectId: body.projectId,
          activity: body.activity ?? 0,
        })
        .returning();
      break;
    } catch (error) {
      if (providedCode || !isDuplicateTaskCodeError(error) || attempt === 2) throw error;
    }
  }

  if (!created) return c.json({ error: "Could not create task" }, 500);
  await addActivity(user?.id, "created task", title);

  return c.json(serializeTasks([created], [], [], [])[0], 201);
});

api.patch("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const title = body.title?.trim();

  if (!title) return c.json({ error: "Task title is required" }, 400);

  const [updated] = await db
    .update(tasks)
    .set({
      title,
      description: body.description ?? "",
      status: body.status,
      priority: body.priority,
      deadline: body.deadline ?? "",
      assigneeId: body.assigneeId,
      repositoryId: body.repositoryId,
      projectId: body.projectId,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return c.json({ error: "Task not found" }, 404);
  const user = await currentUserFromRequest(c);
  await addActivity(user?.id, "updated task", title);
  return c.json(serializeTasks([updated], [], [], [])[0]);
});

api.patch("/tasks/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { status?: string };

  if (!body.status) return c.json({ error: "Status is required" }, 400);

  const [updated] = await db
    .update(tasks)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return c.json({ error: "Task not found" }, 404);
  const user = await currentUserFromRequest(c);
  await addActivity(user?.id, `moved task to ${body.status}`, updated.title);
  return c.json({ ok: true, task: updated });
});

api.post("/tasks/:id/comments", async (c) => {
  const taskId = c.req.param("id");
  const body = (await c.req.json()) as { body?: string };
  const text = body.body?.trim();

  if (!text) return c.json({ error: "Comment is required" }, 400);

  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  if (!task) return c.json({ error: "Task not found" }, 404);

  const user = await currentUserFromRequest(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const [created] = await db
    .insert(taskComments)
    .values({
      id: randomUUID(),
      taskId,
      userId: user.id,
      body: text,
    })
    .returning();

  await addActivity(user.id, "commented on task", task.title);

  return c.json(serializeTaskComment(created), 201);
});

api.post("/columns", async (c) => {
  const body = (await c.req.json()) as { name?: string; hint?: string };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Column name is required" }, 400);

  const rows = await db.select().from(boardColumns);
  const [created] = await db
    .insert(boardColumns)
    .values({
      id: slugify(name),
      name,
      hint: body.hint?.trim() ?? "",
      sortOrder: rows.length,
    })
    .returning();

  return c.json(serializeColumns([created])[0], 201);
});

api.patch("/columns/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { name?: string; hint?: string };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Column name is required" }, 400);

  const [updated] = await db
    .update(boardColumns)
    .set({ name, hint: body.hint?.trim() ?? "" })
    .where(eq(boardColumns.id, id))
    .returning();

  if (!updated) return c.json({ error: "Column not found" }, 404);
  return c.json(serializeColumns([updated])[0]);
});

api.delete("/columns/:id", async (c) => {
  const id = c.req.param("id");
  const moveTo = c.req.query("moveTo") || "backlog";

  if (id === moveTo) return c.json({ error: "Move target must be a different column" }, 400);

  await db.update(tasks).set({ status: moveTo, updatedAt: new Date() }).where(eq(tasks.status, id));
  await db.delete(boardColumns).where(eq(boardColumns.id, id));

  return c.json({ ok: true });
});

api.delete("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  await db.delete(tasks).where(eq(tasks.id, id));
  const user = await currentUserFromRequest(c);
  await addActivity(user?.id, "deleted task", task?.title ?? "task");
  return c.json({ ok: true });
});

api.get("/activity", async (c) =>
  c.json(
    serializeActivity(
      await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt)),
    ),
  ),
);

api.get("/notifications", async (c) =>
  c.json(
    serializeNotifications(
      await db.select().from(notifications).orderBy(desc(notifications.createdAt)),
    ),
  ),
);

api.patch("/notifications/read-all", async (c) => {
  const user = await currentUserFromRequest(c);

  if (user) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(or(eq(notifications.userId, user.id), isNull(notifications.userId)));
  } else {
    await db.update(notifications).set({ read: true });
  }

  return c.json({ ok: true });
});

app.route("/api", api);

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.log(`DarkTasks API listening on http://localhost:${info.port}`);
});
