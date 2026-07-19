ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "users"
SET "last_active_at" = COALESCE(
  "users"."last_active_at",
  (
    SELECT max("user_sessions"."created_at")
    FROM "user_sessions"
    WHERE "user_sessions"."user_id" = "users"."id"
  )
);
