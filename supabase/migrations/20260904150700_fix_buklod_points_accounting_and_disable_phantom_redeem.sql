-- BUKLOD Points accounting correction and redemption safety.
-- Production migration was applied through the connected Supabase project first;
-- this file keeps repository schema history aligned with production.

CREATE OR REPLACE FUNCTION public.get_my_buklod_points_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  lifetime_points bigint := 0;
  available_points bigint := 0;
  pending_claimable_points bigint := 0;
  weekly_points bigint := 0;
  monthly_points bigint := 0;
  weekly_rank bigint;
  monthly_rank bigint;
  lifetime_rank bigint;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  lifetime_points := public.buklod_lifetime_points_for(uid);
  available_points := public.buklod_available_points_for(uid);
  pending_claimable_points := public.buklod_pending_claimable_points_for(uid);

  select coalesce(sum(l.points),0)::bigint
  into weekly_points
  from public.buklod_points_ledger l
  where l.user_id = uid
    and l.direction = 'credit'
    and l.claim_state in ('claimed','legacy')
    and (l.created_at at time zone 'Asia/Manila')::date >=
      date_trunc('week', now() at time zone 'Asia/Manila')::date;

  select coalesce(sum(l.points),0)::bigint
  into monthly_points
  from public.buklod_points_ledger l
  where l.user_id = uid
    and l.direction = 'credit'
    and l.claim_state in ('claimed','legacy')
    and (l.created_at at time zone 'Asia/Manila')::date >=
      date_trunc('month', now() at time zone 'Asia/Manila')::date;

  select x.rank_position into weekly_rank
  from public.get_buklod_points_leaderboard('weekly', 200, null) x
  where x.user_id = uid;

  select x.rank_position into monthly_rank
  from public.get_buklod_points_leaderboard('monthly', 200, null) x
  where x.user_id = uid;

  select x.rank_position into lifetime_rank
  from public.get_buklod_points_leaderboard('all_time', 200, null) x
  where x.user_id = uid;

  return jsonb_build_object(
    'total_points', lifetime_points,
    'lifetime_points', lifetime_points,
    'available_points', available_points,
    'pending_claimable_points', pending_claimable_points,
    'weekly_points', weekly_points,
    'monthly_points', monthly_points,
    'weekly_rank', weekly_rank,
    'monthly_rank', monthly_rank,
    'all_time_rank', lifetime_rank
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_buklod_points_leaderboard(
  p_period text DEFAULT 'weekly'::text,
  p_limit integer DEFAULT 50,
  p_church_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(rank_position bigint, user_id uuid, full_name text, church_id uuid, church_name text, total_points bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  start_ts timestamptz;
  end_ts timestamptz;
  normalized_period text;
begin
  normalized_period := lower(trim(coalesce(p_period, 'weekly')));
  normalized_period := case normalized_period
    when 'week' then 'weekly'
    when 'month' then 'monthly'
    when 'quarter' then 'quarterly'
    when 'all' then 'all_time'
    when 'alltime' then 'all_time'
    else normalized_period
  end;

  if normalized_period not in ('weekly','monthly','quarterly','all_time') then
    raise exception 'Invalid leaderboard period';
  end if;

  if normalized_period = 'weekly' then
    start_ts := date_trunc('week', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
    end_ts := start_ts + interval '7 days';
  elsif normalized_period = 'monthly' then
    start_ts := date_trunc('month', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
    end_ts := start_ts + interval '1 month';
  elsif normalized_period = 'quarterly' then
    start_ts := date_trunc('quarter', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
    end_ts := start_ts + interval '3 months';
  else
    start_ts := null;
    end_ts := null;
  end if;

  return query
  with totals as (
    select
      p.id as user_id,
      p.full_name,
      p.church_id,
      c.name as church_name,
      case
        when normalized_period = 'all_time' then
          coalesce(b.lifetime_points, 0)::bigint
        else
          coalesce(sum(
            case
              when l.direction = 'credit'
                and l.claim_state in ('claimed','legacy')
              then l.points
              else 0
            end
          ),0)::bigint
      end as total_points
    from public.profiles p
    left join public.churches c on c.id = p.church_id
    left join public.buklod_user_points_balances b on b.user_id = p.id
    left join public.buklod_points_ledger l
      on l.user_id = p.id
      and normalized_period <> 'all_time'
      and l.created_at >= start_ts
      and l.created_at < end_ts
    where p.is_active = true
      and (p_church_id is null or p.church_id = p_church_id)
    group by p.id, p.full_name, p.church_id, c.name, b.lifetime_points
  ), ranked as (
    select
      row_number() over (
        order by t.total_points desc, t.full_name, t.user_id
      ) as rank_position,
      t.*
    from totals t
    where t.total_points > 0
  )
  select
    r.rank_position,
    r.user_id,
    r.full_name,
    r.church_id,
    r.church_name,
    r.total_points
  from ranked r
  order by r.rank_position
  limit greatest(1, least(coalesce(p_limit,50),200));
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_buklod_rank_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  lifetime_points bigint := 0;
  season_points bigint := 0;
  lifetime_rank record;
  season_rank record;
  season_rec record;
  overall_position bigint;
  local_position bigint;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  lifetime_points := public.buklod_lifetime_points_for(uid);

  select * into season_rec
  from public.buklod_rank_seasons s
  where s.status = 'active'
  order by s.starts_on desc
  limit 1;

  if season_rec.id is not null then
    select coalesce(sum(l.points),0)::bigint
    into season_points
    from public.buklod_points_ledger l
    where l.user_id = uid
      and l.direction = 'credit'
      and l.claim_state in ('claimed','legacy')
      and (l.created_at at time zone 'Asia/Manila')::date
        between season_rec.starts_on and season_rec.ends_on;
  end if;

  select * into lifetime_rank
  from public.get_buklod_rank_for_points(lifetime_points);

  select * into season_rank
  from public.get_buklod_rank_for_points(season_points);

  if season_rec.id is not null then
    with totals as (
      select
        p.id as user_id,
        coalesce(sum(
          case
            when l.direction = 'credit'
              and l.claim_state in ('claimed','legacy')
            then l.points
            else 0
          end
        ),0)::bigint as points
      from public.profiles p
      left join public.buklod_points_ledger l
        on l.user_id = p.id
        and (l.created_at at time zone 'Asia/Manila')::date
          between season_rec.starts_on and season_rec.ends_on
      where p.is_active = true
      group by p.id
    ), ranked as (
      select
        t.user_id,
        row_number() over (order by t.points desc, t.user_id) as position
      from totals t
      where t.points > 0
    )
    select r.position into overall_position
    from ranked r where r.user_id = uid;

    with me as (
      select p.church_id from public.profiles p where p.id = uid
    ), totals as (
      select
        p.id as user_id,
        coalesce(sum(
          case
            when l.direction = 'credit'
              and l.claim_state in ('claimed','legacy')
            then l.points
            else 0
          end
        ),0)::bigint as points
      from public.profiles p
      cross join me
      left join public.buklod_points_ledger l
        on l.user_id = p.id
        and (l.created_at at time zone 'Asia/Manila')::date
          between season_rec.starts_on and season_rec.ends_on
      where p.is_active = true
        and p.church_id = me.church_id
      group by p.id
    ), ranked as (
      select
        t.user_id,
        row_number() over (order by t.points desc, t.user_id) as position
      from totals t
      where t.points > 0
    )
    select r.position into local_position
    from ranked r where r.user_id = uid;
  end if;

  return jsonb_build_object(
    'disclaimer',
      'BUKLOD Rank measures only recorded participation, consistency, learning progress and engagement within the BUKLOD app. It does not measure spiritual maturity, holiness, faith, Christian character, faithfulness to God or personal worth.',
    'lifetime', jsonb_build_object(
      'points', lifetime_points,
      'rank_code', lifetime_rank.rank_code,
      'rank_name', lifetime_rank.display_name,
      'badge_key', lifetime_rank.badge_key,
      'points_to_next', lifetime_rank.points_to_next,
      'next_rank_name', lifetime_rank.next_rank_name,
      'progress_percent', lifetime_rank.progress_percent
    ),
    'season', case
      when season_rec.id is null then null
      else jsonb_build_object(
        'id', season_rec.id,
        'number', season_rec.season_number,
        'title', season_rec.title,
        'starts_on', season_rec.starts_on,
        'ends_on', season_rec.ends_on,
        'points', season_points,
        'rank_code', season_rank.rank_code,
        'rank_name', season_rank.display_name,
        'badge_key', season_rank.badge_key,
        'points_to_next', season_rank.points_to_next,
        'next_rank_name', season_rank.next_rank_name,
        'progress_percent', season_rank.progress_percent,
        'overall_position', overall_position,
        'local_position', local_position
      )
    end
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_buklod_catalog_item_v1(p_catalog_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_item public.buklod_redeem_catalog%ROWTYPE;
  v_lifetime integer := 0;
  v_available integer := 0;
  v_next_available integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_item
  FROM public.buklod_redeem_catalog
  WHERE id = p_catalog_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not available';
  END IF;

  SELECT
    COALESCE(lifetime_points, 0),
    COALESCE(available_points, 0)
  INTO
    v_lifetime,
    v_available
  FROM public.buklod_user_points_balances
  WHERE user_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Points balance not found';
  END IF;

  IF v_available < v_item.cost_points THEN
    RAISE EXCEPTION 'Insufficient available points';
  END IF;

  INSERT INTO public.buklod_points_ledger (
    user_id,
    direction,
    points,
    activity_type,
    source_key,
    source_id,
    description
  )
  VALUES (
    v_user,
    'debit',
    v_item.cost_points,
    'redeem',
    'redeem_catalog',
    p_catalog_id::text,
    v_item.title
  );

  v_next_available := public.buklod_available_points_for(v_user);

  RETURN jsonb_build_object(
    'catalog_id', p_catalog_id,
    'title', v_item.title,
    'redeemed_points', v_item.cost_points,
    'lifetime_points', v_lifetime,
    'available_points', v_next_available
  );
END;
$function$;

-- Disable the four placeholder catalog items until a real fulfillment or
-- entitlement endpoint exists. This does not touch user balances or ledger rows.
UPDATE public.buklod_redeem_catalog
SET is_active = false
WHERE is_active = true;
