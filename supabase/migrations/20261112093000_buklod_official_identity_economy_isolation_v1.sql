-- BUKLOD Official identity / economy separation (2026-11-12).
-- The existing protected OFFICIAL_SYSTEM_ADMIN remains the same auth account.
-- Historical ledgers and finalized settlements are preserved; no cash switches change.
-- This migration is additive and safe to replay only as a whole.

create table if not exists private.buklod_official_identity_snapshot_v1 (
  principal_key text primary key,
  user_id uuid not null references auth.users(id),
  prior_full_name text,
  prior_first_name text,
  prior_middle_name text,
  prior_surname text,
  prior_suffix text,
  prior_username text,
  prior_avatar_url text,
  activated_at timestamptz not null default now()
);
alter table private.buklod_official_identity_snapshot_v1 enable row level security;
revoke all on private.buklod_official_identity_snapshot_v1 from public, anon, authenticated;

-- Identify the one existing protected principal, never a name or self-editable role.
insert into private.buklod_official_identity_snapshot_v1
(principal_key,user_id,prior_full_name,prior_first_name,prior_middle_name,
 prior_surname,prior_suffix,prior_username,prior_avatar_url)
select pp.principal_key,p.id,p.full_name,p.first_name,p.middle_name,
       p.surname,p.suffix,p.username,p.avatar_url
from public.buklod_foundation_protected_principals pp
join public.profiles p on p.id=pp.user_id
where pp.principal_key='OFFICIAL_SYSTEM_ADMIN' and pp.protected=true
  and p.role='system_admin'::public.app_role and p.is_active=true
on conflict (principal_key) do nothing;

do $guard$
begin
  if (select count(*) from private.buklod_official_identity_snapshot_v1
      where principal_key='OFFICIAL_SYSTEM_ADMIN') <> 1 then
    raise exception 'Protected BUKLOD official account not found; no change applied';
  end if;
end $guard$;

