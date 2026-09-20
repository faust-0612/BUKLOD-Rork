-- BUKLOD CENTRAL SUPPORT V1
-- One user-facing support path:
-- BUKLOD HELP -> diagnostics -> self-heal -> case if unresolved -> BSOC Support Inbox
-- Additive only. Existing SOS/location-help tables remain separate emergency infrastructure.

create sequence if not exists public.buklod_support_case_number_seq start with 1 increment by 1;
create sequence if not exists public.buklod_support_incident_number_seq start with 1 increment by 1;

create table if not exists public.buklod_bsoc_staff_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_code text not null check (role_code in (
    'SUPPORT','MODERATION','COMMUNITY_OPS','ENGINEERING','FINANCE_ESCALATION','ADMIN'
  )),
  active boolean not null default true,
  scopes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.buklod_support_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_code text not null unique default (
    'INC-' || lpad(nextval('public.buklod_support_incident_number_seq')::text, 5, '0')
  ),
  fingerprint text not null,
  app text not null default 'BUKLOD Main',
  feature text,
  category text not null,
  platform_scope text,
  error_code text,
  status text not null default 'INVESTIGATING'
    check (status in ('POSSIBLE_SHARED_INCIDENT','INVESTIGATING','IDENTIFIED','MONITORING','RESOLVED')),
  severity text not null default 'P2'
    check (severity in ('P0','P1','P2','P3')),
  title text not null,
  public_message text not null default '',
  internal_summary text not null default '',
  affected_users integer not null default 0 check (affected_users >= 0),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists buklod_support_incidents_active_fingerprint_uidx
on public.buklod_support_incidents(fingerprint)
where status <> 'RESOLVED';

create index if not exists buklod_support_incidents_lookup_idx
on public.buklod_support_incidents(app,category,status,opened_at desc);

