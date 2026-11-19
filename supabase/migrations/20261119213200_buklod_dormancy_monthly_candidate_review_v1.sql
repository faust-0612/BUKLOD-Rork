-- BUKLOD Main only: prospective dormant-account candidate workflow (non-destructive by default).
-- DO NOT deploy to a different Supabase project or merge into Season 2.
-- A dedicated, verified external notification service and complete data/payout
-- deletion executor are prerequisites to enabling automatic permanent deletion.
-- Never treat in-app notice creation as proof of delivery.
create schema if not exists private;

create table if not exists private.buklod_dormancy_policy_v1 (
  singleton boolean primary key default true check (singleton),
  monitoring_enabled boolean not null default false,
  automatic_deletion_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.buklod_dormancy_policy_v1(singleton)
values(true) on conflict(singleton) do nothing;
alter table private.buklod_dormancy_policy_v1 enable row level security;
revoke all on private.buklod_dormancy_policy_v1 from public, anon, authenticated;

create table if not exists private.buklod_dormancy_cases_v1 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING'
    check(status in ('PENDING','CANCELLED','DELETED','CLOSED_RETAINED')),
  required_action text not null default 'RECOVER_OR_CONFIRM'
    check(required_action in ('RECOVER_OR_CONFIRM','IDENTITY_REVIEW','SUPPORT_REVIEW')),
  last_sign_in_at_at_scan timestamptz not null,
  first_in_app_notice_at timestamptz not null default now(),
  -- Only a trusted server-side delivery integration may set this timestamp.
  verified_external_notice_at timestamptz,
  admin_hold boolean not null default false,
  admin_hold_reason text,
  admin_hold_at timestamptz,
  cancelled_at timestamptz,
  deletion_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists buklod_dormancy_one_open_case_v1
  on private.buklod_dormancy_cases_v1(user_id) where status='PENDING' and user_id is not null;
create index if not exists buklod_dormancy_pending_review_v1
  on private.buklod_dormancy_cases_v1(verified_external_notice_at,created_at)
  where status='PENDING';
alter table private.buklod_dormancy_cases_v1 enable row level security;
revoke all on private.buklod_dormancy_cases_v1 from public,anon,authenticated;

create table if not exists private.buklod_dormancy_audit_v1 (
  id bigint generated always as identity primary key,
  case_id uuid not null references private.buklod_dormancy_cases_v1(id),
  actor_id uuid,
  event text not null,
  created_at timestamptz not null default now()
);
alter table private.buklod_dormancy_audit_v1 enable row level security;
revoke all on private.buklod_dormancy_audit_v1 from public,anon,authenticated;

create table if not exists private.buklod_dormancy_monthly_runs_v1 (
  month_key text primary key,
  new_candidates integer not null,
  pending_candidates integer not null,
  held_candidates integer not null,
  unverified_delivery integer not null,
  deletion_executed integer not null default 0,
  completed_at timestamptz not null default now()
);
alter table private.buklod_dormancy_monthly_runs_v1 enable row level security;
revoke all on private.buklod_dormancy_monthly_runs_v1 from public,anon,authenticated;

-- Called only by a privileged server scheduler. New cases receive in-app
-- notifications; they DO NOT become deletable until external delivery and
-- retention / finance / storage reviews are independently completed.
create or replace function private.buklod_dormancy_monthly_review_v1(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_month text := to_char(p_now at time zone 'Asia/Manila','YYYY-MM');
  v_enabled boolean;
  v_new integer := 0;
  v_pending integer := 0;
  v_held integer := 0;
  v_undelivered integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('buklod-dormancy-monthly-v1',0));
  select monitoring_enabled into v_enabled
  from private.buklod_dormancy_policy_v1 where singleton=true;
  if v_enabled is distinct from true then
    return jsonb_build_object('status','disabled','month',v_month);
  end if;
  if exists(select 1 from private.buklod_dormancy_monthly_runs_v1 where month_key=v_month) then
    return jsonb_build_object('status','already_run','month',v_month);
  end if;

  -- A new authenticated sign-in is evidence of action and cancels the pending case.
  update private.buklod_dormancy_cases_v1 c
     set status='CANCELLED', cancelled_at=p_now, updated_at=p_now
  from auth.users a
  where c.user_id=a.id and c.status='PENDING'
    and a.last_sign_in_at > c.first_in_app_notice_at;
  insert into private.buklod_dormancy_audit_v1(case_id,event)
  select c.id,'CANCELLED_BY_SIGN_IN' from private.buklod_dormancy_cases_v1 c
  where c.cancelled_at=p_now and c.status='CANCELLED';

  -- Avoid username-only/no-contact legacy accounts; no inferred "last active"
  -- based on points, rank, or absence of engagement.
  with new_cases as (
    insert into private.buklod_dormancy_cases_v1(user_id,last_sign_in_at_at_scan,first_in_app_notice_at)
    select a.id,a.last_sign_in_at,p_now
    from auth.users a
    join public.profiles p on p.id=a.id
    where a.last_sign_in_at is not null
      and a.last_sign_in_at <= p_now - interval '180 days'
      and a.email_confirmed_at is not null
      and a.email is not null and a.email like '%@%'
      and lower(a.email) not like '%@buklod.invalid'
      and coalesce(p.is_active,true)=true
      and not exists (
        select 1 from public.user_roles ur
        where ur.user_id=a.id and ur.role='system_admin' and ur.is_active=true
      )
      and not exists (
        select 1 from private.buklod_dormancy_cases_v1 prior
        where prior.user_id=a.id and prior.status='PENDING'
      )
    on conflict do nothing
    returning id,user_id
  ), notices as (
    insert into public.notifications(user_id,title,body,kind,data)
    select user_id,
      'BUKLOD account security review',
      'Matagal nang hindi ginagamit ang iyong account. Mag-sign in o gamitin ang Account Recovery; walang awtomatikong deletion habang hindi kumpirmado ang abiso.',
      'account_dormancy',
      jsonb_build_object('route','/account/security','case_id',id::text)
    from new_cases
    returning user_id
  )
  select count(*) into v_new from notices;

  insert into private.buklod_dormancy_audit_v1(case_id,event)
  select c.id,'CANDIDATE_IN_APP_NOTICE'
  from private.buklod_dormancy_cases_v1 c
  where c.first_in_app_notice_at=p_now and c.status='PENDING';

  select count(*), count(*) filter(where admin_hold),
         count(*) filter(where verified_external_notice_at is null)
    into v_pending,v_held,v_undelivered
  from private.buklod_dormancy_cases_v1
  where status='PENDING';

  insert into private.buklod_dormancy_monthly_runs_v1
    (month_key,new_candidates,pending_candidates,held_candidates,unverified_delivery)
  values(v_month,v_new,v_pending,v_held,v_undelivered);

  -- One privacy-safe notification per System Admin per calendar month.
  insert into public.notifications(user_id,title,body,kind,data)
  select distinct ur.user_id,
    'Monthly account protection report',
    'Dormant candidates: '||v_pending||'; new: '||v_new||
       '; on hold: '||v_held||'; awaiting verified external notice: '||v_undelivered||'.',
    'account_dormancy_admin',
    jsonb_build_object('route','/admin/privacy','month',v_month)
  from public.user_roles ur
  join public.profiles p on p.id=ur.user_id
  where ur.role='system_admin' and ur.is_active=true and coalesce(p.is_active,true)=true;

  return jsonb_build_object('status','reported','month',v_month,
     'new',v_new,'pending',v_pending,'held',v_held,'undelivered',v_undelivered,
     'deleted',0);
end
$$;
revoke all on function private.buklod_dormancy_monthly_review_v1(timestamptz)
  from public,anon,authenticated;

create or replace function public.buklod_admin_dormancy_summary_v1()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_rows jsonb; v_runs jsonb;
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'user_id',x.user_id,'name',x.full_name,'username',x.username,
      'status',x.status,'required_action',x.required_action,
      'last_sign_in',x.last_sign_in_at_at_scan,'first_notice',x.first_in_app_notice_at,
      'verified_external_notice',x.verified_external_notice_at,
      'admin_hold',x.admin_hold,'admin_hold_reason',x.admin_hold_reason,
      'deletion_eligible_at',x.verified_external_notice_at + interval '180 days'
    ) order by x.created_at desc),'[]'::jsonb)
    into v_rows
  from (
    select c.*,p.full_name,p.username
    from private.buklod_dormancy_cases_v1 c
    left join public.profiles p on p.id=c.user_id
    where c.status='PENDING'
    order by c.created_at desc limit 100
  ) x;
  select coalesce(jsonb_agg(jsonb_build_object(
     'month',month_key,'new',new_candidates,'pending',pending_candidates,
     'held',held_candidates,'undelivered',unverified_delivery,
     'deleted',deletion_executed) order by month_key desc),'[]'::jsonb)
  into v_runs from (
    select * from private.buklod_dormancy_monthly_runs_v1
    order by month_key desc limit 12
  ) r;
  return jsonb_build_object('cases',v_rows,'months',v_runs,
    'auto_delete_live',false,'notice_requirement','VERIFIED_EXTERNAL_DELIVERY');
