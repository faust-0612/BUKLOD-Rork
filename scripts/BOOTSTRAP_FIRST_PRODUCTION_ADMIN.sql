-- BUKLOD PRODUCTION: bootstrap the FIRST System Admin.
-- Run ONCE in the PRODUCTION Supabase SQL Editor.
--
-- SAFETY:
-- 1. Create the intended production admin account in Supabase Auth Dashboard
--    or through a verified production registration path.
-- 2. Replace BOTH placeholders below.
-- 3. Keep production Maintenance Mode ON.
-- 4. Run this SQL as database owner.
-- 5. Log in and verify System Admin access.
-- 6. Use the protected BUKLOD admin workflow for all later role changes.

do $$
declare
  target_email text := 'REPLACE_WITH_PRODUCTION_ADMIN_EMAIL';
  confirmation text := 'REPLACE_WITH_EXACT_TEXT_BUKLOD_PRODUCTION_ADMIN';
  target_id uuid;
begin
  if target_email = 'REPLACE_WITH_PRODUCTION_ADMIN_EMAIL' then
    raise exception 'Replace the production admin email before running';
  end if;

  if confirmation <> 'BUKLOD_PRODUCTION_ADMIN' then
    raise exception 'Set confirmation exactly to BUKLOD_PRODUCTION_ADMIN';
  end if;

  select u.id into target_id
  from auth.users u
  where lower(u.email)=lower(target_email)
  limit 1;

  if target_id is null then
    raise exception 'No Auth user found for %', target_email;
  end if;

  update public.profiles
  set role='system_admin', is_active=true
  where id=target_id;

  if not found then
    raise exception 'Profile row not found for Auth user %', target_email;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    target_id,
    'bootstrap_first_production_system_admin',
    'profile',
    target_id::text,
    jsonb_build_object('email',target_email,'environment','production')
  );

  raise notice 'First production System Admin bootstrapped: %', target_email;
end $$;
