-- BUKLOD_PERMISSION_SNAPSHOT_R1
-- Collapse Foundation presentation permission fan-out into one authenticated
-- snapshot. This function cannot inspect an arbitrary user: it derives the
-- principal only from auth.uid(). Protected operations remain enforced by
-- their existing RLS/RPC authorization.

create or replace function public.buklod_my_permission_snapshot_v1()
returns table (
  permission_key text,
  scope_type text,
  scope_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as user_id
  ),
  active_user as (
    select m.user_id
    from me m
    join public.profiles p
      on p.id = m.user_id
     and p.is_active = true
    where m.user_id is not null
  )
  select
    '*'::text as permission_key,
    'GLOBAL'::text as scope_type,
    null::uuid as scope_id
  from active_user u
  where public.has_app_role(u.user_id, 'system_admin')

  union

  select distinct
    rp.permission_key::text,
    a.scope_type::text,
    a.scope_id
  from active_user u
  join public.buklod_foundation_role_assignments a
    on a.user_id = u.user_id
   and a.status = 'ACTIVE'
   and a.valid_from <= now()
   and (a.valid_until is null or a.valid_until > now())
  join public.buklod_foundation_role_permissions rp
    on rp.role_key = a.role_key
  join public.buklod_foundation_permissions perm
    on perm.permission_key = rp.permission_key
   and perm.is_active = true
  join public.buklod_foundation_roles r
    on r.role_key = a.role_key
   and r.is_active = true;
$$;

revoke all on function public.buklod_my_permission_snapshot_v1() from public;
grant execute on function public.buklod_my_permission_snapshot_v1() to authenticated;
grant execute on function public.buklod_my_permission_snapshot_v1() to service_role;

comment on function public.buklod_my_permission_snapshot_v1() is
  'BUKLOD_PERMISSION_SNAPSHOT_R1: returns the current authenticated active user permission snapshot so client presentation checks do not fan out into dozens of buklod_has_permission RPC calls.';
