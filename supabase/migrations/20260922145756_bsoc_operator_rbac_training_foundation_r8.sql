
-- BUKLOD BSOC R8: operator RBAC + training/readiness foundation.
-- Reuses canonical SYSTEM scope roles/permissions; does not alter Main app roles.

insert into public.buklod_scope_roles(role_key, display_name, description, allowed_scope_types)
values
  ('BSOC_SUPPORT_MANAGER','BSOC Support Manager','Owns support queues, quality, escalation and operator handover.',array['SYSTEM']::text[]),
  ('BSOC_SUPPORT_AGENT','BSOC Support Agent','Handles user support cases, diagnostics and approved safe recovery.',array['SYSTEM']::text[]),
  ('BSOC_MODERATION_MANAGER','BSOC Moderation Manager','Owns moderation queues, quality and escalations.',array['SYSTEM']::text[]),
  ('BSOC_MODERATOR','BSOC Moderator','Handles reported content and moderation cases within approved scope.',array['SYSTEM']::text[]),
  ('BSOC_ORG_SUPPORT','BSOC Organization Support','Handles Organization/Sub-Organization operational support.',array['SYSTEM']::text[]),
  ('BSOC_APP_OPERATOR','BSOC App Operator','Operational role for explicitly assigned BUKLOD apps.',array['SYSTEM']::text[]),
  ('BSOC_SECURITY_OPERATOR','BSOC Security Operator','Handles security alerts, session/device containment and approved escalation.',array['SYSTEM']::text[]),
  ('BSOC_AUDITOR','BSOC Read-only Auditor','Read-only review of operational evidence, incidents, controls and audit history.',array['SYSTEM']::text[])
on conflict (role_key) do update
set display_name=excluded.display_name,
    description=excluded.description,
    allowed_scope_types=excluded.allowed_scope_types;

insert into public.buklod_permissions(permission_key,description)
values
 ('bsoc.access','Open the BUKLOD System Operations Center'),
 ('bsoc.overview.read','View BSOC overview and attention summary'),
 ('bsoc.work.read','View assigned/operational work queues'),
 ('bsoc.support.read','View support cases and support diagnostics'),
 ('bsoc.support.manage','Preview/apply approved support case actions'),
 ('bsoc.user360.read','View safe BSOC User 360 operational context'),
 ('bsoc.observability.read','View UX health, telemetry freshness and recurring-error analytics'),
 ('bsoc.moderation.read','View moderation cases'),
 ('bsoc.moderation.manage','Apply approved moderation workflow actions'),
 ('bsoc.organizations.read','View Organization/Sub-Organization operational context'),
 ('bsoc.organizations.manage','Apply approved Organization support actions'),
 ('bsoc.apps.read','View app registry and operational health'),
 ('bsoc.apps.manage','Apply approved app operational controls'),
 ('bsoc.ads.read','View advertising operational health without finance data'),
 ('bsoc.incidents.read','View and correlate incidents'),
 ('bsoc.incidents.manage','Create/update incidents through approved workflows'),
 ('bsoc.features.read','View feature-control state'),
 ('bsoc.features.manage','Apply approved feature-control changes'),
 ('bsoc.notifications.read','View notification operational health'),
 ('bsoc.notifications.manage','Apply approved notification operational controls'),
 ('bsoc.releases.read','View release state and deployment health'),
 ('bsoc.releases.manage','Apply approved release operations'),
 ('bsoc.security.read','View security operational context'),
 ('bsoc.security.manage','Apply approved security containment actions'),
 ('bsoc.session.revoke','Revoke approved user sessions/devices'),
 ('bsoc.break_glass.request','Request audited emergency elevation'),
 ('bsoc.break_glass.approve','Approve audited emergency elevation'),
 ('bsoc.reports.read','View operational reports'),
 ('bsoc.knowledge.read','View Knowledge Base and operator references'),
 ('bsoc.knowledge.manage','Manage approved Knowledge Base content'),
 ('bsoc.training.read','Use BSOC Training Center and safe practice'),
 ('bsoc.training.certify','Review operator training completion/certification'),
 ('bsoc.audit.read','View BSOC privileged-action audit history'),
 ('bsoc.audit.write','Write BSOC privileged-action audit events through approved workflows'),
 ('bsoc.staff.read','View BSOC staff/role assignments'),
 ('bsoc.staff.manage','Manage BSOC staff/role assignments'),
 ('bsoc.safe_recovery.execute','Execute approved, bounded support recovery actions'),
 ('bsoc.exports.safe','Create approved privacy-bounded operational exports')
