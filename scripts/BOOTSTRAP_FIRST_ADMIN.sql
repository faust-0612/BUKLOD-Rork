-- BUKLOD: bootstrap the FIRST system administrator.
-- Run manually in the Supabase SQL Editor while authenticated as the database owner.
-- This is needed only because set_user_role() itself requires an existing system_admin.
--
-- 1. Register the intended admin account normally in the BUKLOD staging app.
-- 2. Replace the placeholder email below.
-- 3. Run this SQL ONCE.
-- 4. Use the normal system-admin UI/RPC for all later role changes.

do $$
declare
  target_email text := 'REPLACE_WITH_FIRST_ADMIN_EMAIL';
  target_id uuid;
begin
  if target_email = 'REPLACE_WITH_FIRST_ADMIN_EMAIL' then
    raise exception 'Replace the first-admin email before running this script';
  end if;

  select u.id into target_id
  from auth.users u
  where lower(u.email) = lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'No Auth user found for %', target_email;
  end if;

  update public.profiles
  set role = 'system_admin'
  where id = target_id;

  if not found then
    raise exception 'Profile row not found for Auth user %', target_email;
  end if;

  raise notice 'BUKLOD first system_admin promoted: %', target_email;
end $$;
