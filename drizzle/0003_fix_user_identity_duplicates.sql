WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY lower(username) ORDER BY created_at, id) AS rn
  FROM users
)
UPDATE users
SET
  username = left(regexp_replace(lower(coalesce(nullif(users.username, ''), 'user')), '[^a-z0-9_.-]+', '', 'g'), 40) || '-' || left(users.id, 8),
  updated_at = now()
FROM ranked
WHERE users.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint
WITH ranked AS (
  SELECT
    id,
    email,
    row_number() OVER (PARTITION BY lower(email) ORDER BY created_at, id) AS rn
  FROM users
)
UPDATE users
SET
  email = (
    CASE
      WHEN position('@' in users.email) > 1 THEN
        split_part(users.email, '@', 1) || '+' || left(users.id, 8) || '@' || split_part(users.email, '@', 2)
      ELSE
        'user+' || left(users.id, 8) || '@darktasks.local'
    END
  ),
  updated_at = now()
FROM ranked
WHERE users.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_unique" ON "users" (lower("username"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (lower("email"));