on conflict (permission_key) do update set description=excluded.description;

-- Role permission matrix. System Admin remains an implicit full-access bypass in buklod_bsoc_can().
delete from public.buklod_role_permissions
where role_key like 'BSOC_%'
  and permission_key like 'bsoc.%';

insert into public.buklod_role_permissions(role_key,permission_key)
values
-- Support Agent
('BSOC_SUPPORT_AGENT','bsoc.access'),
('BSOC_SUPPORT_AGENT','bsoc.overview.read'),
('BSOC_SUPPORT_AGENT','bsoc.work.read'),
('BSOC_SUPPORT_AGENT','bsoc.support.read'),
('BSOC_SUPPORT_AGENT','bsoc.support.manage'),
('BSOC_SUPPORT_AGENT','bsoc.user360.read'),
('BSOC_SUPPORT_AGENT','bsoc.observability.read'),
('BSOC_SUPPORT_AGENT','bsoc.incidents.read'),
('BSOC_SUPPORT_AGENT','bsoc.knowledge.read'),
('BSOC_SUPPORT_AGENT','bsoc.training.read'),
('BSOC_SUPPORT_AGENT','bsoc.safe_recovery.execute'),
('BSOC_SUPPORT_AGENT','bsoc.audit.write'),

-- Support Manager
('BSOC_SUPPORT_MANAGER','bsoc.access'),
('BSOC_SUPPORT_MANAGER','bsoc.overview.read'),
('BSOC_SUPPORT_MANAGER','bsoc.work.read'),
('BSOC_SUPPORT_MANAGER','bsoc.support.read'),
('BSOC_SUPPORT_MANAGER','bsoc.support.manage'),
('BSOC_SUPPORT_MANAGER','bsoc.user360.read'),
('BSOC_SUPPORT_MANAGER','bsoc.observability.read'),
('BSOC_SUPPORT_MANAGER','bsoc.incidents.read'),
('BSOC_SUPPORT_MANAGER','bsoc.incidents.manage'),
('BSOC_SUPPORT_MANAGER','bsoc.organizations.read'),
('BSOC_SUPPORT_MANAGER','bsoc.apps.read'),
('BSOC_SUPPORT_MANAGER','bsoc.notifications.read'),
('BSOC_SUPPORT_MANAGER','bsoc.reports.read'),
('BSOC_SUPPORT_MANAGER','bsoc.knowledge.read'),
('BSOC_SUPPORT_MANAGER','bsoc.training.read'),
('BSOC_SUPPORT_MANAGER','bsoc.training.certify'),
('BSOC_SUPPORT_MANAGER','bsoc.audit.read'),
('BSOC_SUPPORT_MANAGER','bsoc.audit.write'),
('BSOC_SUPPORT_MANAGER','bsoc.staff.read'),
('BSOC_SUPPORT_MANAGER','bsoc.safe_recovery.execute'),
('BSOC_SUPPORT_MANAGER','bsoc.exports.safe'),

-- Moderator
('BSOC_MODERATOR','bsoc.access'),
('BSOC_MODERATOR','bsoc.overview.read'),
('BSOC_MODERATOR','bsoc.work.read'),
('BSOC_MODERATOR','bsoc.moderation.read'),
('BSOC_MODERATOR','bsoc.moderation.manage'),
('BSOC_MODERATOR','bsoc.user360.read'),
('BSOC_MODERATOR','bsoc.incidents.read'),
('BSOC_MODERATOR','bsoc.knowledge.read'),
('BSOC_MODERATOR','bsoc.training.read'),
('BSOC_MODERATOR','bsoc.audit.write'),

