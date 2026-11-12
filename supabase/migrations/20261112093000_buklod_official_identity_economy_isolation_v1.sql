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

-- Keep the official account out of member/Bayanihan leaderboards.
-- Filter BEFORE row_number() so members retain contiguous ranks.

CREATE OR REPLACE FUNCTION public.admin_bayanihan_leaderboard_v2(p_limit integer DEFAULT 50)
 RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, church_name text, group_name text, total_earned numeric, total_used numeric, current_balance numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  safe_limit integer :=
    least(
      greatest(
        coalesce(
          p_limit,
          50
        ),
        1
      ),
      200
    );
begin
  if not public.is_system_admin() then
    raise exception
      'System Admin access required';
  end if;

  return query
  with totals as (
    select
      p.id,
      p.full_name,
      coalesce(
        c.name,
        'No Local'
      )::text as local_name,

      coalesce(
        (
          select
            string_agg(
              distinct g.name,
              ' | '
              order by g.name
            )
          from public.group_members gm
          join public.buklod_groups g
            on g.id =
              gm.group_id
          where gm.user_id =
            p.id
            and gm.is_active =
              true
        ),
        'No Group'
      )::text as active_groups,

      coalesce(
        sum(bl.amount)
        filter (
          where bl.direction =
            'credit'
        ),
        0
      )::numeric as earned,

      coalesce(
        sum(bl.amount)
        filter (
          where bl.direction =
            'debit'
        ),
        0
      )::numeric as used

    from public.profiles p
    left join public.churches c
      on c.id =
        p.church_id
    left join public.bayanihan_ledger bl
      on bl.user_id =
        p.id
    where (p.is_active = true and not private.buklod_is_platform_official_v1(p.id))
      and coalesce(
        p.is_verified,
        false
      ) = true
    group by
      p.id,
      p.full_name,
      c.name
  )
  select
    row_number() over (
      order by
        totals.earned desc,
        totals.full_name
    )::bigint,
    totals.id,
    totals.full_name,
    totals.local_name,
    totals.active_groups,
    totals.earned,
    totals.used,
    (
      totals.earned -
      totals.used
    )::numeric
  from totals
  order by
    totals.earned desc,
    totals.full_name
  limit safe_limit;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_bayanihan_leaderboard_v3(p_period text DEFAULT 'month'::text, p_limit integer DEFAULT 5)
 RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, total_earned numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  period_key text :=
    lower(trim(coalesce(p_period, 'month')));

  lim integer :=
    least(
      greatest(
        coalesce(p_limit, 5),
        1
      ),
      5
    );

  start_at timestamp without time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if period_key not in (
    'month',
    'overall'
  ) then
    raise exception 'Invalid leaderboard period';
  end if;

  if period_key = 'month' then
    start_at :=
      date_trunc(
        'month',
        now() at time zone 'Asia/Manila'
      );
  end if;

  return query
  with totals as (
    select
      p.id as user_id,

      coalesce(
        nullif(
          trim(p.full_name),
          ''
        ),
        'BUKLOD Member'
      )::text as full_name,

      coalesce(
        sum(
          case
            when
              bl.direction = 'credit'
              and (
                period_key = 'overall'
                or (
                  bl.created_at
                  at time zone 'Asia/Manila'
                ) >= start_at
              )
            then coalesce(bl.amount, 0)
            else 0
          end
        ),
        0
      )::numeric as total_earned

    from public.profiles p

    left join public.bayanihan_ledger bl
      on bl.user_id = p.id

    where
      (p.is_active = true and not private.buklod_is_platform_official_v1(p.id))
      and coalesce(
        p.is_verified,
        false
      ) = true

    group by
      p.id,
      p.full_name
  ),

  ranked as (
    select
      row_number() over (
        order by
          t.total_earned desc,
          t.full_name asc,
          t.user_id
      )::bigint as rank_position,

      t.user_id,
      t.full_name,
      t.total_earned

    from totals t

    where
      t.total_earned > 0
  )

  select
    r.rank_position,
    r.user_id,
    r.full_name,
    r.total_earned

  from ranked r

  order by
    r.rank_position

  limit lim;
end
$function$;

