update "users"
set
  "username" = "name",
  "updated_at" = now()
where
  "name" ~ '^[A-Za-z0-9_.-]{3,32}$'
  and lower("name") <> lower("username")
  and not exists (
    select 1
    from "users" as "other_users"
    where "other_users"."id" <> "users"."id" and lower("other_users"."username") = lower("users"."name")
  );

drop index if exists "users_name_lower_unique";
update "users" set "name" = "username" where "name" is distinct from "username";