end
$$;
revoke all on function public.buklod_admin_dormancy_summary_v1()
  from public,anon;
grant execute on function public.buklod_admin_dormancy_summary_v1()
  to authenticated;

create or replace function public.buklod_admin_set_dormancy_hold_v1(
  p_case_id uuid,p_hold boolean,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin required' using errcode='42501';
  end if;
  if p_case_id is null or p_hold is null
     or (p_hold and length(trim(coalesce(p_reason,''))) < 8) then
    raise exception 'Case, hold and reason required' using errcode='22023';
  end if;
  update private.buklod_dormancy_cases_v1
     set admin_hold=p_hold,admin_hold_reason=case when p_hold then left(trim(p_reason),300) else null end,
         admin_hold_at=case when p_hold then now() else null end,updated_at=now()
   where id=p_case_id and status='PENDING'
   returning id into v_id;
  if v_id is null then raise exception 'Pending candidate not found' using errcode='P0002'; end if;
  insert into private.buklod_dormancy_audit_v1(case_id,actor_id,event)
  values(v_id,(select auth.uid()),case when p_hold then 'ADMIN_HOLD' else 'ADMIN_RELEASE_HOLD' end);
  return jsonb_build_object('ok',true,'hold',p_hold);
end
$$;
revoke all on function public.buklod_admin_set_dormancy_hold_v1(uuid,boolean,text)
  from public,anon;
grant execute on function public.buklod_admin_set_dormancy_hold_v1(uuid,boolean,text)
  to authenticated;

create or replace function public.buklod_my_dormancy_response_v1(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update private.buklod_dormancy_cases_v1
     set status='CANCELLED',cancelled_at=now(),updated_at=now()
   where id=p_case_id and user_id=(select auth.uid()) and status='PENDING'
   returning id into v_id;
  if v_id is null then raise exception 'No active review for this user' using errcode='P0002'; end if;
  insert into private.buklod_dormancy_audit_v1(case_id,actor_id,event)
  values(v_id,(select auth.uid()),'MEMBER_RESPONDED');
  return jsonb_build_object('ok',true,'status','CANCELLED');
end
$$;
revoke all on function public.buklod_my_dormancy_response_v1(uuid)
  from public,anon;
grant execute on function public.buklod_my_dormancy_response_v1(uuid)
  to authenticated;

-- Optional scheduler only: no monitoring or deletion when feature flag is OFF.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('buklod-dormancy-monthly-review-v1','15 2 1 * *',
      'select private.buklod_dormancy_monthly_review_v1()');
  end if;
end $$;

-- Intentionally absent: any auth.users DELETE or deleteUser call.
-- No verified external delivery, storage/finance/legal clearance or destructive
-- account cleanup runner is configured by this migration.
