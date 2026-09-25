
-- BSOC Feedback/Error Operations R1
-- Shared BUKLOD production backend.
-- Additive/backward-compatible. Reuses pilot_incidents as the single incident source of truth.

alter table public.pilot_incidents
  add column if not exists app_id text,
  add column if not exists build text,
  add column if not exists route text,
  add column if not exists error_category text,
  add column if not exists support_code text,
  add column if not exists operator_message text;

create index if not exists idx_pilot_incidents_bsoc_correlation
  on public.pilot_incidents (app_id, platform, route, opened_at desc);

create index if not exists idx_pilot_incidents_support_code
  on public.pilot_incidents (support_code)
  where support_code is not null;

create table if not exists public.bsoc_feedback_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid null,
  support_code text null,
  event_type text not null check (
    event_type in (
      'error_shown',
      'recovery_offered',
      'recovery_attempted',
      'recovery_success',
      'recovery_failed',
      'support_opened_after_error',
      'error_to_ticket',
      'user_abandoned_after_error',
      'known_incident_matched',
      'safe_recovery_action',
      'engineering_escalation'
    )
  ),
  error_category text null check (
    error_category is null or
    error_category in (
      'VALIDATION_ERROR',
      'AUTH_ERROR',
      'PERMISSION_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'CONFLICT_ERROR',
      'NOT_FOUND',
      'RATE_LIMIT',
      'SERVICE_UNAVAILABLE',
      'RECOVERY_REQUIRED',
      'KNOWN_INCIDENT',
      'UNKNOWN_ERROR'
    )
  ),
  app_id text null,
  app_version text null,
  build text null,
  platform text null,
  route text null,
  recovery_attempted boolean null,
  recovery_success boolean null,
  support_case_id uuid null references public.user_feedback(id) on delete set null,
  incident_id uuid null references public.pilot_incidents(id) on delete set null
);

create index if not exists idx_bsoc_feedback_events_occurred
  on public.bsoc_feedback_events (occurred_at desc);

create index if not exists idx_bsoc_feedback_events_support_code
  on public.bsoc_feedback_events (support_code)
  where support_code is not null;

create index if not exists idx_bsoc_feedback_events_app_route
  on public.bsoc_feedback_events (app_id, route, occurred_at desc);

create index if not exists idx_bsoc_feedback_events_category
  on public.bsoc_feedback_events (error_category, occurred_at desc);

create index if not exists idx_bsoc_feedback_events_support_case
  on public.bsoc_feedback_events (support_case_id)
  where support_case_id is not null;

create index if not exists idx_bsoc_feedback_events_incident
  on public.bsoc_feedback_events (incident_id)
  where incident_id is not null;

create table if not exists public.bsoc_support_action_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null default auth.uid(),
  occurred_at timestamptz not null default now(),
  action_type text not null,
  target_user_id uuid null,
  support_case_id uuid null references public.user_feedback(id) on delete set null,
  incident_id uuid null references public.pilot_incidents(id) on delete set null,
  scope text null,
  reason text not null,
  result text not null,
  verification text null
);

create index if not exists idx_bsoc_support_action_audit_actor
  on public.bsoc_support_action_audit (actor_id, occurred_at desc);

create index if not exists idx_bsoc_support_action_audit_case
  on public.bsoc_support_action_audit (support_case_id, occurred_at desc)
  where support_case_id is not null;

create index if not exists idx_bsoc_support_action_audit_incident
  on public.bsoc_support_action_audit (incident_id, occurred_at desc)
  where incident_id is not null;

alter table public.bsoc_feedback_events enable row level security;
alter table public.bsoc_support_action_audit enable row level security;

revoke all on public.bsoc_feedback_events from anon;
revoke all on public.bsoc_feedback_events from authenticated;
revoke all on public.bsoc_support_action_audit from anon;
revoke all on public.bsoc_support_action_audit from authenticated;

grant select on public.bsoc_feedback_events to authenticated;
grant select on public.bsoc_support_action_audit to authenticated;

drop policy if exists "bsoc_feedback_events_admin_read"
  on public.bsoc_feedback_events;
create policy "bsoc_feedback_events_admin_read"
  on public.bsoc_feedback_events
  for select
  to authenticated
  using (public.buklod_is_system_admin());

drop policy if exists "bsoc_support_action_audit_admin_read"
  on public.bsoc_support_action_audit;
create policy "bsoc_support_action_audit_admin_read"
  on public.bsoc_support_action_audit
  for select
  to authenticated
  using (public.buklod_is_system_admin());

