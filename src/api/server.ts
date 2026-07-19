import "dotenv/config";

import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
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

type CurrentUser = typeof users.$inferSelect;

function isAdmin(user: CurrentUser | null | undefined) {
  return user?.role === "Admin";
}

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

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const record = error as {
    code?: string;
    constraint_name?: string;
    cause?: { code?: string; constraint_name?: string };
  };

  return record.code === "23505" || record.cause?.code === "23505";
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

function usernameFromEmail(email: string, fallbackId: string) {
  const base =
    email
      .split("@")[0]
      ?.replace(/[^a-z0-9_.-]/gi, "")
      .toLowerCase() || "user";
  return `${base}-${fallbackId.slice(0, 6)}`;
}

async function findDuplicateIdentity({
  email,
  name,
  username,
  excludeId,
}: {
  email?: string;
  name?: string;
  username?: string;
  excludeId?: string;
}) {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedName = name?.trim().toLowerCase();
  const normalizedUsername = username?.trim().toLowerCase();
  const identityWhere = or(
    normalizedEmail ? sql`lower(${users.email}) = ${normalizedEmail}` : undefined,
    normalizedName ? sql`lower(${users.name}) = ${normalizedName}` : undefined,
    normalizedUsername ? sql`lower(${users.username}) = ${normalizedUsername}` : undefined,
  );

  if (!identityWhere) return null;

  const [existing] = await db
    .select({ id: users.id, email: users.email, name: users.name, username: users.username })
    .from(users)
    .where(excludeId ? and(ne(users.id, excludeId), identityWhere) : identityWhere)
    .limit(1);

  if (!existing) return null;
  if (normalizedEmail && existing.email.toLowerCase() === normalizedEmail)
    return "Email already exists";
  if (normalizedName && existing.name.toLowerCase() === normalizedName)
    return "Name already exists";
  return "Username already exists";
}

async function ensureUserIdentityIntegrity() {
  await db.execute(
    sql`alter table users add column if not exists last_active_at timestamp with time zone`,
  );

  await db.execute(sql`
    with ranked as (
      select
        id,
        row_number() over (partition by lower(username) order by created_at, id) as rn
      from users
    )
    update users
    set
      username = left(regexp_replace(lower(coalesce(nullif(users.username, ''), 'user')), '[^a-z0-9_.-]+', '', 'g'), 40) || '-' || left(users.id, 8),
      updated_at = now()
    from ranked
    where users.id = ranked.id and ranked.rn > 1
  `);

  await db.execute(sql`
    with ranked as (
      select
        id,
        email,
        row_number() over (partition by lower(email) order by created_at, id) as rn
      from users
    )
    update users
    set
      email = (
        case
          when position('@' in users.email) > 1 then
            split_part(users.email, '@', 1) || '+' || left(users.id, 8) || '@' || split_part(users.email, '@', 2)
          else
            'user+' || left(users.id, 8) || '@darktasks.local'
        end
      ),
      updated_at = now()
    from ranked
    where users.id = ranked.id and ranked.rn > 1
  `);

  await db.execute(sql`
    with ranked as (
      select
        id,
        row_number() over (partition by lower(name) order by created_at, id) as rn
      from users
    )
    update users
    set
      name = trim(coalesce(nullif(users.name, ''), 'User')) || ' ' || upper(left(users.id, 8)),
      updated_at = now()
    from ranked
    where users.id = ranked.id and ranked.rn > 1
  `);

  await db.execute(
    sql`create unique index if not exists users_username_lower_unique on users (lower(username))`,
  );
  await db.execute(
    sql`create unique index if not exists users_email_lower_unique on users (lower(email))`,
  );
  await db.execute(
    sql`create unique index if not exists users_name_lower_unique on users (lower(name))`,
  );
  await db.execute(sql`
    update users
    set last_active_at = coalesce(
      users.last_active_at,
      (
        select max(user_sessions.created_at)
        from user_sessions
        where user_sessions.user_id = users.id
      )
    )
  `);
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
      if (user) {
        const now = new Date();
        await db.update(users).set({ lastActiveAt: now }).where(eq(users.id, user.id));
        return { ...user, lastActiveAt: now };
      }
    }
  }

  const fallbackId = process.env.CURRENT_USER_ID;
  if (fallbackId) {
    const [user] = await db.select().from(users).where(eq(users.id, fallbackId)).limit(1);
    if (user) return user;
  }

  return null;
}

async function visibleProjectIdsFor(user: CurrentUser | null | undefined) {
  if (isAdmin(user)) return null;
  if (!user) return new Set<string>();

  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id));

  return new Set(rows.map((row) => row.projectId));
}