-- Moderation Manager
('BSOC_MODERATION_MANAGER','bsoc.access'),
('BSOC_MODERATION_MANAGER','bsoc.overview.read'),
('BSOC_MODERATION_MANAGER','bsoc.work.read'),
('BSOC_MODERATION_MANAGER','bsoc.moderation.read'),
('BSOC_MODERATION_MANAGER','bsoc.moderation.manage'),
('BSOC_MODERATION_MANAGER','bsoc.user360.read'),
('BSOC_MODERATION_MANAGER','bsoc.incidents.read'),
('BSOC_MODERATION_MANAGER','bsoc.incidents.manage'),
('BSOC_MODERATION_MANAGER','bsoc.reports.read'),
('BSOC_MODERATION_MANAGER','bsoc.knowledge.read'),
('BSOC_MODERATION_MANAGER','bsoc.training.read'),
('BSOC_MODERATION_MANAGER','bsoc.training.certify'),
('BSOC_MODERATION_MANAGER','bsoc.audit.read'),
('BSOC_MODERATION_MANAGER','bsoc.audit.write'),
('BSOC_MODERATION_MANAGER','bsoc.staff.read'),
('BSOC_MODERATION_MANAGER','bsoc.exports.safe'),

-- Organization support
('BSOC_ORG_SUPPORT','bsoc.access'),
('BSOC_ORG_SUPPORT','bsoc.overview.read'),
('BSOC_ORG_SUPPORT','bsoc.work.read'),
('BSOC_ORG_SUPPORT','bsoc.support.read'),
('BSOC_ORG_SUPPORT','bsoc.support.manage'),
('BSOC_ORG_SUPPORT','bsoc.user360.read'),
('BSOC_ORG_SUPPORT','bsoc.observability.read'),
('BSOC_ORG_SUPPORT','bsoc.organizations.read'),
('BSOC_ORG_SUPPORT','bsoc.organizations.manage'),
('BSOC_ORG_SUPPORT','bsoc.incidents.read'),
('BSOC_ORG_SUPPORT','bsoc.knowledge.read'),
('BSOC_ORG_SUPPORT','bsoc.training.read'),
('BSOC_ORG_SUPPORT','bsoc.audit.write'),
('BSOC_ORG_SUPPORT','bsoc.safe_recovery.execute'),

-- App operator: operational visibility only until app-specific write scopes are attached.
('BSOC_APP_OPERATOR','bsoc.access'),
('BSOC_APP_OPERATOR','bsoc.overview.read'),
('BSOC_APP_OPERATOR','bsoc.work.read'),
('BSOC_APP_OPERATOR','bsoc.observability.read'),
('BSOC_APP_OPERATOR','bsoc.apps.read'),
('BSOC_APP_OPERATOR','bsoc.ads.read'),
('BSOC_APP_OPERATOR','bsoc.incidents.read'),
('BSOC_APP_OPERATOR','bsoc.knowledge.read'),
('BSOC_APP_OPERATOR','bsoc.training.read'),

-- Security operator
('BSOC_SECURITY_OPERATOR','bsoc.access'),
('BSOC_SECURITY_OPERATOR','bsoc.overview.read'),
('BSOC_SECURITY_OPERATOR','bsoc.work.read'),
('BSOC_SECURITY_OPERATOR','bsoc.user360.read'),
('BSOC_SECURITY_OPERATOR','bsoc.incidents.read'),
('BSOC_SECURITY_OPERATOR','bsoc.incidents.manage'),
('BSOC_SECURITY_OPERATOR','bsoc.security.read'),
('BSOC_SECURITY_OPERATOR','bsoc.security.manage'),
('BSOC_SECURITY_OPERATOR','bsoc.session.revoke'),
('BSOC_SECURITY_OPERATOR','bsoc.break_glass.request'),
('BSOC_SECURITY_OPERATOR','bsoc.knowledge.read'),
('BSOC_SECURITY_OPERATOR','bsoc.training.read'),
('BSOC_SECURITY_OPERATOR','bsoc.audit.read'),
('BSOC_SECURITY_OPERATOR','bsoc.audit.write'),

