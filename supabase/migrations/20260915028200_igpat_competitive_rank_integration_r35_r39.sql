-- BUKLOD IGPAT R35/R39 — stable team roster snapshots + Arena-only rank integration.
-- This updates only the IGPAT Arena ranking. It does not write Circle Rank,
-- Character Level, Formation Rank, Cluster points, Bayanihan points, or other systems.

create table if not exists public.igpat_arena_squad_match_members (
  match_id uuid not null references public.igpat_arena_squad_matches(id) on delete cascade,
  squad_id uuid not null references public.igpat_arena_squads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.igpat_arena_squad_match_members enable row level security;
revoke all on table public.igpat_arena_squad_match_members from public, anon, authenticated;
grant all on table public.igpat_arena_squad_match_members to service_role;

create or replace function public.igpat_create_squad_match_v1(p_squad_id uuid, p_opponent_squad_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); opponent_captain uuid; own_count integer; opponent_count integer; new_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_squad_id = p_opponent_squad_id then raise exception 'A Squad cannot challenge itself'; end if;
  if not exists(select 1 from public.igpat_arena_squads s where s.id=p_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then
    raise exception 'Only your active Squad captain can create this challenge';
  end if;
  select s.captain_user_id into opponent_captain from public.igpat_arena_squads s where s.id=p_opponent_squad_id and s.status='ACTIVE';
  if opponent_captain is null then raise exception 'Opponent Squad is unavailable'; end if;
  if not exists(select 1 from public.buklod_user_follows f where f.follower_id=actor and f.followed_user_id=opponent_captain) then
    raise exception 'Follow the opposing captain before sending a Squad challenge';
  end if;
  select count(*) into own_count from public.igpat_arena_squad_members m where m.squad_id=p_squad_id and m.status='ACTIVE';
  select count(*) into opponent_count from public.igpat_arena_squad_members m where m.squad_id=p_opponent_squad_id and m.status='ACTIVE';
  if own_count < 2 or opponent_count < 2 then raise exception 'Both Squads need at least 2 consenting active members'; end if;
  if exists (
    select 1 from public.igpat_arena_squad_matches m
    where m.status in ('OPEN','ACCEPTED','ACTIVE')
      and ((m.challenger_squad_id=p_squad_id and m.opponent_squad_id=p_opponent_squad_id)
        or (m.challenger_squad_id=p_opponent_squad_id and m.opponent_squad_id=p_squad_id))
  ) then raise exception 'These Squads already have an active challenge'; end if;
  if (select count(*) from public.igpat_arena_squad_matches m where m.challenger_squad_id=p_squad_id and m.created_at>=now()-interval '24 hours') >= 3 then
    raise exception 'Squad challenge cooldown reached. Try again later';
  end if;

  insert into public.igpat_arena_squad_matches(challenger_squad_id,opponent_squad_id,status)
  values(p_squad_id,p_opponent_squad_id,'OPEN') returning id into new_id;

  insert into public.igpat_arena_squad_match_members(match_id,squad_id,user_id)
  select new_id,m.squad_id,m.user_id
  from public.igpat_arena_squad_members m
  where m.squad_id in (p_squad_id,p_opponent_squad_id) and m.status='ACTIVE';

  return new_id;
end;
$$;

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
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); safe_limit integer := least(greatest(coalesce(p_limit,50),1),100);
begin
  if actor is null then raise exception 'Authentication required'; end if;
  return query
  with individual as (
    select r.submitted_by as user_id,
      count(*) filter(where c.status='COMPLETED')::integer completed_entries,
      count(*) filter(where c.status='COMPLETED' and c.winner_user_id=r.submitted_by)::integer wins,
      coalesce(sum(r.respect_received) filter(where c.status='COMPLETED'),0)::integer respect_received
    from public.igpat_arena_results r join public.igpat_arena_challenges c on c.id=r.challenge_id
    where r.verified=true and c.status='COMPLETED'
    group by r.submitted_by
  ), squad as (
    select mm.user_id,
      count(*)::integer completed_entries,
      count(*) filter(where sm.winner_squad_id=mm.squad_id)::integer wins,
      0::integer respect_received
    from public.igpat_arena_squad_match_members mm
    join public.igpat_arena_squad_matches sm on sm.id=mm.match_id
    where sm.status='COMPLETED'
    group by mm.user_id
  ), lms_entries as (
    select e.user_id,
      count(*) filter(where e.advanced is not null)::integer completed_entries,
      0::integer wins,
      coalesce(sum(e.respect_received) filter(where e.advanced is not null),0)::integer respect_received
    from public.igpat_arena_lms_entries e
    group by e.user_id
  ), lms_wins as (
    select e.champion_user_id as user_id,count(*)::integer wins
    from public.igpat_arena_lms_events e
    where e.status='COMPLETED' and e.champion_user_id is not null
    group by e.champion_user_id
  ), all_stats as (
    select i.user_id,i.completed_entries,i.wins,i.respect_received from individual i
    union all select s.user_id,s.completed_entries,s.wins,s.respect_received from squad s
    union all select l.user_id,l.completed_entries,l.wins,l.respect_received from lms_entries l
    union all select w.user_id,0,w.wins,0 from lms_wins w
  ), combined as (
    select a.user_id,
      coalesce(sum(a.completed_entries),0)::integer completed_entries,
      coalesce(sum(a.wins),0)::integer wins,
      coalesce(sum(a.respect_received),0)::integer respect_received
    from all_stats a group by a.user_id
  )
  select c.user_id,
    coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member')::text,
    c.completed_entries,c.wins,c.respect_received,
    (c.wins*10+c.respect_received+c.completed_entries)::integer
  from combined c join public.profiles p on p.id=c.user_id
  order by (c.wins*10+c.respect_received+c.completed_entries) desc,c.respect_received desc,c.completed_entries desc,c.user_id asc
  limit safe_limit;
end;
$$;

revoke all on function public.igpat_create_squad_match_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_create_squad_match_v1(uuid,uuid) to authenticated,service_role;
revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from public,anon;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to authenticated,service_role;
