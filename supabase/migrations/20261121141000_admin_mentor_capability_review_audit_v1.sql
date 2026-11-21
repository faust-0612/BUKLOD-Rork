-- DEV/STAGING only: explicit, audited System Admin mentor capability review.
-- Never backfill roles: the protected official administrator must not become a rewarded mentor.
create table if not exists private.buklod_mentor_capability_audit_v1 (
  id bigint generated always as identity primary key,
  request_key uuid not null unique,
  actor_id uuid not null references public.profiles(id),
  target_id uuid not null references public.profiles(id),
  previous_active boolean not null,
  new_active boolean not null,
  reason text not null check (length(reason) between 15 and 500),
  created_at timestamptz not null default now()
);
alter table private.buklod_mentor_capability_audit_v1 enable row level security;
revoke all on private.buklod_mentor_capability_audit_v1 from public, anon, authenticated;

create or replace function public.admin_set_mentor_capability_v1(
  p_target_id uuid, p_enable boolean, p_reason text, p_request_key uuid
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  target_active boolean;
  target_role text;
  old_active boolean;
  prior_target uuid;
  prior_enabled boolean;
  clean_reason text := trim(coalesce(p_reason, ''));
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin permission required' using errcode='42501';
  end if;
  if p_target_id is null or p_enable is null or p_request_key is null or p_target_id=actor then
    raise exception 'Valid target, action and unique request key required';
  end if;
  if length(clean_reason) not between 15 and 500 then
    raise exception 'Audit reason must contain 15 to 500 characters';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mentor-capability:'||p_target_id::text, 0));

  select a.target_id, a.new_active into prior_target, prior_enabled
  from private.buklod_mentor_capability_audit_v1 a
  where a.request_key=p_request_key;
  if found then
    if prior_target is distinct from p_target_id or prior_enabled is distinct from p_enable then
      raise exception 'Request key reused for a different action';
    end if;
    return pg_catalog.jsonb_build_object('changed',false,'already_recorded',true,'enabled',prior_enabled);
  end if;

  select p.is_active,p.role::text into target_active,target_role
  from public.profiles p where p.id=p_target_id for update;
  if not found or target_active is distinct from true then
    raise exception 'Target must be an active BUKLOD member';
  end if;
  if target_role='system_admin' or exists (
    select 1 from public.user_roles ur
    where ur.user_id=p_target_id and ur.role='system_admin' and ur.is_active=true
  ) or exists (
    select 1 from public.buklod_foundation_protected_principals pp
    where pp.user_id=p_target_id and pp.protected=true
  ) then
    raise exception 'Protected/System Admin identities cannot receive mentor capability'
      using errcode='42501';
  end if;

  select c.is_active into old_active from public.user_capabilities c
  where c.user_id=p_target_id and c.capability='mentor' for update;
  old_active := coalesce(old_active,false);
  if old_active=p_enable then
    return pg_catalog.jsonb_build_object('changed',false,'already_recorded',false,'enabled',p_enable);
  end if;
  if p_enable then
    insert into public.user_capabilities(user_id,capability,granted_by,granted_at,is_active)
    values(p_target_id,'mentor',actor,now(),true)
    on conflict(user_id,capability) do update
      set granted_by=excluded.granted_by,
          granted_at=excluded.granted_at,
          is_active=true;
  else
    update public.user_capabilities c set is_active=false
    where c.user_id=p_target_id and c.capability='mentor';
  end if;

  insert into private.buklod_mentor_capability_audit_v1
    (request_key,actor_id,target_id,previous_active,new_active,reason)
  values(p_request_key,actor,p_target_id,old_active,p_enable,clean_reason);
  return pg_catalog.jsonb_build_object('changed',true,'already_recorded',false,'enabled',p_enable);
end;
$$;
revoke all on function public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)
  from public, anon;
grant execute on function public.admin_set_mentor_capability_v1(uuid,boolean,text,uuid)
  to authenticated;

-- Protect the official identity even from legacy direct capability updates.
-- This applies only to attempts to activate a mentor capability; historical rows remain unchanged.
create or replace function private.buklod_guard_protected_mentor_capability_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.capability='mentor' and new.is_active=true and (
    exists (select 1 from public.profiles p
            where p.id=new.user_id and p.role::text='system_admin')
    or exists (select 1 from public.user_roles ur
               where ur.user_id=new.user_id and ur.role='system_admin' and ur.is_active=true)
    or exists (select 1 from public.buklod_foundation_protected_principals pp
               where pp.user_id=new.user_id and pp.protected=true)
  ) then
    raise exception 'Protected System Admin cannot have active mentor capability'
      using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_guard_protected_mentor_capability_v1()
  from public, anon, authenticated;
drop trigger if exists buklod_guard_protected_mentor_capability_v1
  on public.user_capabilities;
create trigger buklod_guard_protected_mentor_capability_v1
before insert or update of capability, is_active, user_id
on public.user_capabilities for each row
execute function private.buklod_guard_protected_mentor_capability_v1();

-- Legacy/mobile clients must also be unable to create new active mentor relationships
-- for the protected official account or a mentor whose verified permission is inactive.
-- Historical assignments are intentionally preserved until individually reviewed.
create or replace function private.buklod_guard_active_mentor_assignment_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.is_active=true then
    if exists (
       select 1 from public.profiles p
       where p.id=new.mentor_id and p.role::text='system_admin'
    ) or exists (
       select 1 from public.user_roles ur
       where ur.user_id=new.mentor_id and ur.role='system_admin' and ur.is_active=true
    ) or exists (
       select 1 from public.buklod_foundation_protected_principals pp
       where pp.user_id=new.mentor_id and pp.protected=true
    ) then
      raise exception 'Protected System Admin cannot be an active mentor'
        using errcode='42501';
    end if;
    if not public.has_capability(new.mentor_id,'mentor') then
      raise exception 'Active mentor permission required before learner assignment'
        using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.buklod_guard_active_mentor_assignment_v1()
 from public, anon, authenticated;
drop trigger if exists buklod_guard_active_mentor_assignment_v1
 on public.mentor_assignments;
create trigger buklod_guard_active_mentor_assignment_v1
before insert or update of mentor_id, is_active
on public.mentor_assignments for each row
execute function private.buklod_guard_active_mentor_assignment_v1();