create or replace function private.buklod_is_platform_official_v1(p_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $official$
  select p_user_id is not null and exists (
    select 1 from private.buklod_official_identity_snapshot_v1 x
    join public.buklod_foundation_protected_principals pp
      on pp.principal_key=x.principal_key and pp.user_id=x.user_id
    where x.user_id=p_user_id and pp.principal_key='OFFICIAL_SYSTEM_ADMIN'
      and pp.protected=true
  );
$official$;
revoke all on function private.buklod_is_platform_official_v1(uuid) from public,anon,authenticated;

-- Public branding; private original name and photo stay in the audit snapshot.
-- No auth UID, role, admin privileges, or historical authorship is changed.
update public.profiles p
set full_name='BUKLOD', first_name='BUKLOD', middle_name=null,
    surname=null, suffix=null, username='buklod-official', avatar_url=null
from private.buklod_official_identity_snapshot_v1 x
where x.principal_key='OFFICIAL_SYSTEM_ADMIN' and p.id=x.user_id
  and (p.full_name,p.first_name,p.middle_name,p.surname,p.suffix,p.username,p.avatar_url)
      is distinct from ('BUKLOD','BUKLOD',null,null,null,'buklod-official',null);

create or replace function private.buklod_official_profile_name_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $profile$
begin
  if private.buklod_is_platform_official_v1(new.id) then
    new.full_name:='BUKLOD';
    new.first_name:='BUKLOD';
    new.middle_name:=null;
    new.surname:=null;
    new.suffix:=null;
    new.username:='buklod-official';
  elsif lower(btrim(coalesce(new.full_name,''))) in ('buklod','buklod official')
     or lower(btrim(coalesce(new.username,'')))='buklod-official' then
    raise exception 'Official BUKLOD identity is reserved' using errcode='23514';
  end if;
  return new;
end;
$profile$;
revoke all on function private.buklod_official_profile_name_guard_v1() from public,anon,authenticated;
drop trigger if exists zz_buklod_official_profile_name_guard_v1 on public.profiles;
create trigger zz_buklod_official_profile_name_guard_v1
before insert or update of full_name,first_name,middle_name,surname,suffix,username
on public.profiles for each row
execute function private.buklod_official_profile_name_guard_v1();

-- Reward insertion is intentionally a no-op for this one official account.
-- Existing user actions (post/comment/react) continue to succeed.
create or replace function private.buklod_official_reward_write_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $reward$
begin
  if private.buklod_is_platform_official_v1(new.user_id) then
    return null;
  end if;
  return new;
end;
$reward$;
revoke all on function private.buklod_official_reward_write_guard_v1() from public,anon,authenticated;

drop trigger if exists zz_buklod_official_points_ledger_guard_v1 on public.buklod_points_ledger;
create trigger zz_buklod_official_points_ledger_guard_v1
before insert or update on public.buklod_points_ledger
for each row execute function private.buklod_official_reward_write_guard_v1();

drop trigger if exists zz_buklod_official_points_evaluations_guard_v1 on public.buklod_points_evaluations;
create trigger zz_buklod_official_points_evaluations_guard_v1
before insert or update on public.buklod_points_evaluations
for each row execute function private.buklod_official_reward_write_guard_v1();

drop trigger if exists zz_buklod_official_qmp_events_guard_v1 on private.buklod_community_qmp_events;
create trigger zz_buklod_official_qmp_events_guard_v1
before insert on private.buklod_community_qmp_events
for each row execute function private.buklod_official_reward_write_guard_v1();

drop trigger if exists zz_buklod_official_qmp_accounts_guard_v1 on private.buklod_community_qmp_accounts;
create trigger zz_buklod_official_qmp_accounts_guard_v1
before insert or update on private.buklod_community_qmp_accounts
for each row execute function private.buklod_official_reward_write_guard_v1();

drop trigger if exists zz_buklod_official_qmp_active_days_guard_v1 on private.buklod_community_qmp_active_days;
create trigger zz_buklod_official_qmp_active_days_guard_v1
before insert on private.buklod_community_qmp_active_days
for each row execute function private.buklod_official_reward_write_guard_v1();

drop trigger if exists zz_buklod_official_qmp_mission_guard_v1 on private.buklod_community_qmp_mission_progress;
create trigger zz_buklod_official_qmp_mission_guard_v1
before insert or update on private.buklod_community_qmp_mission_progress
for each row execute function private.buklod_official_reward_write_guard_v1();

-- Never create cash redemption requests from this official identity.
create or replace function private.buklod_official_redemption_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $redemption$
begin
  if private.buklod_is_platform_official_v1(new.user_id) then
    raise exception 'BUKLOD Official is excluded from points redemption and payout'
      using errcode='42501';
  end if;
  return new;
end;
$redemption$;
revoke all on function private.buklod_official_redemption_guard_v1() from public,anon,authenticated;
drop trigger if exists zz_buklod_official_redemption_guard_v1 on public.buklod_points_redemptions;
create trigger zz_buklod_official_redemption_guard_v1
before insert on public.buklod_points_redemptions
for each row execute function private.buklod_official_redemption_guard_v1();

-- The official is not a Finance distribution recipient. Historic rows stay intact.
create or replace function private.buklod_official_finance_settlement_guard_v1()
returns trigger language plpgsql security definer set search_path to ''
as $finance$
begin
  if exists (
    select 1 from private.buklod_pf_user_links l
    where l.person_id=new.person_id
      and private.buklod_is_platform_official_v1(l.user_id)
  ) then
    return null;
  end if;
  return new;
end;
$finance$;
revoke all on function private.buklod_official_finance_settlement_guard_v1() from public,anon,authenticated;
drop trigger if exists zz_buklod_official_finance_settlement_guard_v1 on private.buklod_pf_user_settlements;
create trigger zz_buklod_official_finance_settlement_guard_v1
before insert on private.buklod_pf_user_settlements
for each row execute function private.buklod_official_finance_settlement_guard_v1();

-- Prior finalized periods preserve their own weight. Open/unfinalized periods
-- exclude the platform itself from both the numerator and denominator.
create or replace function private.buklod_pf_monthly_points_v3(
  p_person_id uuid,p_start timestamptz,p_end timestamptz
) returns bigint language sql stable security definer set search_path to ''
as $monthly$
  select coalesce(sum(a.qualified_qmp),0)::bigint
  from private.buklod_community_settlement_periods cp
  join private.buklod_community_qmp_accounts a
    on a.settlement_period_id=cp.id and a.qualified_qmp>0
  join private.buklod_pf_user_links l
    on l.user_id=a.user_id and l.person_id=p_person_id
  where cp.starts_at=p_start and cp.ends_at=p_end
    and (
      not private.buklod_is_platform_official_v1(a.user_id)
      or exists (
        select 1 from private.buklod_official_identity_snapshot_v1 x
        where x.user_id=a.user_id and cp.finalized_at is not null
          and cp.finalized_at<x.activated_at
      )
    );
$monthly$;

create or replace function private.buklod_pf_total_monthly_qmp_v1(
  p_start timestamptz,p_end timestamptz
) returns bigint language sql stable security definer set search_path to ''
as $total$
  select coalesce(sum(q.qualified_qmp),0)::bigint
  from private.buklod_community_settlement_periods cp
  join private.buklod_community_qmp_accounts q
    on q.settlement_period_id=cp.id and q.qualified_qmp>0
  join private.buklod_pf_user_links l on l.user_id=q.user_id
  join private.buklod_pf_persons p on p.person_id=l.person_id
  join public.profiles pr on pr.id=p.current_user_id
  where cp.starts_at=p_start and cp.ends_at=p_end
    and p.risk_status='CLEAR'
    and pr.is_active=true and pr.user_deactivated_at is null
    and (
      not private.buklod_is_platform_official_v1(q.user_id)
      or exists (
        select 1 from private.buklod_official_identity_snapshot_v1 x
        where x.user_id=q.user_id and cp.finalized_at is not null
          and cp.finalized_at<x.activated_at
      )
    );
$total$;

create or replace function public.ensure_my_buklod_qmp_finance_identity_v1()
returns jsonb language plpgsql security definer set search_path to ''
as $ensure$
declare v_uid uuid:=auth.uid(); v_person uuid;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if private.buklod_is_platform_official_v1(v_uid) then
    return jsonb_build_object('identity_ready',false,'reason','BUKLOD_OFFICIAL_EXCLUDED');
  end if;
  v_person:=private.buklod_pf_ensure_qmp_person_v1(v_uid);
  return jsonb_build_object('identity_ready',v_person is not null);
end;
$ensure$;

-- Public official badge is derived from immutable server principal, never display name.
create or replace function public.get_buklod_official_identity_v1(p_user_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $badge$
  select private.buklod_is_platform_official_v1(p_user_id);
$badge$;
revoke all on function public.get_buklod_official_identity_v1(uuid) from public;
grant execute on function public.get_buklod_official_identity_v1(uuid) to anon,authenticated;

-- Dashboard counts only the official account's own public activity; no points.
create or replace function public.get_my_buklod_official_dashboard_v1()
returns jsonb language plpgsql stable security definer set search_path to ''
as $dashboard$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null or not private.buklod_is_platform_official_v1(v_uid) then
    raise exception 'BUKLOD Official access required' using errcode='42501';
  end if;
  return jsonb_build_object(
    'is_official',true,
    'display_name','BUKLOD',
    'points_eligible',false,
    'qmp_eligible',false,
    'payout_eligible',false,
    'official_posts',(select count(*) from public.community_posts p
        where p.user_id=v_uid and p.deleted_at is null and not p.is_hidden),
    'official_replies',(select count(*) from public.comments c
        where c.user_id=v_uid and c.deleted_at is null and not c.is_hidden),
    'published_bulletins',(select count(*) from public.mission_bulletins b
        where b.author_id=v_uid and b.is_published=true)
  );
end;
$dashboard$;
revoke all on function public.get_my_buklod_official_dashboard_v1() from public,anon;
grant execute on function public.get_my_buklod_official_dashboard_v1() to authenticated;

comment on function public.get_my_buklod_official_dashboard_v1() is
  'Protected platform identity: official interaction counts, no earning or payout privileges.';