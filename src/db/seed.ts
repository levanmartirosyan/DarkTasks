import "dotenv/config";

import { inArray } from "drizzle-orm";
import { hashPassword } from "../api/auth";
import { db } from "./client";
import { boardColumns, labels, projects, users } from "./schema";

const initialColumns = [
  { id: "backlog", name: "Backlog", hint: "Ideas & unplanned" },
  { id: "todo", name: "To Do", hint: "Scheduled" },
  { id: "in_progress", name: "In Progress", hint: "Active work" },
  { id: "testing", name: "Testing", hint: "In QA" },
  { id: "done", name: "Done", hint: "Shipped" },
];

async function seed() {
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "DarkTasks123!";

  await db.delete(projects).where(inArray(projects.id, ["p1", "p2", "p3", "p4"]));
  await db.delete(users).where(inArray(users.id, ["u1", "u2", "u3", "u4", "u5", "u6"]));
  await db.delete(labels).where(inArray(labels.id, ["bug", "feature", "design", "api", "performance", "docs"]));

  await db
    .insert(users)
    .values({
      id: "admin-darkness",
      username: "DARKNESS",
      name: "Darkness Admin",
      email: "darkness@darktasks.local",
      role: "Admin",
      passwordHash: hashPassword(adminPassword),
      avatar: "",
      initials: "DA",
      color: "oklch(0.66 0.19 275)",
    })
    .onConflictDoNothing();

  await db
    .insert(boardColumns)
    .values(initialColumns.map((column, index) => ({ ...column, sortOrder: index })))
    .onConflictDoNothing();

  console.log("Seeded DarkTasks admin user and default columns.");
}

const seedTimeoutMs = Number(process.env.SEED_TIMEOUT_MS ?? 20_000);
const seedTimeout = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error(`Seed timed out after ${Math.round(seedTimeoutMs / 1000)} seconds.`)), seedTimeoutMs);
});

Promise.race([seed(), seedTimeout]).catch((error) => {
  console.error(error);
  process.exit(1);
});
