-- BUKLOD MAIN: retire new username logins, preserve existing accounts during verified migration.
-- DEV ONLY. The authoritative BUKLOD Main production database is NOT connected.
-- Existing user IDs, profile usernames, posts, points, payments and referrals are unchanged.

create schema if not exists private;

-- Covers legacy installed signup clients, not merely the current registration UI.
-- Existing accounts are never touched by this INSERT-only trigger.
create or replace function private.buklod_reject_new_username_signup_v1()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if lower(coalesce(new.raw_user_meta_data->>'login_method',''))='username'
     or lower(coalesce(new.email,'')) ~ '^u\.[a-z0-9._-]+@buklod\.invalid$' then
    raise exception 'New BUKLOD registration requires a mobile number or email; username signup is retired'
      using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function private.buklod_reject_new_username_signup_v1() from public,anon,authenticated;
drop trigger if exists buklod_reject_new_username_signup_v1 on auth.users;
create trigger buklod_reject_new_username_signup_v1
  before insert on auth.users for each row
  execute function private.buklod_reject_new_username_signup_v1();

create table if not exists private.buklod_login_contact_policy_v1(
  singleton boolean primary key default true check(singleton),
  legacy_reminders_enabled boolean not null default false,
  external_reminders_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into private.buklod_login_contact_policy_v1(singleton)
values(true) on conflict(singleton) do nothing;
alter table private.buklod_login_contact_policy_v1 enable row level security;
revoke all on private.buklod_login_contact_policy_v1 from public,anon,authenticated;

create table if not exists public.buklod_login_contact_challenges_v1(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check(channel in ('email','mobile')),
  -- Private; never available via frontend RLS. Only a trusted Edge Function writes this.
  destination text not null,
  otp_hash text,
  attempts integer not null default 0 check(attempts between 0 and 5),
  status text not null default 'PENDING'
    check(status in ('PENDING','VERIFIED','COMPLETED','FAILED','CANCELLED')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '10 minutes'),
  verified_at timestamptz,
  completed_at timestamptz
);
create unique index if not exists buklod_login_contact_one_active_v1
  on public.buklod_login_contact_challenges_v1(user_id)
  where status in ('PENDING','VERIFIED');
create index if not exists buklod_login_contact_send_limits_v1
  on public.buklod_login_contact_challenges_v1(user_id,created_at desc);
alter table public.buklod_login_contact_challenges_v1 enable row level security;
revoke all on public.buklod_login_contact_challenges_v1 from public,anon,authenticated;
grant select,insert,update on public.buklod_login_contact_challenges_v1 to service_role;

create table if not exists private.buklod_login_contact_audit_v1(
  id bigint generated always as identity primary key,
  user_id uuid not null,
  event text not null,
  created_at timestamptz not null default now()
);
alter table private.buklod_login_contact_audit_v1 enable row level security;
revoke all on private.buklod_login_contact_audit_v1 from public,anon,authenticated;

-- Called only after the Edge Function checks an authenticated session,
-- re-authenticates the current password, verifies the OTP, and successfully
-- updates the same Auth user ID. Keep profile changes transactionally scoped.
create or replace function public.buklod_complete_legacy_login_contact_v1(
  p_user_id uuid, p_channel text, p_destination text, p_challenge_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_email text; v_current text; v_method text; v_claim record;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then
    raise exception 'Server service authorization required' using errcode='42501';
  end if;
  if p_user_id is null or p_challenge_id is null
     or p_channel not in ('email','mobile') then
    raise exception 'Invalid verified contact' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('buklod-legacy-migrate:'||p_user_id::text,0));
  select * into v_claim
  from public.buklod_login_contact_challenges_v1
  where id=p_challenge_id and user_id=p_user_id and
        status in ('VERIFIED','COMPLETED')
  for update;
  if not found or v_claim.channel is distinct from p_channel
     or v_claim.destination is distinct from p_destination then
     raise exception 'Verified destination does not match current claim' using errcode='42501';
  end if;
  select lower(a.email),lower(coalesce(p.login_method,''))
  into v_email,v_method
  from auth.users a join public.profiles p on p.id=a.id
  where a.id=p_user_id for update of a,p;
  if not found then raise exception 'Account not found' using errcode='P0002'; end if;
  if v_method <> 'username' then
    if v_method=p_channel then
      return jsonb_build_object('ok',true,'already_completed',true);
    end if;
    raise exception 'This account is not a username migration candidate' using errcode='42501';
  end if;
  if p_channel='email' and (p_destination !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or lower(p_destination) like '%@buklod.invalid') then
    raise exception 'Invalid email' using errcode='22023';
  end if;
  if p_channel='mobile' and p_destination !~ '^\+639[0-9]{9}$' then
    raise exception 'Invalid mobile' using errcode='22023';
  end if;
  -- An Auth email change MUST already be successful before profile changes.
  if lower(v_email) is distinct from lower(case when p_channel='mobile'
      then 'm.'||regexp_replace(p_destination,'[^0-9]','','g')||'@buklod.invalid'
      else p_destination end) then
    raise exception 'Auth contact change has not been committed' using errcode='42501';
  end if;
  if exists(select 1 from public.profiles q
       where q.id<>p_user_id and
         ((q.login_method=p_channel and lower(coalesce(q.login_identifier,''))=lower(p_destination))
         or (p_channel='mobile' and q.mobile=p_destination))) then
    raise exception 'Contact already belongs to another account' using errcode='23505';
  end if;
  update public.profiles
  set login_method=p_channel,login_identifier=p_destination,
      mobile=case when p_channel='mobile' then p_destination else mobile end
  where id=p_user_id and login_method='username';
  if not found then raise exception 'Profile migration state changed' using errcode='40001'; end if;
  update public.buklod_login_contact_challenges_v1
  set status='COMPLETED',completed_at=now()
  where id=p_challenge_id and status='VERIFIED';
  insert into private.buklod_login_contact_audit_v1(user_id,event)
  values(p_user_id,'VERIFIED_'||upper(p_channel)||'_LOGIN_MIGRATED');
  return jsonb_build_object('ok',true,'method',p_channel,'status','COMPLETED');
end $$;
revoke all on function public.buklod_complete_legacy_login_contact_v1(uuid,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.buklod_complete_legacy_login_contact_v1(uuid,text,text,uuid)
  to service_role;

create table if not exists private.buklod_legacy_login_reminders_v1(
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null,
  created_at timestamptz not null default now(),
  primary key(user_id,month_key)
);
alter table private.buklod_legacy_login_reminders_v1 enable row level security;
revoke all on private.buklod_legacy_login_reminders_v1 from public,anon,authenticated;

-- This scan is disabled by default. Deliberately only in-app reminders: SMS
-- messaging is not a feature of Twilio Verify, and email to fake @buklod.invalid
-- will never be sent. External notification requires a verified contact.
create or replace function private.buklod_legacy_login_monthly_notice_v1(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_month text:=to_char(p_now at time zone 'Asia/Manila','YYYY-MM');
  v_new int:=0; v_total int:=0;
begin
  if not exists(select 1 from private.buklod_login_contact_policy_v1
     where singleton=true and legacy_reminders_enabled=true) then
    return jsonb_build_object('status','disabled');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('buklod-login-reminder:'||v_month,0));
  with reminders as (
    insert into private.buklod_legacy_login_reminders_v1(user_id,month_key)
    select p.id,v_month from public.profiles p
    join auth.users a on a.id=p.id
    where p.login_method='username' and coalesce(p.is_active,true)=true
    on conflict do nothing
    returning user_id
  ), sent as (
    insert into public.notifications(user_id,title,body,kind,data)
    select user_id,'Important: update your BUKLOD login',
      'Username sign-in is being retired. Open Account Security and verify your mobile number or email. Your existing account, posts and points are preserved.',
      'login_contact_migration',
      jsonb_build_object('route','/account/security','month',v_month)
    from reminders returning user_id
  )
  select count(*) into v_new from sent;
  select count(*) into v_total from public.profiles
  where login_method='username' and coalesce(is_active,true)=true;
  insert into public.notifications(user_id,title,body,kind,data)
  select distinct ur.user_id,'Monthly username migration report',
    v_total||' username accounts remaining; '||v_new||' new in-app reminders this month.',
    'login_contact_migration_admin',
    jsonb_build_object('route','/admin/privacy','month',v_month)
  from public.user_roles ur
  where ur.role='system_admin' and ur.is_active=true
    and not exists(select 1 from public.notifications n
      where n.user_id=ur.user_id and n.kind='login_contact_migration_admin'
      and n.data->>'month'=v_month);
  return jsonb_build_object('status','reported','month',v_month,'legacy_remaining',v_total,'reminded',v_new);
end $$;
revoke all on function private.buklod_legacy_login_monthly_notice_v1(timestamptz)
  from public,anon,authenticated;

create or replace function public.buklod_admin_legacy_login_summary_v1()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_total int; v_with_mobile int; v_with_email int;
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin required' using errcode='42501';
  end if;
  select count(*),
         count(*) filter(where p.mobile ~ '^\+639[0-9]{9}$'),
         count(*) filter(where a.email not like '%@buklod.invalid' and a.email is not null)
  into v_total,v_with_mobile,v_with_email
  from public.profiles p join auth.users a on a.id=p.id
  where p.login_method='username' and coalesce(p.is_active,true)=true;
  return jsonb_build_object('legacy_remaining',v_total,
    'has_profile_mobile_unverified',v_with_mobile,
    'has_real_auth_email_unverified',v_with_email,
    'auto_external_notice_live',false,
    'sms_requires_messaging_provider',true);
end $$;
revoke all on function public.buklod_admin_legacy_login_summary_v1()
  from public,anon;
grant execute on function public.buklod_admin_legacy_login_summary_v1() to authenticated;