async function canAccessProject(user: CurrentUser | null | undefined, projectId: string) {
  if (isAdmin(user)) return true;
  if (!user) return false;

  const [membership] = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
    .limit(1);

  return Boolean(membership);
}

async function canAccessTask(user: CurrentUser | null | undefined, taskId: string) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return { task: null, allowed: false };

  return { task, allowed: await canAccessProject(user, task.projectId) };
}

async function repositoryBelongsToProject(repositoryId: string, projectId: string) {
  const [repo] = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(and(eq(repositories.id, repositoryId), eq(repositories.projectId, projectId)))
    .limit(1);

  return Boolean(repo);
}

async function userBelongsToProject(userId: string, projectId: string) {
  const [member] = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  return Boolean(member);
}

async function visibleUsersFor(user: CurrentUser | null | undefined) {
  const userRows = await db.select().from(users);
  if (isAdmin(user)) return userRows;
  if (!user) return [];

  const visibleProjectIds = await visibleProjectIdsFor(user);
  const memberRows = await db.select().from(projectMembers);
  const visibleUserIds = new Set([user.id]);

  for (const member of memberRows) {
    if (visibleProjectIds?.has(member.projectId)) visibleUserIds.add(member.userId);
  }

  return userRows.filter((row) => visibleUserIds.has(row.id));
}

async function requireAdmin(c: Context) {
  const user = await currentUserFromRequest(c);
  if (!user) return { user, response: c.json({ error: "Unauthorized" }, 401) };
  if (!isAdmin(user)) return { user, response: c.json({ error: "Admin access is required" }, 403) };
  return { user, response: null };
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
    origin: [
      ...(process.env.CORS_ORIGIN?.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean) ?? []),
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://tauri.localhost",
      "https://tauri.localhost",
      "tauri://localhost",
    ],
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

async function getBootstrapData(currentUser?: CurrentUser | null) {
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
  const activityRows = await db
    .select()
    .from(activityEvents)
    .orderBy(desc(activityEvents.createdAt));
  const notificationRows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));

  const visibleProjectIds = await visibleProjectIdsFor(currentUser);
  const visibleProjectRows = visibleProjectIds
    ? projectRows.filter((project) => visibleProjectIds.has(project.id))
    : projectRows;
  const visibleProjectIdValues = new Set(visibleProjectRows.map((project) => project.id));
  const visibleRepositoryRows = repositoryRows.filter((repo) =>
    visibleProjectIdValues.has(repo.projectId),
  );
  const visibleMemberRows = projectMemberRows.filter((member) =>
    visibleProjectIdValues.has(member.projectId),
  );
  const visibleTaskRows = taskRows.filter((task) => visibleProjectIdValues.has(task.projectId));
  const visibleTaskIds = new Set(visibleTaskRows.map((task) => task.id));
  const visibleTaskLabelRows = taskLabelRows.filter((join) => visibleTaskIds.has(join.taskId));
  const visibleSubtaskRows = subtaskRows.filter((subtask) => visibleTaskIds.has(subtask.taskId));
  const visibleCommentRows = commentRows.filter((comment) => visibleTaskIds.has(comment.taskId));
  const visibleUserIds = new Set(visibleMemberRows.map((member) => member.userId));

  if (currentUser) visibleUserIds.add(currentUser.id);

  const visibleUserRows = isAdmin(currentUser)
    ? userRows
    : userRows.filter((user) => visibleUserIds.has(user.id));
  const serializedUsers = serializeUsers(visibleUserRows);
  const visibleNotifications = currentUser
    ? notificationRows.filter(
        (notification) => notification.userId === currentUser.id || notification.userId === null,
      )
    : notificationRows.filter((notification) => notification.userId === null);

  return {
    users: serializedUsers,
    currentUser:
      serializedUsers.find((user) => user.id === currentUser?.id) ??
      serializedUsers.find((user) => user.id === process.env.CURRENT_USER_ID) ??
      serializedUsers[0] ??
      null,
    projects: serializeProjects(
      visibleProjectRows,
      visibleRepositoryRows,
      visibleMemberRows,
      visibleTaskRows,
    ),
    defaultColumns: serializeColumns(columnRows),
    tasks: serializeTasks(
      visibleTaskRows,
      labelRows,
      visibleTaskLabelRows,
      visibleSubtaskRows,
      visibleCommentRows,
    ),
    activity: serializeActivity(
      isAdmin(currentUser)
        ? activityRows
        : activityRows.filter((row) => row.userId === currentUser?.id),
    ),
    notifications: serializeNotifications(visibleNotifications),
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
  const username = body.username?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!username || !password) {
    return c.json({ error: "Username and password are required" }, 400);
  }

  const matchingUsers = await db
    .select()
    .from(users)
    .where(
      or(sql`lower(${users.username}) = ${username}`, sql`lower(${users.email}) = ${username}`),
    )
    .limit(5);
  const user = matchingUsers.find((candidate) => verifyPassword(password, candidate.passwordHash));

  if (!user) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const token = createSessionToken();

  await db.insert(userSessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt: sessionExpiry(),
  });
  const lastActiveAt = new Date();
  await db.update(users).set({ lastActiveAt }).where(eq(users.id, user.id));

  return c.json({
    token,
    user: serializeUsers([{ ...user, lastActiveAt }])[0],
  });
});