-- Read-only auditor
('BSOC_AUDITOR','bsoc.access'),
('BSOC_AUDITOR','bsoc.overview.read'),
('BSOC_AUDITOR','bsoc.support.read'),
('BSOC_AUDITOR','bsoc.user360.read'),
('BSOC_AUDITOR','bsoc.observability.read'),
('BSOC_AUDITOR','bsoc.moderation.read'),
('BSOC_AUDITOR','bsoc.organizations.read'),
('BSOC_AUDITOR','bsoc.apps.read'),
('BSOC_AUDITOR','bsoc.ads.read'),
('BSOC_AUDITOR','bsoc.incidents.read'),
('BSOC_AUDITOR','bsoc.features.read'),
('BSOC_AUDITOR','bsoc.notifications.read'),
('BSOC_AUDITOR','bsoc.releases.read'),
('BSOC_AUDITOR','bsoc.security.read'),
('BSOC_AUDITOR','bsoc.reports.read'),
('BSOC_AUDITOR','bsoc.knowledge.read'),
('BSOC_AUDITOR','bsoc.training.read'),
('BSOC_AUDITOR','bsoc.audit.read');

create table if not exists public.bsoc_operator_readiness (
  user_id uuid primary key references auth.users(id) on delete cascade,
  training_status text not null default 'NOT_STARTED'
    check (training_status in ('NOT_STARTED','IN_PROGRESS','CERTIFIED','SUSPENDED')),
  certification_version text,
  certified_at timestamptz,
  certified_by uuid references auth.users(id) on delete set null,
  production_access_enabled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bsoc_training_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null,
  status text not null default 'NOT_STARTED'
    check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED','PASSED','FAILED')),
  score numeric(5,2) check (score is null or (score >= 0 and score <= 100)),
  attempts integer not null default 0 check (attempts >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,module_key)
);

alter table public.bsoc_operator_readiness enable row level security;
alter table public.bsoc_training_progress enable row level security;

drop policy if exists "BSOC readiness self read" on public.bsoc_operator_readiness;
create policy "BSOC readiness self read"
on public.bsoc_operator_readiness for select to authenticated
using (user_id = (select auth.uid()) or public.buklod_is_system_admin());

drop policy if exists "BSOC training self read" on public.bsoc_training_progress;
create policy "BSOC training self read"
on public.bsoc_training_progress for select to authenticated
using (user_id = (select auth.uid()) or public.buklod_is_system_admin());