create table if not exists public.buklod_support_cases (
  id uuid primary key default gen_random_uuid(),
  case_code text not null unique default (
    'BUK-' || lpad(nextval('public.buklod_support_case_number_seq')::text, 5, '0')
  ),
  source_type text not null default 'BUKLOD_HELP',
  source_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  identifier_hash text,
  identifier_hint text,
  public_access_token_hash text,
  status text not null default 'OPEN'
    check (status in ('OPEN','WAITING_FOR_USER','BEING_REVIEWED','RESOLVED')),
  queue_code text not null
    check (queue_code in (
      'ACCOUNT_SUPPORT','QUIZ_SUPPORT','CLASSROOM_SUPPORT','COMMUNITY_OPERATIONS',
      'MODERATION','OPERATIONS_ENGINEERING','FINANCE_ESCALATION','GENERAL_SUPPORT'
    )),
  category text not null,
  app text not null default 'BUKLOD Main',
  feature text,
  title text not null,
  message text not null default '',
  platform text,
  os_version text,
  app_version text,
  route text,
  error_code text,
  language_code text,
  network_summary jsonb not null default '{}'::jsonb,
  diagnostics jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  incident_id uuid references public.buklod_support_incidents(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint buklod_support_cases_source_unique unique(source_type, source_id)
);

create index if not exists buklod_support_cases_status_queue_idx
on public.buklod_support_cases(status,queue_code,created_at desc);

create index if not exists buklod_support_cases_fingerprint_idx
on public.buklod_support_cases(fingerprint,created_at desc);

create index if not exists buklod_support_cases_user_idx
on public.buklod_support_cases(user_id,created_at desc);

create index if not exists buklod_support_cases_incident_idx
on public.buklod_support_cases(incident_id,created_at desc);

create table if not exists public.buklod_support_case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.buklod_support_cases(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'INTERNAL'
    check (visibility in ('USER','INTERNAL')),
  update_type text not null default 'NOTE',
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists buklod_support_case_updates_case_idx
on public.buklod_support_case_updates(case_id,created_at desc);

create table if not exists public.buklod_support_incident_subscribers (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.buklod_support_incidents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  subject_hash text not null,
  language_code text,
  notify_when_resolved boolean not null default true,
  created_at timestamptz not null default now(),
  unique(incident_id,subject_hash)
);

alter table public.buklod_bsoc_staff_assignments enable row level security;
alter table public.buklod_support_incidents enable row level security;
alter table public.buklod_support_cases enable row level security;
alter table public.buklod_support_case_updates enable row level security;
alter table public.buklod_support_incident_subscribers enable row level security;

revoke all on table public.buklod_bsoc_staff_assignments from anon, authenticated;
revoke all on table public.buklod_support_incidents from anon, authenticated;
revoke all on table public.buklod_support_cases from anon, authenticated;
revoke all on table public.buklod_support_case_updates from anon, authenticated;
revoke all on table public.buklod_support_incident_subscribers from anon, authenticated;
revoke all on sequence public.buklod_support_case_number_seq from anon, authenticated;
revoke all on sequence public.buklod_support_incident_number_seq from anon, authenticated;

create or replace function public.buklod_bsoc_staff_role_v1()
returns text
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then
    return null;
  end if;

  if public.buklod_actor_is_system_admin_v1() then
    return 'ADMIN';
  end if;

  select s.role_code into v_role
  from public.buklod_bsoc_staff_assignments s
  where s.user_id=v_uid and s.active=true
  limit 1;

  return v_role;
end;
$$;

revoke all on function public.buklod_bsoc_staff_role_v1() from public, anon;
grant execute on function public.buklod_bsoc_staff_role_v1() to authenticated;

create or replace function public.buklod_bsoc_support_inbox_v1(
  p_limit integer default 100,
  p_status text default null,
  p_queue text default null,
  p_search text default null
)
returns table(
  case_code text,
  status text,
  queue_code text,
  category text,
  app text,
  feature text,
  title text,
  message text,
  platform text,
  app_version text,
  route text,
  error_code text,
  language_code text,
  diagnostics jsonb,
  incident_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text := public.buklod_bsoc_staff_role_v1();
  v_limit integer := greatest(1,least(coalesce(p_limit,100),250));
  v_search text := nullif(trim(coalesce(p_search,'')),'');
begin
  if v_role is null then
    raise exception 'not_authorized';
  end if;

  return query
  select
    c.case_code,
    c.status,
    c.queue_code,
    c.category,
    c.app,
    c.feature,
    c.title,
    case
      when c.queue_code='FINANCE_ESCALATION' and v_role not in ('FINANCE_ESCALATION','ADMIN')
        then 'Restricted financial inquiry'
      else c.message
    end as message,
    c.platform,
    c.app_version,
    c.route,
    c.error_code,
    c.language_code,
    case
      when c.queue_code='FINANCE_ESCALATION' and v_role not in ('FINANCE_ESCALATION','ADMIN')
        then '{}'::jsonb
      else c.diagnostics
    end as diagnostics,
    i.incident_code,
    c.created_at,
    c.updated_at
  from public.buklod_support_cases c
  left join public.buklod_support_incidents i on i.id=c.incident_id
  where (p_status is null or c.status=p_status)
    and (p_queue is null or c.queue_code=p_queue)
    and (
      v_search is null
      or c.case_code ilike '%'||v_search||'%'
      or c.title ilike '%'||v_search||'%'
      or c.category ilike '%'||v_search||'%'
      or coalesce(c.error_code,'') ilike '%'||v_search||'%'
    )
  order by
    case c.status
      when 'OPEN' then 0
      when 'BEING_REVIEWED' then 1
      when 'WAITING_FOR_USER' then 2
      else 3
    end,
    c.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.buklod_bsoc_support_inbox_v1(integer,text,text,text) from public, anon;
grant execute on function public.buklod_bsoc_support_inbox_v1(integer,text,text,text) to authenticated;

create or replace function public.buklod_bsoc_incidents_v1(
  p_limit integer default 100,
  p_include_resolved boolean default false
)
returns table(
  incident_code text,
  status text,
  severity text,
  app text,
  feature text,
  category text,
  platform_scope text,
  error_code text,
  title text,
  public_message text,
  affected_users integer,
  opened_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text := public.buklod_bsoc_staff_role_v1();
begin
  if v_role is null then
    raise exception 'not_authorized';
  end if;

  return query
  select
    i.incident_code,i.status,i.severity,i.app,i.feature,i.category,
    i.platform_scope,i.error_code,i.title,i.public_message,i.affected_users,
    i.opened_at,i.updated_at
  from public.buklod_support_incidents i
  where p_include_resolved or i.status <> 'RESOLVED'
  order by
    case i.severity when 'P0' then 0 when 'P1' then 1 when 'P2' then 2 else 3 end,
    i.opened_at desc
  limit greatest(1,least(coalesce(p_limit,100),250));
end;
$$;

revoke all on function public.buklod_bsoc_incidents_v1(integer,boolean) from public, anon;
grant execute on function public.buklod_bsoc_incidents_v1(integer,boolean) to authenticated;

create or replace function public.buklod_bsoc_support_metrics_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role text := public.buklod_bsoc_staff_role_v1();
  v_result jsonb;
begin
  if v_role is null then
    raise exception 'not_authorized';
  end if;

  select jsonb_build_object(
    'open', count(*) filter (where c.status='OPEN'),
    'being_reviewed', count(*) filter (where c.status='BEING_REVIEWED'),
    'waiting_for_user', count(*) filter (where c.status='WAITING_FOR_USER'),
    'resolved_24h', count(*) filter (
      where c.status='RESOLVED' and c.resolved_at >= now()-interval '24 hours'
    ),
    'active_incidents', (
      select count(*) from public.buklod_support_incidents i where i.status<>'RESOLVED'
    )
  )
  into v_result
  from public.buklod_support_cases c;

  return coalesce(v_result,'{}'::jsonb);
end;
$$;

revoke all on function public.buklod_bsoc_support_metrics_v1() from public, anon;
grant execute on function public.buklod_bsoc_support_metrics_v1() to authenticated;

create or replace function public.buklod_bsoc_update_support_case_v1(
  p_case_code text,
  p_status text,
  p_user_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text := public.buklod_bsoc_staff_role_v1();
  v_case public.buklod_support_cases;
  v_message text := nullif(trim(coalesce(p_user_message,'')),'');
begin
  if v_role is null then
    raise exception 'not_authorized';
  end if;
  if p_status not in ('OPEN','WAITING_FOR_USER','BEING_REVIEWED','RESOLVED') then
    raise exception 'invalid_status';
  end if;

  select * into v_case
  from public.buklod_support_cases
  where case_code=upper(trim(p_case_code))
  for update;

  if v_case.id is null then
    raise exception 'case_not_found';
  end if;

  if v_case.queue_code='FINANCE_ESCALATION'
     and v_role not in ('FINANCE_ESCALATION','ADMIN') then
    raise exception 'finance_restricted';
  end if;

  update public.buklod_support_cases
  set status=p_status,
      updated_at=now(),
      assigned_to=coalesce(assigned_to,auth.uid()),
      resolved_at=case when p_status='RESOLVED' then coalesce(resolved_at,now()) else null end
  where id=v_case.id;

  if v_message is not null then
    insert into public.buklod_support_case_updates(
      case_id,actor_id,visibility,update_type,message
    ) values (
      v_case.id,auth.uid(),'USER','STATUS_UPDATE',left(v_message,1500)
    );
  end if;

  return jsonb_build_object('ok',true,'case_code',v_case.case_code,'status',p_status);
end;
$$;

revoke all on function public.buklod_bsoc_update_support_case_v1(text,text,text) from public, anon;
grant execute on function public.buklod_bsoc_update_support_case_v1(text,text,text) to authenticated;

create or replace function public.buklod_feedback_to_support_case_v1()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_queue text := 'GENERAL_SUPPORT';
  v_category text := coalesce(new.category::text,'OTHER');
  v_fingerprint text;
begin
  if v_category ilike '%quiz%' then v_queue := 'QUIZ_SUPPORT';
  elsif v_category ilike '%class%' then v_queue := 'CLASSROOM_SUPPORT';
  elsif v_category ilike '%org%' or v_category ilike '%cluster%' then v_queue := 'COMMUNITY_OPERATIONS';
  elsif v_category ilike '%content%' or v_category ilike '%abuse%' then v_queue := 'MODERATION';
  elsif v_category ilike '%login%' or v_category ilike '%account%' then v_queue := 'ACCOUNT_SUPPORT';
  elsif v_category ilike '%technical%' or v_category ilike '%bug%' then v_queue := 'OPERATIONS_ENGINEERING';
  end if;

  v_fingerprint := encode(
    digest(
      lower('BUKLOD Main|'||v_category||'|'||coalesce(new.app_version,'')||'|'||
        coalesce(new.diagnostics->>'platform','')||'|'||
        coalesce(new.diagnostics->>'error_code','')),
      'sha256'
    ),
    'hex'
  );

  insert into public.buklod_support_cases(
    source_type,source_id,user_id,status,queue_code,category,app,title,message,
    platform,app_version,route,error_code,language_code,network_summary,
    diagnostics,fingerprint
  ) values (
    'USER_FEEDBACK',new.id,new.user_id,'OPEN',v_queue,v_category,'BUKLOD Main',
    left(new.title,200),left(new.message,4000),
    left(coalesce(new.diagnostics->>'platform',''),40),
    left(coalesce(new.app_version,''),40),
    left(coalesce(new.diagnostics->>'route',''),240),
    left(coalesce(new.diagnostics->>'error_code',''),120),
    left(coalesce(new.diagnostics->>'language_code',''),24),
    coalesce(new.diagnostics->'network_summary','{}'::jsonb),
    coalesce(new.diagnostics,'{}'::jsonb),
    v_fingerprint
  )
  on conflict (source_type,source_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_buklod_feedback_to_support_case_v1 on public.user_feedback;
create trigger trg_buklod_feedback_to_support_case_v1
after insert on public.user_feedback
for each row execute function public.buklod_feedback_to_support_case_v1();

revoke all on function public.buklod_feedback_to_support_case_v1() from public, anon, authenticated;

comment on table public.buklod_support_cases is
'Canonical BUKLOD Help cases. User-facing status is exposed only through controlled support APIs; internal notes remain private.';
comment on table public.buklod_support_incidents is
'Canonical BSOC shared incident store used to correlate many user cases into one technical investigation.';