api.get("/bootstrap", async (c) => {
  const user = await currentUserFromRequest(c);
  return c.json(await getBootstrapData(user));
});

api.get("/users", async (c) =>
  c.json(serializeUsers(await visibleUsersFor(await currentUserFromRequest(c)))),
);

api.post("/users", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;

  const body = (await c.req.json()) as {
    name?: string;
    email?: string;
    role?: "Admin" | "User";
    password?: string;
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) return c.json({ error: "Name and email are required" }, 400);

  const id = randomUUID();
  const username = usernameFromEmail(email, id);
  const duplicate = await findDuplicateIdentity({ email, name, username });

  if (duplicate) return c.json({ error: duplicate }, 409);

  try {
    const [created] = await db
      .insert(users)
      .values({
        id,
        username,
        name,
        email,
        role: body.role ?? "User",
        passwordHash: hashPassword(body.password || "DarkTasks123!"),
        initials: initials(name),
        color: colors[Math.floor(Math.random() * colors.length)],
      })
      .returning();

    return c.json(serializeUsers([created])[0], 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: "A user with this name, email, or username already exists" }, 409);
    }
    throw error;
  }
});

api.patch("/users/:id", async (c) => {
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;

  const id = c.req.param("id");
  const body = (await c.req.json()) as {
    name?: string;
    email?: string;
    role?: "Admin" | "User";
  };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!name || !email) return c.json({ error: "Name and email are required" }, 400);

  const duplicate = await findDuplicateIdentity({ email, name, excludeId: id });
  if (duplicate) return c.json({ error: duplicate }, 409);

  let updated;
  try {
    [updated] = await db
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
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: "Name or email already exists" }, 409);
    throw error;
  }

  if (!updated) return c.json({ error: "User not found" }, 404);
  return c.json(serializeUsers([updated])[0]);
});

api.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;
  const currentUser = admin.user;

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

  const duplicate = await findDuplicateIdentity({ email, name, excludeId: user.id });
  if (duplicate) return c.json({ error: duplicate }, 409);

  let updated;
  try {
    [updated] = await db
      .update(users)
      .set({ name, email, initials: initials(name), updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: "Name or email already exists" }, 409);
    throw error;
  }

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
  const user = await currentUserFromRequest(c);
  const projectRows = await db.select().from(projects);
  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const taskRows = await db.select().from(tasks);
  const visibleProjectIds = await visibleProjectIdsFor(user);
  const visibleProjectRows = visibleProjectIds
    ? projectRows.filter((project) => visibleProjectIds.has(project.id))
    : projectRows;
  const visibleProjectIdValues = new Set(visibleProjectRows.map((project) => project.id));
  const visibleRepositoryRows = repositoryRows.filter((repo) =>
    visibleProjectIdValues.has(repo.projectId),
  );
  const visibleMemberRows = memberRows.filter((member) =>
    visibleProjectIdValues.has(member.projectId),
  );
  const visibleTaskRows = taskRows.filter((task) => visibleProjectIdValues.has(task.projectId));

  return c.json(
    serializeProjects(
      visibleProjectRows,
      visibleRepositoryRows,
      visibleMemberRows,
      visibleTaskRows,
    ),
  );
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
  if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

  const memberIds = Array.from(
    new Set(
      [currentUser.id, ...(body.memberIds ?? [])].filter((userId): userId is string =>
        Boolean(userId),
      ),
    ),
  );
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

  return c.json(
    serializeProjects(
      [created],
      repoRows,
      memberIds.map((userId) => ({ projectId: id, userId })),
    )[0],
    201,
  );
});