drop policy if exists "BSOC training self insert" on public.bsoc_training_progress;
create policy "BSOC training self insert"
on public.bsoc_training_progress for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "BSOC training self update" on public.bsoc_training_progress;
create policy "BSOC training self update"
on public.bsoc_training_progress for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.buklod_bsoc_can(p_permission_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  key text := lower(trim(coalesce(p_permission_key,'')));
  has_perm boolean := false;
  requires_cert boolean := false;
  ready boolean := false;
begin
  if actor is null or key = '' or key not like 'bsoc.%' then
    return false;
  end if;

  if public.buklod_is_system_admin() then
    return true;
  end if;

  select exists (
    select 1
    from public.buklod_scope_role_assignments ra
    join public.buklod_scopes s on s.id=ra.scope_id
    join public.buklod_role_permissions rp on rp.role_key=ra.role_key
    where ra.user_id=actor
      and ra.status='ACTIVE'
      and s.scope_type='SYSTEM'
      and s.status='ACTIVE'
      and rp.permission_key=key
  ) into has_perm;

  if not has_perm then
    return false;
  end if;

  requires_cert := key in (
    'bsoc.support.manage',
    'bsoc.moderation.manage',
    'bsoc.organizations.manage',
    'bsoc.apps.manage',
    'bsoc.incidents.manage',
    'bsoc.features.manage',
    'bsoc.notifications.manage',
    'bsoc.releases.manage',
    'bsoc.security.manage',
    'bsoc.session.revoke',
    'bsoc.break_glass.request',
    'bsoc.safe_recovery.execute',
    'bsoc.audit.write',
    'bsoc.exports.safe'
  );

  if not requires_cert then
    return true;
  end if;

  select coalesce(
    (
      select r.training_status='CERTIFIED' and r.production_access_enabled
      from public.bsoc_operator_readiness r
      where r.user_id=actor
    ),
    false
  ) into ready;

  return ready;
end;
$$;

revoke all on function public.buklod_bsoc_can(text) from public, anon;
grant execute on function public.buklod_bsoc_can(text) to authenticated;

create or replace function public.buklod_bsoc_has_access_v1()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.buklod_bsoc_can('bsoc.access')
$$;

revoke all on function public.buklod_bsoc_has_access_v1() from public, anon;
grant execute on function public.buklod_bsoc_has_access_v1() to authenticated;

create or replace function public.buklod_bsoc_my_access_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  roles jsonb := '[]'::jsonb;
  capabilities jsonb := '[]'::jsonb;
  readiness jsonb := null;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(jsonb_agg(distinct ra.role_key order by ra.role_key),'[]'::jsonb)
  into roles
  from public.buklod_scope_role_assignments ra
  join public.buklod_scopes s on s.id=ra.scope_id
  where ra.user_id=actor and ra.status='ACTIVE' and s.scope_type='SYSTEM' and s.status='ACTIVE'
    and (ra.role_key like 'BSOC_%' or ra.role_key='SYSTEM_ADMIN');

  select coalesce(jsonb_agg(x.permission_key order by x.permission_key),'[]'::jsonb)
  into capabilities
  from (
    select distinct p.permission_key
    from public.buklod_permissions p
    where p.permission_key like 'bsoc.%'
      and (
        public.buklod_is_system_admin()
        or public.buklod_bsoc_can(p.permission_key)
      )
  ) x;

  select jsonb_build_object(
    'training_status',r.training_status,
    'certification_version',r.certification_version,
    'certified_at',r.certified_at,
    'production_access_enabled',r.production_access_enabled
  )
  into readiness
  from public.bsoc_operator_readiness r
  where r.user_id=actor;

  return jsonb_build_object(
    'user_id',actor,
    'is_system_admin',public.buklod_is_system_admin(),
    'has_bsoc_access',public.buklod_bsoc_can('bsoc.access'),
    'roles',roles,
    'capabilities',capabilities,
    'readiness',readiness
  );
end;
$$;

revoke all on function public.buklod_bsoc_my_access_v1() from public, anon;
grant execute on function public.buklod_bsoc_my_access_v1() to authenticated;

create or replace function public.buklod_bsoc_assign_role_v1(
  p_user_id uuid,
  p_role_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  role_key text := upper(trim(coalesce(p_role_key,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
  system_scope uuid;
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then
    raise exception 'Reason is required';
  end if;
  if role_key not in (
    'BSOC_SUPPORT_MANAGER','BSOC_SUPPORT_AGENT','BSOC_MODERATION_MANAGER','BSOC_MODERATOR',
    'BSOC_ORG_SUPPORT','BSOC_APP_OPERATOR','BSOC_SECURITY_OPERATOR','BSOC_AUDITOR'
  ) then
    raise exception 'Unsupported BSOC role';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and coalesce(p.is_active,true)) then
    raise exception 'Active BUKLOD profile required';
  end if;

  select id into system_scope
  from public.buklod_scopes
  where scope_type='SYSTEM' and status='ACTIVE'
  order by created_at
  limit 1;

  if system_scope is null then
    raise exception 'BUKLOD SYSTEM scope missing';
  end if;

  insert into public.buklod_scope_role_assignments(scope_id,user_id,role_key,status,assigned_by,revoked_at,updated_at)
  values(system_scope,p_user_id,role_key,'ACTIVE',actor,null,now())
  on conflict(scope_id,user_id,role_key)
  do update set status='ACTIVE',assigned_by=actor,revoked_at=null,updated_at=now();

  insert into public.bsoc_operator_readiness(user_id)
  values(p_user_id)
  on conflict(user_id) do nothing;

  insert into public.bsoc_support_action_audit(
    actor_id,action_type,target_user_id,scope,reason,result,verification
  ) values(
    actor,'BSOC_ROLE_ASSIGN',p_user_id,'SYSTEM',reason,'applied',
    jsonb_build_object('role_key',role_key)::text
  );

  return jsonb_build_object('ok',true,'user_id',p_user_id,'role_key',role_key,'production_access_enabled',false);
end;
$$;

revoke all on function public.buklod_bsoc_assign_role_v1(uuid,text,text) from public, anon;
grant execute on function public.buklod_bsoc_assign_role_v1(uuid,text,text) to authenticated;

create or replace function public.buklod_bsoc_revoke_role_v1(
  p_user_id uuid,
  p_role_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  role_key text := upper(trim(coalesce(p_role_key,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if reason is null then
    raise exception 'Reason is required';
  end if;

  update public.buklod_scope_role_assignments ra
  set status='REVOKED',revoked_at=now(),updated_at=now()
  from public.buklod_scopes s
  where ra.scope_id=s.id
    and s.scope_type='SYSTEM'
    and ra.user_id=p_user_id
    and ra.role_key=role_key
    and ra.status='ACTIVE';

  insert into public.bsoc_support_action_audit(
    actor_id,action_type,target_user_id,scope,reason,result,verification
  ) values(
    actor,'BSOC_ROLE_REVOKE',p_user_id,'SYSTEM',reason,'applied',
    jsonb_build_object('role_key',role_key)::text
  );

  return jsonb_build_object('ok',true,'user_id',p_user_id,'role_key',role_key);
end;
$$;

revoke all on function public.buklod_bsoc_revoke_role_v1(uuid,text,text) from public, anon;
grant execute on function public.buklod_bsoc_revoke_role_v1(uuid,text,text) to authenticated;

create or replace function public.buklod_bsoc_set_operator_readiness_v1(
  p_user_id uuid,
  p_training_status text,
  p_production_access_enabled boolean,
  p_certification_version text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  st text := upper(trim(coalesce(p_training_status,'')));
  reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if actor is null or not public.buklod_is_system_admin() then
    raise exception 'System Administrator access required';
  end if;
  if st not in ('NOT_STARTED','IN_PROGRESS','CERTIFIED','SUSPENDED') then
    raise exception 'Invalid training status';
  end if;
  if reason is null then
    raise exception 'Reason is required';
  end if;
  if coalesce(p_production_access_enabled,false) and st <> 'CERTIFIED' then
    raise exception 'Production access requires CERTIFIED status';
  end if;

  insert into public.bsoc_operator_readiness(
    user_id,training_status,certification_version,certified_at,certified_by,
    production_access_enabled,note,updated_at
  ) values(
    p_user_id,st,nullif(trim(coalesce(p_certification_version,'')),''),
    case when st='CERTIFIED' then now() else null end,
    case when st='CERTIFIED' then actor else null end,
    coalesce(p_production_access_enabled,false),reason,now()
  )
  on conflict(user_id) do update set
    training_status=excluded.training_status,
    certification_version=excluded.certification_version,
    certified_at=excluded.certified_at,
    certified_by=excluded.certified_by,
    production_access_enabled=excluded.production_access_enabled,
    note=excluded.note,
    updated_at=now();

  insert into public.bsoc_support_action_audit(
    actor_id,action_type,target_user_id,scope,reason,result,verification
  ) values(
    actor,'BSOC_OPERATOR_READINESS',p_user_id,'SYSTEM',reason,'applied',
    jsonb_build_object(
      'training_status',st,
      'production_access_enabled',coalesce(p_production_access_enabled,false),
      'certification_version',nullif(trim(coalesce(p_certification_version,'')),'')
    )::text
  );

  return jsonb_build_object(
    'ok',true,
    'user_id',p_user_id,
    'training_status',st,
    'production_access_enabled',coalesce(p_production_access_enabled,false)
  );
end;
$$;

revoke all on function public.buklod_bsoc_set_operator_readiness_v1(uuid,text,boolean,text,text) from public, anon;
grant execute on function public.buklod_bsoc_set_operator_readiness_v1(uuid,text,boolean,text,text) to authenticated;

create or replace function public.buklod_bsoc_staff_list_v1()
returns table(
  user_id uuid,
  full_name text,
  role_key text,
  assignment_status text,
  training_status text,
  certification_version text,
  production_access_enabled boolean,
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null or not public.buklod_bsoc_can('bsoc.staff.read') then
    raise exception 'BUKLOD BSOC staff-read permission required';
  end if;

  return query
  select ra.user_id,
         p.full_name,
         ra.role_key,
         ra.status,
         coalesce(r.training_status,'NOT_STARTED'),
         r.certification_version,
         coalesce(r.production_access_enabled,false),
         ra.created_at
  from public.buklod_scope_role_assignments ra
  join public.buklod_scopes s on s.id=ra.scope_id and s.scope_type='SYSTEM'
  left join public.profiles p on p.id=ra.user_id
  left join public.bsoc_operator_readiness r on r.user_id=ra.user_id
  where ra.role_key like 'BSOC_%'
  order by coalesce(p.full_name,''),ra.role_key;
end;
$$;

revoke all on function public.buklod_bsoc_staff_list_v1() from public, anon;
grant execute on function public.buklod_bsoc_staff_list_v1() to authenticated;

-- Change only the BSOC RPC authorization gates; preserve their existing business logic.
do $$
declare
  r record;
  fdef text;
begin
  for r in
    select * from (values
      ('buklod_bsoc_feedback_metrics_v1','bsoc.observability.read'),
      ('buklod_bsoc_top_error_routes_v1','bsoc.observability.read'),
      ('buklod_bsoc_error_category_metrics_v1','bsoc.observability.read'),
      ('buklod_bsoc_recurring_errors_v1','bsoc.observability.read'),
      ('buklod_bsoc_source_freshness_v1','bsoc.observability.read'),
      ('buklod_bsoc_version_platform_metrics_v1','bsoc.observability.read'),
      ('buklod_bsoc_support_lookup_v1','bsoc.support.read'),
      ('buklod_bsoc_support_queue_v1','bsoc.support.read'),
      ('buklod_bsoc_lookup_context_v1','bsoc.support.read'),
      ('buklod_bsoc_user360_v1','bsoc.user360.read'),
      ('buklod_bsoc_incident_list_v1','bsoc.incidents.read'),
      ('buklod_bsoc_correlate_known_incidents_v1','bsoc.incidents.read'),
      ('buklod_bsoc_preview_support_case_action_v1','bsoc.support.manage'),
      ('buklod_bsoc_apply_support_case_action_v1','bsoc.support.manage'),
      ('buklod_bsoc_preview_incident_update_v1','bsoc.incidents.manage'),
      ('buklod_bsoc_apply_incident_update_v1','bsoc.incidents.manage'),
      ('buklod_bsoc_create_incident_v1','bsoc.incidents.manage'),
      ('buklod_bsoc_audit_list_v1','bsoc.audit.read'),
      ('buklod_bsoc_record_support_action_audit_v1','bsoc.audit.write')
    ) as x(proname,capability)
  loop
    select pg_get_functiondef(p.oid)
    into fdef
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=r.proname
    limit 1;

    if fdef is null then
      raise exception 'Missing expected BSOC function: %',r.proname;
    end if;

    fdef := replace(
      fdef,
      'not coalesce(public.buklod_is_system_admin(), false)',
      format('not coalesce(public.buklod_bsoc_can(%L), false)',r.capability)
    );
    fdef := replace(
      fdef,
      'System Administrator access required',
      'BUKLOD BSOC permission required: ' || r.capability
    );

    execute fdef;

    execute (
      select format('alter function %s security definer',p.oid::regprocedure)
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=r.proname
      limit 1
    );
  end loop;
end;
$$;

-- Underlying privileged mutation helpers are still bounded and now honor BSOC capabilities.
create or replace function public.resolve_user_feedback(
  p_feedback_id uuid,
  p_status public.feedback_status,
  p_resolution text default null,
  p_assigned_to uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.buklod_bsoc_can('bsoc.support.manage') then
    raise exception 'BUKLOD BSOC support-manage permission required';
  end if;

  update public.user_feedback
  set status=p_status,
      assigned_to=p_assigned_to,
      resolution=nullif(trim(p_resolution),''),
      resolved_at=case when p_status in ('resolved','closed') then now() else null end
  where id=p_feedback_id;

  if not found then
    raise exception 'Feedback record not found';
  end if;
end;
$$;

create or replace function public.update_pilot_incident(
  p_incident_id uuid,
  p_status public.incident_status,
  p_owner_id uuid default null,
  p_resolution text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.buklod_bsoc_can('bsoc.incidents.manage') then
    raise exception 'BUKLOD BSOC incident-manage permission required';
  end if;

  update public.pilot_incidents
  set status=p_status,
      owner_id=p_owner_id,
      resolution=nullif(trim(p_resolution),''),
      fix_ready_at=case when p_status='fix_ready' then coalesce(fix_ready_at,now()) else fix_ready_at end,
      retest_passed_at=case when p_status='retest_passed' then coalesce(retest_passed_at,now()) else retest_passed_at end,
      closed_at=case when p_status in ('closed','accepted') then coalesce(closed_at,now()) else null end
  where id=p_incident_id;

  if not found then
    raise exception 'Incident not found';
  end if;
end;
$$;

create or replace function public.create_pilot_incident(
  p_severity public.incident_severity,
  p_area text,
  p_title text,
  p_description text,
  p_environment text default 'staging',
  p_app_version text default null,
  p_platform text default null,
  p_linked_feedback_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  new_id uuid;
begin
  if not public.buklod_bsoc_can('bsoc.incidents.manage') then
    raise exception 'BUKLOD BSOC incident-manage permission required';
  end if;

  if nullif(trim(p_area),'') is null or nullif(trim(p_title),'') is null then
    raise exception 'Area and title are required';
  end if;

  insert into public.pilot_incidents(
    severity,area,title,description,environment,app_version,platform,
    linked_feedback_id,reported_by
  )
  values(
    p_severity,trim(p_area),trim(p_title),nullif(trim(p_description),''),
    p_environment,nullif(trim(p_app_version),''),nullif(trim(p_platform),''),
    p_linked_feedback_id,(select auth.uid())
  )
  returning id into new_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(
    (select auth.uid()),
    'create_pilot_incident',
    'pilot_incident',
    new_id::text,
    jsonb_build_object('severity',p_severity,'area',p_area,'environment',p_environment)
  );

  return new_id;
end;
$$;

-- Preserve explicit ACLs.
revoke all on function public.resolve_user_feedback(uuid,public.feedback_status,text,uuid) from public, anon;
grant execute on function public.resolve_user_feedback(uuid,public.feedback_status,text,uuid) to authenticated;
revoke all on function public.update_pilot_incident(uuid,public.incident_status,uuid,text) from public, anon;
grant execute on function public.update_pilot_incident(uuid,public.incident_status,uuid,text) to authenticated;
revoke all on function public.create_pilot_incident(public.incident_severity,text,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.create_pilot_incident(public.incident_severity,text,text,text,text,text,text,uuid) to authenticated;
