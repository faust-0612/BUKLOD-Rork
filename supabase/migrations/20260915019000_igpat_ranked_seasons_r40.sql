-- BUKLOD IGPAT R40
-- Arena Ranked Seasons are logically isolated from every existing BUKLOD point/rank system.
-- No Circle Rank, Character Level, Formation Rank, Cluster points or Bayanihan points are written.

create table if not exists public.igpat_arena_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 3 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

alter table public.igpat_arena_seasons enable row level security;
revoke all on table public.igpat_arena_seasons from public;
revoke all on table public.igpat_arena_seasons from anon;
revoke all on table public.igpat_arena_seasons from authenticated;
grant all on table public.igpat_arena_seasons to service_role;

create or replace function public.admin_create_igpat_arena_season_v1(
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_name text := trim(coalesce(p_name, ''));
  new_id uuid;
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if char_length(safe_name) < 3 or char_length(safe_name) > 80 then
    raise exception 'Arena season name must be 3 to 80 characters';
  end if;

  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Arena season needs a valid start and end time';
  end if;

  if p_ends_at - p_starts_at > interval '180 days' then
    raise exception 'Arena season may be at most 180 days';
  end if;

  if exists (
    select 1
    from public.igpat_arena_seasons s
    where tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'Arena seasons may not overlap';
  end if;

  insert into public.igpat_arena_seasons(name, starts_at, ends_at, created_by)
  values(safe_name, p_starts_at, p_ends_at, actor)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.get_current_buklod_igpat_season_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  s public.igpat_arena_seasons%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into s
  from public.igpat_arena_seasons row_data
  where now() >= row_data.starts_at
    and now() < row_data.ends_at
  order by row_data.starts_at desc
  limit 1;

  if s.id is null then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'id', s.id,
    'name', s.name,
    'starts_at', s.starts_at,
    'ends_at', s.ends_at
  );
end;
$$;

create or replace function public.get_buklod_igpat_season_rankings_v1(
  p_season_id uuid default null,
  p_limit integer default 50
)
returns table(
  user_id uuid,
  display_name text,
  completed_entries integer,
  wins integer,
  respect_received integer,
  arena_score integer,
  arena_tier text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  season public.igpat_arena_seasons%rowtype;
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if p_season_id is null then
    select * into season
    from public.igpat_arena_seasons s
    where now() >= s.starts_at and now() < s.ends_at
    order by s.starts_at desc
    limit 1;
  else
    select * into season
    from public.igpat_arena_seasons s
    where s.id = p_season_id;
  end if;

  if season.id is null then
    return;
  end if;

  return query
  with entries as (
    select
      r.submitted_by as user_id,
      count(*)::integer as completed_entries,
      count(*) filter (where c.winner_user_id = r.submitted_by)::integer as wins,
      coalesce(sum(r.respect_received), 0)::integer as respect_received
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id = r.challenge_id
    where r.verified = true
      and c.status = 'COMPLETED'
      and c.completed_at >= season.starts_at
      and c.completed_at < season.ends_at
      and public.can_view_igpat_arena_challenge_v2(c.id)
      and (r.post_id is null or public.can_view_community_post_v2(r.post_id))
    group by r.submitted_by
  ), scored as (
    select
      e.*,
      (e.wins * 10 + e.respect_received + e.completed_entries)::integer as score
    from entries e
  )
  select
    s.user_id,
    coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text,
    s.completed_entries,
    s.wins,
    s.respect_received,
    s.score,
    case
      when s.score >= 300 then 'Champion'
      when s.score >= 150 then 'Elite'
      when s.score >= 75 then 'Gold'
      when s.score >= 25 then 'Silver'
      else 'Bronze'
    end::text
  from scored s
  join public.profiles p on p.id = s.user_id
  order by s.score desc, s.respect_received desc, s.completed_entries desc, s.user_id asc
  limit safe_limit;
end;
$$;

revoke all on function public.admin_create_igpat_arena_season_v1(text,timestamptz,timestamptz) from public;
revoke all on function public.admin_create_igpat_arena_season_v1(text,timestamptz,timestamptz) from anon;
grant execute on function public.admin_create_igpat_arena_season_v1(text,timestamptz,timestamptz) to authenticated;
grant execute on function public.admin_create_igpat_arena_season_v1(text,timestamptz,timestamptz) to service_role;

revoke all on function public.get_current_buklod_igpat_season_v1() from public;
revoke all on function public.get_current_buklod_igpat_season_v1() from anon;
grant execute on function public.get_current_buklod_igpat_season_v1() to authenticated;
grant execute on function public.get_current_buklod_igpat_season_v1() to service_role;

revoke all on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) from public;
revoke all on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) from anon;
grant execute on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) to authenticated;
grant execute on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) to service_role;