create or replace function public.buklod_record_feedback_event_v1(
  p_event_type text,
  p_error_category text default null,
  p_support_code text default null,
  p_app_id text default null,
  p_app_version text default null,
  p_build text default null,
  p_platform text default null,
  p_route text default null,
  p_recovery_attempted boolean default null,
  p_recovery_success boolean default null,
  p_support_case_id uuid default null,
  p_incident_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  actor_is_admin boolean := false;
  event_id uuid;
  safe_support_code text := null;
  safe_support_case_id uuid := null;
  safe_incident_id uuid := null;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  actor_is_admin := coalesce(public.buklod_is_system_admin(), false);

  if p_event_type not in (
    'error_shown',
    'recovery_offered',
    'recovery_attempted',
    'recovery_success',
    'recovery_failed',
    'support_opened_after_error',
    'error_to_ticket',
    'user_abandoned_after_error',
    'known_incident_matched',
    'safe_recovery_action',
    'engineering_escalation'
  ) then
    raise exception 'Unsupported feedback event';
  end if;

  if p_error_category is not null and p_error_category not in (
    'VALIDATION_ERROR',
    'AUTH_ERROR',
    'PERMISSION_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONFLICT_ERROR',
    'NOT_FOUND',
    'RATE_LIMIT',
    'SERVICE_UNAVAILABLE',
    'RECOVERY_REQUIRED',
    'KNOWN_INCIDENT',
    'UNKNOWN_ERROR'
  ) then
    raise exception 'Unsupported error category';
  end if;

  if p_support_code is not null then
    safe_support_code := upper(trim(p_support_code));
    if safe_support_code !~ '^[A-Z][A-Z0-9_]{1,15}-[A-Z0-9]{2,16}$' then
      safe_support_code := null;
    end if;
  end if;

  if p_support_case_id is not null then
    if actor_is_admin or exists (
      select 1
      from public.user_feedback uf
      where uf.id = p_support_case_id
        and uf.user_id = actor
    ) then
      safe_support_case_id := p_support_case_id;
    end if;
  end if;

  if p_incident_id is not null and actor_is_admin then
    safe_incident_id := p_incident_id;
  end if;

  insert into public.bsoc_feedback_events (
    user_id,
    support_code,
    event_type,
    error_category,
    app_id,
    app_version,
    build,
    platform,
    route,
    recovery_attempted,
    recovery_success,
    support_case_id,
    incident_id
  )
  values (
    actor,
    safe_support_code,
    p_event_type,
    p_error_category,
    nullif(left(trim(coalesce(p_app_id,'')), 80), ''),
    nullif(left(trim(coalesce(p_app_version,'')), 80), ''),
    nullif(left(trim(coalesce(p_build,'')), 80), ''),
    nullif(left(trim(coalesce(p_platform,'')), 80), ''),
    nullif(left(trim(coalesce(p_route,'')), 240), ''),
    p_recovery_attempted,
    p_recovery_success,
    safe_support_case_id,
    safe_incident_id
  )
  returning id into event_id;

  return event_id;
end;
$function$;

revoke all on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) from public;

grant execute on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) to authenticated;

create or replace function public.buklod_bsoc_record_support_action_audit_v1(
  p_action_type text,
  p_reason text,
  p_result text,
  p_target_user_id uuid default null,
  p_support_case_id uuid default null,
  p_incident_id uuid default null,
  p_scope text default null,
  p_verification text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  audit_id uuid;
begin
  if actor is null or not coalesce(public.buklod_is_system_admin(), false) then
    raise exception 'System Administrator access required';
  end if;

  if nullif(trim(coalesce(p_action_type,'')), '') is null then
    raise exception 'Action type is required';
  end if;

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'Reason is required';
  end if;

  if nullif(trim(coalesce(p_result,'')), '') is null then
    raise exception 'Result is required';
  end if;

  insert into public.bsoc_support_action_audit (
    actor_id,
    action_type,
    target_user_id,
    support_case_id,
    incident_id,
    scope,
    reason,
    result,
    verification
  )
  values (
    actor,
    left(trim(p_action_type), 120),
    p_target_user_id,
    p_support_case_id,
    p_incident_id,
    nullif(left(trim(coalesce(p_scope,'')), 240), ''),
    left(trim(p_reason), 1000),
    left(trim(p_result), 1000),
    nullif(left(trim(coalesce(p_verification,'')), 1000), '')
  )
  returning id into audit_id;

  return audit_id;
end;
$function$;

revoke all on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) from public;

grant execute on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) to authenticated;

create or replace view public.bsoc_known_incidents_v1
with (security_invoker = true)
as
select
  pi.id,
  pi.severity,
  pi.status,
  pi.area,
  pi.title,
  pi.description,
  pi.environment,
  pi.app_id,
  pi.app_version,
  pi.build,
  pi.platform,
  pi.route,
  pi.error_category,
  pi.support_code,
  pi.operator_message,
  pi.linked_feedback_id,
  pi.owner_id,
  pi.reported_by,
  pi.resolution,
  pi.opened_at,
  pi.fix_ready_at,
  pi.retest_passed_at,
  pi.closed_at,
  pi.updated_at
from public.pilot_incidents pi;

revoke all on public.bsoc_known_incidents_v1 from anon;
revoke all on public.bsoc_known_incidents_v1 from authenticated;
grant select on public.bsoc_known_incidents_v1 to authenticated;

comment on table public.bsoc_feedback_events is
  'Normalized BUKLOD feedback/error telemetry. No raw stack traces or private user content should be stored here.';

comment on table public.bsoc_support_action_audit is
  'Append-only operational audit records written through authorized BSOC support-action functions.';

comment on view public.bsoc_known_incidents_v1 is
  'BSOC read model over existing pilot_incidents; avoids a duplicate incident source of truth.';
