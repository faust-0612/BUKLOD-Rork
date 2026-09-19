-- BUKLOD MAIN LIVE PERFORMANCE HOTFIX R2
-- 2026-09-19
-- Purpose:
--   1) Route buklod_my_scopes() through the already-deployed optimized p0_v2 implementation.
--   2) Keep buklod_is_system_admin() semantically equivalent while avoiding repeated auth.uid() evaluation.
-- Live verification before source sync:
--   buklod_my_scopes(): ~887 ms -> ~196 ms warm execution under activity load.
--   blocked DB sessions: 0.

create or replace function public.buklod_is_system_admin()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return false;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = v_user_id
      and lower(p.role::text) = 'system_admin'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and lower(ur.role::text) = 'system_admin'
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s
      on s.id = ra.scope_id
    where ra.user_id = v_user_id
      and ra.role_key = 'SYSTEM_ADMIN'
      and ra.status = 'ACTIVE'
      and s.scope_type = 'SYSTEM'
      and s.status = 'ACTIVE'
  );
end;
$function$;

create or replace function public.buklod_my_scopes()
returns table(
  scope_id uuid,
  scope_type text,
  name text,
  scope_status text,
  visibility text,
  geo_level text,
  membership_status text,
  role_keys text[],
  is_admin boolean,
  member_count bigint,
  show_faith_content boolean,
  feature_keys text[],
  is_active_scope boolean
)
language sql
stable
security definer
set search_path to ''
as $function$
  select *
  from public.buklod_my_scopes_p0_v2();
$function$;
