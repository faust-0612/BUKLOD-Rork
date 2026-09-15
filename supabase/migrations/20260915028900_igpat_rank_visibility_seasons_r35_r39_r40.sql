-- BUKLOD IGPAT R35/R39/R40 — privacy-safe competitive ranking integration.
-- General Arena ranking and Ranked Seasons include individual, Squad, and LMS
-- competition, but only evidence the current viewer may inspect contributes.
-- These scores remain fully isolated from every non-Arena BUKLOD rank/point system.

create or replace function public.get_buklod_igpat_arena_rankings_v1(
  p_limit integer default 50
)
returns table(
  user_id uuid,
  display_name text,
  completed_entries integer,
  wins integer,
  respect_received integer,
  arena_score integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit,50),1),100);
begin
  if actor is null then raise exception 'Authentication required'; end if;

  return query
  with individual as (
    select r.submitted_by as user_id,
      count(*)::integer completed_entries,
      count(*) filter(where c.winner_user_id=r.submitted_by)::integer wins,
      coalesce(sum(r.respect_received),0)::integer respect_received
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id=r.challenge_id
    where r.verified=true
      and c.status='COMPLETED'
      and public.can_view_igpat_arena_challenge_v2(c.id)
      and (r.post_id is null or public.can_view_community_post_v2(r.post_id))
    group by r.submitted_by
  ), visible_squad as (
    select sm.id,sm.winner_squad_id
    from public.igpat_arena_squad_matches sm
    where sm.status='COMPLETED'
      and sm.challenger_post_id is not null
      and sm.opponent_post_id is not null
      and public.can_view_community_post_v2(sm.challenger_post_id)
      and public.can_view_community_post_v2(sm.opponent_post_id)
  ), squad as (
    select mm.user_id,
      count(*)::integer completed_entries,
      count(*) filter(where vs.winner_squad_id=mm.squad_id)::integer wins,
      0::integer respect_received
    from public.igpat_arena_squad_match_members mm
    join visible_squad vs on vs.id=mm.match_id
    group by mm.user_id
  ), visible_lms_events as (
    select e.id,e.champion_user_id
    from public.igpat_arena_lms_events e
    where e.status='COMPLETED'
      and not exists (
        select 1 from public.igpat_arena_lms_entries x
        where x.event_id=e.id
          and not public.can_view_community_post_v2(x.post_id)
      )
  ), lms_entries as (
    select x.user_id,
      count(*) filter(where x.advanced is not null)::integer completed_entries,
      0::integer wins,
      coalesce(sum(x.respect_received) filter(where x.advanced is not null),0)::integer respect_received
    from public.igpat_arena_lms_entries x
    join visible_lms_events ve on ve.id=x.event_id
    group by x.user_id
  ), lms_wins as (
    select ve.champion_user_id as user_id,0::integer completed_entries,count(*)::integer wins,0::integer respect_received
    from visible_lms_events ve
    where ve.champion_user_id is not null
    group by ve.champion_user_id
  ), all_stats as (
    select * from individual
    union all select * from squad
    union all select * from lms_entries
    union all select * from lms_wins
  ), combined as (
    select a.user_id,
      coalesce(sum(a.completed_entries),0)::integer completed_entries,
      coalesce(sum(a.wins),0)::integer wins,
      coalesce(sum(a.respect_received),0)::integer respect_received
    from all_stats a
    group by a.user_id
  )
  select c.user_id,
    coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member')::text,
    c.completed_entries,c.wins,c.respect_received,
    (c.wins*10+c.respect_received+c.completed_entries)::integer
  from combined c
  join public.profiles p on p.id=c.user_id
  order by (c.wins*10+c.respect_received+c.completed_entries) desc,
           c.respect_received desc,c.completed_entries desc,c.user_id asc
  limit safe_limit;
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
  safe_limit integer := least(greatest(coalesce(p_limit,50),1),100);
