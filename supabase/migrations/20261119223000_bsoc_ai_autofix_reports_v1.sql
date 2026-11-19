-- Additive BSOC automation foundation. No backfill, production release, or Season 2 rules.
create table if not exists public.bsoc_ai_case_jobs (
  case_id uuid primary key references public.user_feedback(id) on delete cascade,
  state text not null default 'PENDING' check (state in
    ('PENDING','INVESTIGATING','TRIAGED','NEEDS_DETAILS','NEEDS_HUMAN',
     'DEV_FIX_REQUESTED','DEV_FIX_READY','AWAITING_RELEASE_VERIFICATION','VERIFIED_RESOLVED','FAILED')),
  attempts integer not null default 0 check(attempts between 0 and 5),
  leased_until timestamptz,
  next_attempt_at timestamptz not null default now(),
  error_code text, safe_analysis text, issue_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bsoc_ai_case_jobs_ready_idx
  on public.bsoc_ai_case_jobs(next_attempt_at,created_at) where state in ('PENDING','FAILED');
alter table public.bsoc_ai_case_jobs enable row level security;
revoke all on public.bsoc_ai_case_jobs from public, anon, authenticated;
grant select,insert,update on public.bsoc_ai_case_jobs to service_role;

create table if not exists public.bsoc_ai_case_reports (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.user_feedback(id) on delete cascade,
  phase text not null check (phase in
    ('RECEIVED','REOPENED','INVESTIGATING','TRIAGED','NEEDS_DETAILS','NEEDS_HUMAN',
     'DEV_FIX_READY','AWAITING_RELEASE_VERIFICATION','VERIFIED_RESOLVED','FAILED')),
  report_key text not null check(length(report_key) between 3 and 160),
  member_message text not null check(length(member_message) between 8 and 1200),
  created_at timestamptz not null default now(),
  unique(case_id,report_key)
);
create index if not exists bsoc_ai_case_reports_case_time_idx
  on public.bsoc_ai_case_reports(case_id,created_at desc);
alter table public.bsoc_ai_case_reports enable row level security;
revoke all on public.bsoc_ai_case_reports from public,anon,authenticated;
grant select on public.bsoc_ai_case_reports to authenticated;
grant select,insert on public.bsoc_ai_case_reports to service_role;
create policy bsoc_ai_member_read_own_reports_v1 on public.bsoc_ai_case_reports
  for select to authenticated using (
    exists(select 1 from public.user_feedback f
      where f.id=case_id and f.user_id=(select auth.uid()))
  );

create or replace function private.bsoc_ai_emit_member_report_v1(
  p_case_id uuid,p_phase text,p_report_key text,p_message text
) returns boolean language plpgsql security definer set search_path='' as $fn$
declare member_id uuid; stored_id uuid;
begin
  if p_phase not in ('RECEIVED','REOPENED','INVESTIGATING','TRIAGED','NEEDS_DETAILS',
       'NEEDS_HUMAN','DEV_FIX_READY','AWAITING_RELEASE_VERIFICATION','VERIFIED_RESOLVED','FAILED')
     or length(p_report_key) not between 3 and 160
     or length(p_message) not between 8 and 1200 then
    raise exception 'Invalid BSOC report phase, key or content';
  end if;
  select f.user_id into member_id from public.user_feedback f where f.id=p_case_id;
  if member_id is null then return false; end if;
  insert into public.bsoc_ai_case_reports(case_id,phase,report_key,member_message)
    values(p_case_id,p_phase,p_report_key,p_message)
    on conflict(case_id,report_key) do nothing returning id into stored_id;
  if stored_id is null then return false; end if;
  insert into public.notifications(user_id,kind,title,body,data)
    values(member_id,'bsoc_case_update','BUKLOD Support · Update',left(p_message,220),
      jsonb_build_object('case_id',p_case_id,'phase',p_phase,
                         'source','BSOC_AI_CASE_REPORT','route','/support/live'));
  return true;
end;
$fn$;
revoke all on function private.bsoc_ai_emit_member_report_v1(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.bsoc_ai_emit_member_report_v1(uuid,text,text,text) to service_role;

create or replace function private.bsoc_ai_enqueue_new_case_v1() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  insert into public.bsoc_ai_case_jobs(case_id,state)
    values(new.id,'PENDING') on conflict(case_id) do nothing;
  perform private.bsoc_ai_emit_member_report_v1(new.id,'RECEIVED','receipt-v1',
    'Natanggap ng BSOC ang iyong concern. Susuriin ito at magbibigay ng update dito. Hindi pa ibig sabihing naayos na ang problema.');
  return new;
end;
$fn$;
revoke all on function private.bsoc_ai_enqueue_new_case_v1() from public,anon,authenticated;
drop trigger if exists bsoc_ai_enqueue_new_case_v1 on public.user_feedback;
create trigger bsoc_ai_enqueue_new_case_v1 after insert on public.user_feedback
  for each row execute function private.bsoc_ai_enqueue_new_case_v1();

create or replace function private.bsoc_ai_enqueue_reopened_case_v1() returns trigger
language plpgsql security definer set search_path='' as $fn$
begin
  if old.status in ('resolved'::public.feedback_status,'closed'::public.feedback_status)
     and new.status='in_progress'::public.feedback_status then
    insert into public.bsoc_ai_case_jobs(case_id,state,attempts,leased_until,
                                        next_attempt_at,error_code,safe_analysis,issue_url,updated_at)
      values(new.id,'PENDING',0,null,now(),null,null,null,now())
      on conflict(case_id) do update set state='PENDING',attempts=0,leased_until=null,
        next_attempt_at=now(),error_code=null,safe_analysis=null,issue_url=null,updated_at=now();
    perform private.bsoc_ai_emit_member_report_v1(new.id,'REOPENED',
      'reopened-'||to_char(new.updated_at at time zone 'UTC','YYYYMMDDHH24MISSUS'),
      'Muling binuksan ng BSOC ang concern mo. Magsasagawa ng panibagong investigation.');
  end if;
  return new;
end;
$fn$;
revoke all on function private.bsoc_ai_enqueue_reopened_case_v1() from public,anon,authenticated;
drop trigger if exists bsoc_ai_enqueue_reopened_case_v1 on public.user_feedback;
create trigger bsoc_ai_enqueue_reopened_case_v1 after update of status on public.user_feedback
  for each row when (old.status is distinct from new.status)
  execute function private.bsoc_ai_enqueue_reopened_case_v1();

-- Service-role-only response; VERIFIED_RESOLVED requires existing audited fix evidence.
create or replace function public.buklod_bsoc_ai_member_report_v1(
  p_case_id uuid,p_phase text,p_report_key text,p_message text
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare existing_fix public.bsoc_case_fix_tracking%rowtype; inserted boolean;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Service authorization required' using errcode='42501';
  end if;
  if p_phase='VERIFIED_RESOLVED' then
    select * into existing_fix from public.bsoc_case_fix_tracking
      where case_id=p_case_id and stage='VERIFIED_RESOLVED' and verified_at is not null;
    if not found then raise exception 'Verified production fix evidence is required'; end if;
  end if;
  inserted:=private.bsoc_ai_emit_member_report_v1(p_case_id,p_phase,p_report_key,p_message);
  return jsonb_build_object('case_id',p_case_id,'phase',p_phase,'sent',inserted,'idempotent',not inserted);
end;
$fn$;
revoke all on function public.buklod_bsoc_ai_member_report_v1(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.buklod_bsoc_ai_member_report_v1(uuid,text,text,text) to service_role;
-- Activation of inference, cron and dispatch must pass separate QA and budget gates.
