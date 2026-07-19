WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS rn
  FROM users
)
UPDATE users
SET
  name = trim(coalesce(nullif(users.name, ''), 'User')) || ' ' || upper(left(users.id, 8)),
  updated_at = now()
FROM ranked
WHERE users.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_name_lower_unique" ON "users" (lower("name"));