CREATE OR REPLACE FUNCTION public.get_buklod_points_leaderboard(p_period text DEFAULT 'weekly'::text, p_limit integer DEFAULT 50, p_church_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, church_id uuid, church_name text, total_points bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  normalized_period text;
  safe_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
BEGIN
  normalized_period := lower(trim(coalesce(p_period, 'weekly')));
  normalized_period := CASE normalized_period
    WHEN 'week' THEN 'weekly'
    WHEN 'month' THEN 'monthly'
    WHEN 'quarter' THEN 'quarterly'
    WHEN 'all' THEN 'all_time'
    WHEN 'alltime' THEN 'all_time'
    ELSE normalized_period
  END;

  IF normalized_period NOT IN ('weekly','monthly','quarterly','all_time') THEN
    RAISE EXCEPTION 'Invalid leaderboard period';
  END IF;

  IF normalized_period = 'all_time' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT row_number() OVER (ORDER BY b.lifetime_points DESC, p.full_name, p.id) AS rank_position,
             p.id AS user_id, p.full_name, p.church_id, c.name AS church_name,
             b.lifetime_points::bigint AS total_points
      FROM public.buklod_user_points_balances b
      JOIN public.profiles p ON p.id = b.user_id
      LEFT JOIN public.churches c ON c.id = p.church_id
      WHERE (p.is_active = true and not private.buklod_is_platform_official_v1(p.id))
        AND b.lifetime_points > 0
        AND (p_church_id IS NULL OR p.church_id = p_church_id)
    )
    SELECT r.rank_position,r.user_id,r.full_name,r.church_id,r.church_name,r.total_points
    FROM ranked r ORDER BY r.rank_position LIMIT safe_limit;
    RETURN;
  END IF;

  IF normalized_period = 'weekly' THEN
    RETURN QUERY
    WITH aggregated AS (
      SELECT l.user_id, sum(l.points)::bigint AS total_points
      FROM public.buklod_points_ledger l
      WHERE l.direction = 'credit'
        AND l.claim_state IN ('claimed','legacy')
        AND l.created_at >= (date_trunc('week', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')
        AND l.created_at <  (date_trunc('week', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') + interval '7 days'
      GROUP BY l.user_id HAVING sum(l.points) > 0
    ), ranked AS (
      SELECT row_number() OVER (ORDER BY a.total_points DESC, p.full_name, p.id) AS rank_position,
             p.id AS user_id,p.full_name,p.church_id,c.name AS church_name,a.total_points
      FROM aggregated a
      JOIN public.profiles p ON p.id=a.user_id
      LEFT JOIN public.churches c ON c.id=p.church_id
      WHERE (p.is_active=true and not private.buklod_is_platform_official_v1(p.id)) AND (p_church_id IS NULL OR p.church_id=p_church_id)
    )
    SELECT r.rank_position,r.user_id,r.full_name,r.church_id,r.church_name,r.total_points
    FROM ranked r ORDER BY r.rank_position LIMIT safe_limit;
    RETURN;
  END IF;

  IF normalized_period = 'monthly' THEN
    RETURN QUERY
    WITH aggregated AS (
      SELECT l.user_id, sum(l.points)::bigint AS total_points
      FROM public.buklod_points_ledger l
      WHERE l.direction = 'credit'
        AND l.claim_state IN ('claimed','legacy')
        AND l.created_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')
        AND l.created_at <  (date_trunc('month', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') + interval '1 month'
      GROUP BY l.user_id HAVING sum(l.points) > 0
    ), ranked AS (
      SELECT row_number() OVER (ORDER BY a.total_points DESC, p.full_name, p.id) AS rank_position,
             p.id AS user_id,p.full_name,p.church_id,c.name AS church_name,a.total_points
      FROM aggregated a
      JOIN public.profiles p ON p.id=a.user_id
      LEFT JOIN public.churches c ON c.id=p.church_id
      WHERE (p.is_active=true and not private.buklod_is_platform_official_v1(p.id)) AND (p_church_id IS NULL OR p.church_id=p_church_id)
    )
    SELECT r.rank_position,r.user_id,r.full_name,r.church_id,r.church_name,r.total_points
    FROM ranked r ORDER BY r.rank_position LIMIT safe_limit;
    RETURN;
  END IF;

  RETURN QUERY
  WITH aggregated AS (
    SELECT l.user_id, sum(l.points)::bigint AS total_points
    FROM public.buklod_points_ledger l
    WHERE l.direction = 'credit'
      AND l.claim_state IN ('claimed','legacy')
      AND l.created_at >= (date_trunc('quarter', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila')
      AND l.created_at <  (date_trunc('quarter', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila') + interval '3 months'
    GROUP BY l.user_id HAVING sum(l.points) > 0
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY a.total_points DESC, p.full_name, p.id) AS rank_position,
           p.id AS user_id,p.full_name,p.church_id,c.name AS church_name,a.total_points
    FROM aggregated a
    JOIN public.profiles p ON p.id=a.user_id
    LEFT JOIN public.churches c ON c.id=p.church_id
    WHERE (p.is_active=true and not private.buklod_is_platform_official_v1(p.id)) AND (p_church_id IS NULL OR p.church_id=p_church_id)
  )
  SELECT r.rank_position,r.user_id,r.full_name,r.church_id,r.church_name,r.total_points
  FROM ranked r ORDER BY r.rank_position LIMIT safe_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_circle_ranks_v1(p_user_ids uuid[])
 RETURNS TABLE(user_id uuid, rank_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with actor_ok as (
    select p.id
    from public.profiles p
    where p.id=(select auth.uid())
      and p.is_active=true
      and coalesce(p.is_verified,false)=true
    limit 1
  ), requested as (
    select distinct u.user_id
    from unnest(coalesce(p_user_ids,'{}'::uuid[])) as u(user_id)
    where u.user_id is not null
    limit 200
  ), totals as (
    select p.id as user_id,coalesce(b.lifetime_points,0)::bigint as lifetime_points
    from requested q
    join public.profiles p on p.id=q.user_id
      and p.is_active=true
      and not private.buklod_is_platform_official_v1(p.id)
      and coalesce(p.is_verified,false)=true
    left join public.buklod_user_points_balances b on b.user_id=p.id
    where exists(select 1 from actor_ok)
  )
  select t.user_id,
    coalesce((
      select r.rank_name
      from public.buklod_rank_levels r
      where r.is_active=true and r.rank_name is not null and r.min_points<=t.lifetime_points
      order by r.min_points desc,r.rank_order desc nulls last
      limit 1
    ),'Circle Starter V')::text
  from totals t
  order by t.user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_member_weekly_leaderboard(p_week_start date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, church_id uuid, total_score numeric, bible_completed bigint, bible_required bigint, devotional_completed bigint, devotional_required bigint, formation_lessons bigint, active_days bigint, required_days bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with clock as (
  select
    (now() at time zone 'Asia/Manila')::date as local_today
),

params as (
  select
    coalesce(
      p_week_start,
      local_today -
        (extract(isodow from local_today)::integer - 1)
    )::date as week_start
  from clock
),

period as (
  select
    week_start,
    (week_start + 6)::date as week_end
  from params
),

users as (
  select
    p.id,
    p.full_name,
    p.church_id
  from public.profiles p
  where (p.is_active = true and not private.buklod_is_platform_official_v1(p.id))
),

bible_req as (
  select count(*)::bigint as required_count
  from public.daily_bible_assignments a, period p
  where a.is_published = true
    and a.reading_date between p.week_start and p.week_end
),

devotional_req as (
  select count(*)::bigint as required_count
  from public.devotionals d, period p
  where d.is_published = true
    and d.publish_date between p.week_start and p.week_end
),

required_dates_data as (
  select a.reading_date as activity_date
  from public.daily_bible_assignments a, period p
  where a.is_published = true
    and a.reading_date between p.week_start and p.week_end

  union

  select d.publish_date
  from public.devotionals d, period p
  where d.is_published = true
    and d.publish_date between p.week_start and p.week_end
),

required_days_count as (
  select count(*)::bigint as required_days
  from required_dates_data
),

bible_done as (
  select
    s.user_id,
    count(distinct s.assignment_id)::bigint as completed
  from public.daily_bible_submissions s
  join public.daily_bible_assignments a
    on a.id = s.assignment_id
  cross join period p
  where s.status = 'approved'
    and a.reading_date between p.week_start and p.week_end
  group by s.user_id
),

devotional_done as (
  select
    s.user_id,
    count(distinct s.devotional_id)::bigint as completed
  from public.devotional_reward_submissions s
  join public.devotionals d
    on d.id = s.devotional_id
  cross join period p
  where s.status = 'approved'
    and d.publish_date between p.week_start and p.week_end
  group by s.user_id
),

formation_done as (
  select
    a.user_id,
    count(distinct a.lesson_id)::bigint as completed
  from public.member_lesson_attempts a
  cross join period p
  where a.review_status = 'approved'
    and (
      a.pastor_validated_at at time zone 'Asia/Manila'
    )::date between p.week_start and p.week_end
  group by a.user_id
),

activity_dates as (

  select
    s.user_id,
    a.reading_date as activity_date
  from public.daily_bible_submissions s
  join public.daily_bible_assignments a
    on a.id = s.assignment_id
  cross join period p
  where s.status = 'approved'
    and a.reading_date between p.week_start and p.week_end

  union

  select
    s.user_id,
    d.publish_date
  from public.devotional_reward_submissions s
  join public.devotionals d
    on d.id = s.devotional_id
  cross join period p
  where s.status = 'approved'
    and d.publish_date between p.week_start and p.week_end
),

active_days_data as (
  select
    user_id,
    count(distinct activity_date)::bigint as active_days
  from activity_dates
  group by user_id
),

raw_scores as (
  select
    u.id as user_id,
    u.full_name,
    u.church_id,

    coalesce(bd.completed,0)::bigint as bible_completed,
    br.required_count::bigint as bible_required,

    coalesce(dd.completed,0)::bigint as devotional_completed,
    dr.required_count::bigint as devotional_required,

    coalesce(fd.completed,0)::bigint as formation_lessons,

    coalesce(ad.active_days,0)::bigint as active_days,
    rd.required_days::bigint as required_days,

    round(
      (
        case
          when br.required_count > 0
          then
            20 *
            least(
              coalesce(bd.completed,0)::numeric /
              br.required_count::numeric,
              1
            )
          else 0
        end

        +

        case
          when dr.required_count > 0
          then
            20 *
            least(
              coalesce(dd.completed,0)::numeric /
              dr.required_count::numeric,
              1
            )
          else 0
        end

        +

        (
          35 *
          least(coalesce(fd.completed,0),3)::numeric / 3
        )

        +

        case
          when rd.required_days > 0
          then
            25 *
            least(
              coalesce(ad.active_days,0)::numeric /
              rd.required_days::numeric,
              1
            )
          else 0
        end
      )::numeric,
      2
    ) as total_score

  from users u

  cross join bible_req br
  cross join devotional_req dr
  cross join required_days_count rd

  left join bible_done bd
    on bd.user_id = u.id

  left join devotional_done dd
    on dd.user_id = u.id

  left join formation_done fd
    on fd.user_id = u.id

  left join active_days_data ad
    on ad.user_id = u.id
),

ranked as (
  select
    row_number() over (
      order by
        total_score desc,
        formation_lessons desc,
        (bible_completed + devotional_completed) desc,
        full_name
    ) as rank_position,
    *
  from raw_scores
  where total_score > 0
)

select
  r.rank_position,
  r.user_id,
  r.full_name,
  r.church_id,
  r.total_score,
  r.bible_completed,
  r.bible_required,
  r.devotional_completed,
  r.devotional_required,
  r.formation_lessons,
  r.active_days,
  r.required_days
from ranked r
order by r.rank_position
limit greatest(1, least(coalesce(p_limit,10),50));
$function$;

CREATE OR REPLACE FUNCTION public.get_mentor_weekly_leaderboard(p_week_start date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, church_id uuid, approved_sessions bigint, distinct_lessons bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with clock as (
  select
    (now() at time zone 'Asia/Manila')::date as local_today
),

params as (
  select
    coalesce(
      p_week_start,
      local_today -
        (extract(isodow from local_today)::integer - 1)
    )::date as week_start
  from clock
),

period as (
  select
    week_start,
    (week_start + 6)::date as week_end
  from params
),

data as (
  select
    s.mentor_id as user_id,
    p.full_name,
    p.church_id,
    count(*)::bigint as approved_sessions,
    count(distinct s.lesson_id)::bigint as distinct_lessons

  from public.mentor_teaching_sessions s

  join public.profiles p
    on p.id = s.mentor_id

  cross join period w

  where s.status = 'approved'
    and s.session_date between w.week_start and w.week_end
    and (p.is_active = true and not private.buklod_is_platform_official_v1(p.id))

  group by
    s.mentor_id,
    p.full_name,
    p.church_id
),

ranked as (
  select
    row_number() over (
      order by
        approved_sessions desc,
        distinct_lessons desc,
        full_name
    ) as rank_position,
    *
  from data
)

select
  r.rank_position,
  r.user_id,
  r.full_name,
  r.church_id,
  r.approved_sessions,
  r.distinct_lessons
from ranked r
order by r.rank_position
limit greatest(1, least(coalesce(p_limit,10),50));
$function$;