api.get("/projects/:slug", async (c) => {
  const slug = c.req.param("slug");
  const user = await currentUserFromRequest(c);
  const projectRows = await db.select().from(projects).where(eq(projects.slug, slug));
  const projectRow = projectRows[0];

  if (!projectRow) return c.json({ error: "Project not found" }, 404);
  if (!(await canAccessProject(user, projectRow.id)))
    return c.json({ error: "Project not found" }, 404);

  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const project = serializeProjects(projectRows, repositoryRows, memberRows)[0];

  return c.json(project);
});

api.patch("/projects/:id", async (c) => {
  const projectId = c.req.param("id");
  const user = await currentUserFromRequest(c);

  if (!(await canAccessProject(user, projectId)))
    return c.json({ error: "Project not found" }, 404);

  const body = (await c.req.json()) as {
    name?: string;
    description?: string;
    icon?: string;
  };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Project name is required" }, 400);

  const slug = slugify(name);
  const [updated] = await db
    .update(projects)
    .set({
      name,
      slug,
      description: body.description?.trim() ?? "",
      icon: body.icon?.trim() || "D",
      lastActivity: "Just now",
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  if (!updated) return c.json({ error: "Project not found" }, 404);

  const repositoryRows = await db.select().from(repositories);
  const memberRows = await db.select().from(projectMembers);
  const taskRows = await db.select().from(tasks);
  await addActivity(user?.id, "updated project", name);

  return c.json(serializeProjects([updated], repositoryRows, memberRows, taskRows)[0]);
});

api.delete("/projects/:id", async (c) => {
  const projectId = c.req.param("id");
  const user = await currentUserFromRequest(c);

  if (!(await canAccessProject(user, projectId)))
    return c.json({ error: "Project not found" }, 404);

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project) return c.json({ error: "Project not found" }, 404);

  await db.delete(projects).where(eq(projects.id, projectId));
  await addActivity(user?.id, "deleted project", project.name);

  return c.json({ ok: true });
});

api.patch("/projects/:id/members", async (c) => {
  const projectId = c.req.param("id");
  const admin = await requireAdmin(c);
  if (admin.response) return admin.response;

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
  await addActivity(admin.user?.id, "updated project members", project.name);

  return c.json(serializeProjects([project], repositoryRows, memberRows, taskRows)[0]);
});

api.post("/projects/:id/repositories", async (c) => {
  const projectId = c.req.param("id");
  const user = await currentUserFromRequest(c);

  if (!(await canAccessProject(user, projectId)))
    return c.json({ error: "Project not found" }, 404);

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
  await addActivity(user?.id, "created repository", name);

  return c.json({ id: created.id, name: created.name, color: created.color }, 201);
});

api.patch("/repositories/:id", async (c) => {
  const id = c.req.param("id");
  const user = await currentUserFromRequest(c);
  const body = (await c.req.json()) as { name?: string; color?: string };
  const name = body.name?.trim();

  if (!name) return c.json({ error: "Repository name is required" }, 400);

  const [repo] = await db.select().from(repositories).where(eq(repositories.id, id)).limit(1);
  if (!repo) return c.json({ error: "Repository not found" }, 404);
  if (!(await canAccessProject(user, repo.projectId)))
    return c.json({ error: "Repository not found" }, 404);

  const [updated] = await db
    .update(repositories)
    .set({
      name,
      color: body.color || colors[0],
    })
    .where(eq(repositories.id, id))
    .returning();

  if (!updated) return c.json({ error: "Repository not found" }, 404);
  await addActivity(user?.id, "updated repository", name);

  return c.json({ id: updated.id, name: updated.name, color: updated.color });
});

api.delete("/repositories/:id", async (c) => {
  const id = c.req.param("id");
  const user = await currentUserFromRequest(c);
  const [repo] = await db.select().from(repositories).where(eq(repositories.id, id)).limit(1);

  if (!repo) return c.json({ error: "Repository not found" }, 404);
  if (!(await canAccessProject(user, repo.projectId)))
    return c.json({ error: "Repository not found" }, 404);

  const taskRows = await db.select().from(tasks).where(eq(tasks.repositoryId, id));

  if (taskRows.length > 0) {
    return c.json({ error: "Move or delete this repository's tasks before deleting it." }, 400);
  }

  await db.delete(repositories).where(eq(repositories.id, id));
  await addActivity(user?.id, "deleted repository", repo.name);

  return c.json({ ok: true });
});

api.get("/tasks", async (c) => {
  const user = await currentUserFromRequest(c);
  const taskRows = await db.select().from(tasks);
  const labelRows = await db.select().from(labels);
  const taskLabelRows = await db.select().from(taskLabels);
  const subtaskRows = await db.select().from(subtasks);
  const commentRows = await db.select().from(taskComments);
  const visibleProjectIds = await visibleProjectIdsFor(user);

  const projectId = c.req.query("projectId");
  const status = c.req.query("status");
  const rows = taskRows.filter(
    (task) =>
      (visibleProjectIds === null || visibleProjectIds.has(task.projectId)) &&
      (!projectId || task.projectId === projectId) &&
      (!status || task.status === status),
  );

  return c.json(serializeTasks(rows, labelRows, taskLabelRows, subtaskRows, commentRows));
});

api.post("/tasks", async (c) => {
  const body = await c.req.json();
  const user = await currentUserFromRequest(c);
  const title = body.title?.trim();

  if (!title) return c.json({ error: "Task title is required" }, 400);
  if (!body.projectId) return c.json({ error: "Project is required" }, 400);
  if (!body.repositoryId) return c.json({ error: "Repository is required" }, 400);
  if (!body.assigneeId) return c.json({ error: "Assignee is required" }, 400);
  if (!(await canAccessProject(user, body.projectId)))
    return c.json({ error: "Project not found" }, 404);
  if (!(await repositoryBelongsToProject(body.repositoryId, body.projectId))) {
    return c.json({ error: "Repository does not belong to this project" }, 400);
  }
  if (!(await userBelongsToProject(body.assigneeId, body.projectId))) {
    return c.json({ error: "Assignee must be a project member" }, 400);
  }

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
  const user = await currentUserFromRequest(c);
  const access = await canAccessTask(user, id);

  if (!access.task) return c.json({ error: "Task not found" }, 404);
  if (!access.allowed) return c.json({ error: "Task not found" }, 404);

  const title = body.title?.trim();

  if (!title) return c.json({ error: "Task title is required" }, 400);
  if (!body.projectId) return c.json({ error: "Project is required" }, 400);
  if (!body.repositoryId) return c.json({ error: "Repository is required" }, 400);
  if (!body.assigneeId) return c.json({ error: "Assignee is required" }, 400);
  if (!(await canAccessProject(user, body.projectId)))
    return c.json({ error: "Project not found" }, 404);
  if (!(await repositoryBelongsToProject(body.repositoryId, body.projectId))) {
    return c.json({ error: "Repository does not belong to this project" }, 400);
  }
  if (!(await userBelongsToProject(body.assigneeId, body.projectId))) {
    return c.json({ error: "Assignee must be a project member" }, 400);
  }

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
  await addActivity(user?.id, "updated task", title);
  return c.json(serializeTasks([updated], [], [], [])[0]);
});

api.patch("/tasks/:id/status", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json()) as { status?: string };
  const user = await currentUserFromRequest(c);
  const access = await canAccessTask(user, id);

  if (!body.status) return c.json({ error: "Status is required" }, 400);
  if (!access.task) return c.json({ error: "Task not found" }, 404);
  if (!access.allowed) return c.json({ error: "Task not found" }, 404);

  const [updated] = await db
    .update(tasks)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  if (!updated) return c.json({ error: "Task not found" }, 404);
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
  if (!(await canAccessProject(user, task.projectId)))
    return c.json({ error: "Task not found" }, 404);

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
  const user = await currentUserFromRequest(c);
  const access = await canAccessTask(user, id);

  if (!access.task) return c.json({ error: "Task not found" }, 404);
  if (!access.allowed) return c.json({ error: "Task not found" }, 404);

  await db.delete(tasks).where(eq(tasks.id, id));
  await addActivity(user?.id, "deleted task", access.task.title);
  return c.json({ ok: true });
});

api.get("/activity", async (c) => {
  const user = await currentUserFromRequest(c);
  const rows = await db.select().from(activityEvents).orderBy(desc(activityEvents.createdAt));

  return c.json(
    serializeActivity(isAdmin(user) ? rows : rows.filter((row) => row.userId === user?.id)),
  );
});

api.get("/notifications", async (c) => {
  const user = await currentUserFromRequest(c);
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  const visibleRows = user
    ? rows.filter((notification) => notification.userId === user.id || notification.userId === null)
    : rows.filter((notification) => notification.userId === null);

  return c.json(serializeNotifications(visibleRows));
});

api.patch("/notifications/read-all", async (c) => {
  const user = await currentUserFromRequest(c);

  if (!user) return c.json({ error: "Unauthorized" }, 401);

  await db
    .update(notifications)
    .set({ read: true })
    .where(or(eq(notifications.userId, user.id), isNull(notifications.userId)));

  return c.json({ ok: true });
});

app.route("/api", api);

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 8787);

await ensureUserIdentityIntegrity();

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.log(`DarkTasks API listening on http://localhost:${info.port}`);
});
