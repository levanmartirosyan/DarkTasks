import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for the API server.");
}

const client = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
  connect_timeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_SECONDS ?? 10),
  prepare: process.env.DATABASE_PREPARE === "true",
  ssl: process.env.DATABASE_SSL === "false" ? false : "require",
});

export const db = drizzle(client, { schema });
