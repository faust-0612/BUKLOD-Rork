-- BUKLOD_WEB_BACKEND_CONTRACT_R1
-- Restore the user-facing Organization invitation response contract expected by
-- src/app/organizations/join.tsx. Targeted compatibility only.

create or replace function public.buklod_respond_organization_invite(
  _scope_id uuid,
  _accept boolean default true
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_status text;
  v_invited_by uuid;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if _scope_id is null then
    raise exception 'Organization is required';
  end if;

  select
    m.membership_status,
    m.invited_by
  into
    v_status,
    v_invited_by
  from public.buklod_scope_memberships m
  join public.buklod_scopes s
    on s.id = m.scope_id
  where m.scope_id = _scope_id
    and m.user_id = v_actor
    and s.scope_type = 'ORGANIZATION'
    and upper(coalesce(s.status,'ACTIVE')) in ('ACTIVE','RESTRICTED')
  for update of m;

  if not found then
    raise exception 'Organization invitation not found';
  end if;

  if v_status = 'ACTIVE' then
    return 'ACTIVE';
  end if;

  if v_status <> 'INVITED' then
    raise exception 'No pending Organization invitation';
  end if;

  if coalesce(_accept,false) then
    update public.buklod_scope_memberships
    set
      membership_status = 'ACTIVE',
      membership_source = 'INVITE',
      joined_at = pg_catalog.now(),
      left_at = null
    where scope_id = _scope_id
      and user_id = v_actor
      and membership_status = 'INVITED';

    insert into public.buklod_scope_role_assignments (
      scope_id,
      user_id,
      role_key,
      status,
      assigned_by,
      revoked_at
    )
    values (
      _scope_id,
      v_actor,
      'MEMBER',
      'ACTIVE',
      coalesce(v_invited_by,v_actor),
      null
    )
    on conflict (scope_id,user_id,role_key)
    do update set
      status = 'ACTIVE',
      assigned_by = excluded.assigned_by,
      revoked_at = null;

    return 'ACTIVE';
  end if;

  update public.buklod_scope_memberships
  set
    membership_status = 'LEFT',
    membership_source = 'INVITE',
    joined_at = null,
    left_at = pg_catalog.now()
  where scope_id = _scope_id
    and user_id = v_actor
    and membership_status = 'INVITED';

  update public.buklod_scope_role_assignments
  set
    status = 'REVOKED',
    revoked_at = pg_catalog.now()
  where scope_id = _scope_id
    and user_id = v_actor
    and role_key = 'MEMBER'
    and status = 'ACTIVE';

  return 'LEFT';
end;
$$;

revoke all on function public.buklod_respond_organization_invite(uuid,boolean)
from public;

revoke all on function public.buklod_respond_organization_invite(uuid,boolean)
from anon;

grant execute on function public.buklod_respond_organization_invite(uuid,boolean)
to authenticated;

grant execute on function public.buklod_respond_organization_invite(uuid,boolean)
to service_role;
