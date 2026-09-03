-- BUKLOD Points leaderboard compatibility repair.
-- Existing Home bundles call p_period='week' while the canonical RPC
-- accepted only 'weekly'. Keep canonical values while accepting aliases
-- so already-installed/older OTA bundles do not silently lose rankings.

create or replace function public.get_buklod_points_leaderboard(
  p_period text default 'weekly'::text,
  p_limit integer default 50,
  p_church_id uuid default null::uuid
)
returns table(
  rank_position bigint,
  user_id uuid,
  full_name text,
  church_id uuid,
  church_name text,
  total_points bigint
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  start_date date;
  end_date date;
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
    start_date := date_trunc('week', now() at time zone 'Asia/Manila')::date;
    end_date := start_date + 7;
  elsif normalized_period = 'monthly' then
    start_date := date_trunc('month', now() at time zone 'Asia/Manila')::date;
    end_date := (start_date + interval '1 month')::date;
  elsif normalized_period = 'quarterly' then
    start_date := date_trunc('quarter', now() at time zone 'Asia/Manila')::date;
    end_date := (start_date + interval '3 months')::date;
  else
    start_date := null;
    end_date := null;
  end if;

  return query
  with totals as (
    select
      p.id as user_id,
      p.full_name,
      p.church_id,
      c.name as church_name,
      case
        when normalized_period = 'all_time' then public.buklod_lifetime_points_for(p.id)
        else coalesce(
          sum(
            case
              when l.direction = 'credit'
                and coalesce(l.claim_state, 'legacy') in ('legacy','claimed')
                then l.points
              when l.direction = 'debit' then -l.points
              else 0
            end
          ),
          0
        )::bigint
      end as total_points
    from public.profiles p
    left join public.churches c on c.id = p.church_id
    left join public.buklod_points_ledger l
      on l.user_id = p.id
      and start_date is not null
      and (l.created_at at time zone 'Asia/Manila')::date >= start_date
      and (l.created_at at time zone 'Asia/Manila')::date < end_date
    where p.is_active = true
      and (p_church_id is null or p.church_id = p_church_id)
    group by p.id, p.full_name, p.church_id, c.name
  ),
  ranked as (
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