begin
  if actor is null then raise exception 'Authentication required'; end if;

  if p_season_id is null then
    select * into season
    from public.igpat_arena_seasons s
    where now()>=s.starts_at and now()<s.ends_at
    order by s.starts_at desc
    limit 1;
  else
    select * into season from public.igpat_arena_seasons s where s.id=p_season_id;
  end if;
  if season.id is null then return; end if;

  return query
  with individual as (
    select r.submitted_by as user_id,
      count(*)::integer completed_entries,
      count(*) filter(where c.winner_user_id=r.submitted_by)::integer wins,
      coalesce(sum(r.respect_received),0)::integer respect_received
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id=r.challenge_id
    where r.verified=true and c.status='COMPLETED'
      and c.completed_at>=season.starts_at and c.completed_at<season.ends_at
      and public.can_view_igpat_arena_challenge_v2(c.id)
      and (r.post_id is null or public.can_view_community_post_v2(r.post_id))
    group by r.submitted_by
  ), visible_squad as (
    select sm.id,sm.winner_squad_id
    from public.igpat_arena_squad_matches sm
    where sm.status='COMPLETED'
      and sm.completed_at>=season.starts_at and sm.completed_at<season.ends_at
      and sm.challenger_post_id is not null and sm.opponent_post_id is not null
      and public.can_view_community_post_v2(sm.challenger_post_id)
      and public.can_view_community_post_v2(sm.opponent_post_id)
  ), squad as (
    select mm.user_id,count(*)::integer completed_entries,
      count(*) filter(where vs.winner_squad_id=mm.squad_id)::integer wins,
      0::integer respect_received
    from public.igpat_arena_squad_match_members mm
    join visible_squad vs on vs.id=mm.match_id
    group by mm.user_id
  ), visible_lms_events as (
    select e.id,e.champion_user_id
    from public.igpat_arena_lms_events e
    where e.status='COMPLETED'
      and e.completed_at>=season.starts_at and e.completed_at<season.ends_at
      and not exists (
        select 1 from public.igpat_arena_lms_entries x
        where x.event_id=e.id and not public.can_view_community_post_v2(x.post_id)
      )
  ), lms_entries as (
    select x.user_id,
      count(*) filter(where x.advanced is not null)::integer completed_entries,
      0::integer wins,
      coalesce(sum(x.respect_received) filter(where x.advanced is not null),0)::integer respect_received
    from public.igpat_arena_lms_entries x
    join visible_lms_events ve on ve.id=x.event_id
    group by x.user_id
  ), lms_wins as (
    select ve.champion_user_id as user_id,0::integer completed_entries,count(*)::integer wins,0::integer respect_received
    from visible_lms_events ve
    where ve.champion_user_id is not null
    group by ve.champion_user_id
  ), all_stats as (
    select * from individual
    union all select * from squad
    union all select * from lms_entries
    union all select * from lms_wins
  ), combined as (
    select a.user_id,
      coalesce(sum(a.completed_entries),0)::integer completed_entries,
      coalesce(sum(a.wins),0)::integer wins,
      coalesce(sum(a.respect_received),0)::integer respect_received
    from all_stats a group by a.user_id
  ), scored as (
    select c.*,(c.wins*10+c.respect_received+c.completed_entries)::integer score
    from combined c
  )
  select s.user_id,
    coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member')::text,
    s.completed_entries,s.wins,s.respect_received,s.score,
    case
      when s.score>=300 then 'Champion'
      when s.score>=150 then 'Elite'
      when s.score>=75 then 'Gold'
      when s.score>=25 then 'Silver'
      else 'Bronze'
    end::text
  from scored s
  join public.profiles p on p.id=s.user_id
  order by s.score desc,s.respect_received desc,s.completed_entries desc,s.user_id asc
  limit safe_limit;
end;
$$;

revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from public,anon;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to authenticated,service_role;
revoke all on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) from public,anon;
grant execute on function public.get_buklod_igpat_season_rankings_v1(uuid,integer) to authenticated,service_role;
