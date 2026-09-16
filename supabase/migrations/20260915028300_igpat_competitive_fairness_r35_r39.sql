-- BUKLOD IGPAT R35/R39 fairness hardening.
-- Prevent vote-reset abuse and premature zero-vote finalization while keeping
-- deterministic time-based fallbacks so small communities cannot deadlock forever.

alter table public.igpat_arena_squad_matches add column if not exists activated_at timestamptz;
alter table public.igpat_arena_lms_events add column if not exists round_started_at timestamptz;

create or replace function public.igpat_submit_squad_match_v1(p_match_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); match_row public.igpat_arena_squad_matches%rowtype; actor_squad uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into match_row from public.igpat_arena_squad_matches m where m.id=p_match_id and m.status in ('ACCEPTED','ACTIVE') for update;
  if match_row.id is null then raise exception 'Squad match is not accepting submissions'; end if;
  if exists(select 1 from public.igpat_arena_squads s where s.id=match_row.challenger_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then actor_squad:=match_row.challenger_squad_id;
  elsif exists(select 1 from public.igpat_arena_squads s where s.id=match_row.opponent_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then actor_squad:=match_row.opponent_squad_id;
  else raise exception 'Only a participating Squad captain can submit the team IGPAT'; end if;

  if exists(select 1 from public.igpat_arena_squad_votes v where v.match_id=p_match_id) then
    raise exception 'Team IGPATs are locked after outside Respect voting begins';
  end if;
  if not exists(select 1 from public.community_posts cp where cp.id=p_post_id and cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and public.can_view_community_post_v2(cp.id)) then
    raise exception 'Squad submission must be the captain''s own visible IGPAT';
  end if;

  if actor_squad=match_row.challenger_squad_id then
    update public.igpat_arena_squad_matches set challenger_post_id=p_post_id where id=p_match_id;
  else
    update public.igpat_arena_squad_matches set opponent_post_id=p_post_id where id=p_match_id;
  end if;

  update public.igpat_arena_squad_matches
  set status='ACTIVE', activated_at=coalesce(activated_at,now())
  where id=p_match_id and challenger_post_id is not null and opponent_post_id is not null;
end;
$$;

create or replace function public.igpat_finalize_squad_match_v1(p_match_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); m public.igpat_arena_squad_matches%rowtype; a integer; b integer; votes integer; winner uuid:=null;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into m from public.igpat_arena_squad_matches x where x.id=p_match_id and x.status='ACTIVE' for update;
  if m.id is null then raise exception 'Squad match is not active'; end if;
  if not (public.igpat_is_active_squad_member_v1(m.challenger_squad_id,actor) or public.igpat_is_active_squad_member_v1(m.opponent_squad_id,actor)) then raise exception 'Only a participating Squad member can finalize'; end if;
  if m.challenger_post_id is null or m.opponent_post_id is null then raise exception 'Both Squads must submit first'; end if;
  select count(*) into votes from public.igpat_arena_squad_votes v where v.match_id=p_match_id;
  if votes<2 and coalesce(m.activated_at,m.created_at)>now()-interval '48 hours' then
    raise exception 'At least 2 unique outside Respect votes are required before early finalization';
  end if;
  select count(*) into a from public.igpat_arena_squad_votes v where v.match_id=p_match_id and v.squad_id=m.challenger_squad_id;
  select count(*) into b from public.igpat_arena_squad_votes v where v.match_id=p_match_id and v.squad_id=m.opponent_squad_id;
  if a>b then winner:=m.challenger_squad_id; elsif b>a then winner:=m.opponent_squad_id; end if;
  update public.igpat_arena_squad_matches set status='COMPLETED',winner_squad_id=winner,respect_score=a+b,completed_at=now() where id=p_match_id;
  return winner;
end;
$$;

create or replace function public.igpat_start_lms_event_v1(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); joined integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.igpat_arena_lms_events e where e.id=p_event_id and e.creator_user_id=actor and e.status='OPEN') then raise exception 'Only the event creator can start this open event'; end if;
  select count(*) into joined from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE';
  if joined<4 then raise exception 'Last Man Standing needs at least 4 consenting participants'; end if;
  update public.igpat_arena_lms_events set status='ACTIVE',current_round=1,round_started_at=now() where id=p_event_id and status='OPEN';
end;
$$;

create or replace function public.igpat_submit_lms_entry_v1(p_event_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype; has_entry boolean;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='ACTIVE';
  if e.id is null or not exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=actor and p.status='ACTIVE') then raise exception 'You are not active in this elimination round'; end if;
  select exists(select 1 from public.igpat_arena_lms_entries x where x.event_id=p_event_id and x.round_no=e.current_round and x.user_id=actor) into has_entry;
  if has_entry and exists(select 1 from public.igpat_arena_lms_votes v where v.event_id=p_event_id and v.round_no=e.current_round) then
    raise exception 'Round entries are locked after outside Respect voting begins';
  end if;
  if not exists(select 1 from public.community_posts cp where cp.id=p_post_id and cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and public.can_view_community_post_v2(cp.id)) then raise exception 'Round entry must be your own visible IGPAT'; end if;
  insert into public.igpat_arena_lms_entries(event_id,round_no,user_id,post_id,respect_received,submitted_at,advanced)
  values(p_event_id,e.current_round,actor,p_post_id,0,now(),null)
  on conflict(event_id,round_no,user_id) do update set post_id=excluded.post_id,respect_received=0,submitted_at=now(),advanced=null;
end;
$$;

create or replace function public.igpat_advance_lms_round_v1(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype; active_count integer; entry_count integer; advance_count integer; vote_count integer; required_votes integer; champion uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='ACTIVE' for update;
  if e.id is null then raise exception 'Last Man Standing event is not active'; end if;
  if not exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=actor and p.status='ACTIVE') and e.creator_user_id<>actor then raise exception 'Only an active participant or event creator can advance a completed round'; end if;
  select count(*) into active_count from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE';
  select count(*) into entry_count from public.igpat_arena_lms_entries x where x.event_id=p_event_id and x.round_no=e.current_round and exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=x.user_id and p.status='ACTIVE');
  if entry_count<>active_count then raise exception 'Every active participant must submit before advancement'; end if;
  if active_count<=1 then raise exception 'Event already has its final participant'; end if;
  select count(*) into vote_count from public.igpat_arena_lms_votes v where v.event_id=p_event_id and v.round_no=e.current_round;
  required_votes:=greatest(2,ceil(active_count::numeric/2.0)::integer);
  if vote_count<required_votes and coalesce(e.round_started_at,e.created_at)>now()-interval '72 hours' then
    raise exception 'More outside Respect is required before advancement (% of % minimum votes received)',vote_count,required_votes;
  end if;

  advance_count:=case when active_count=2 then 1 else ceil(active_count::numeric/2.0)::integer end;
  with ranked as (
    select x.user_id,row_number() over(order by x.respect_received desc,x.submitted_at asc,x.user_id asc) rn
    from public.igpat_arena_lms_entries x
    where x.event_id=p_event_id and x.round_no=e.current_round
      and exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=x.user_id and p.status='ACTIVE')
  )
  update public.igpat_arena_lms_entries x set advanced=(r.rn<=advance_count)
  from ranked r where x.event_id=p_event_id and x.round_no=e.current_round and x.user_id=r.user_id;

  update public.igpat_arena_lms_participants p set status='ELIMINATED',eliminated_round=e.current_round
  where p.event_id=p_event_id and p.status='ACTIVE' and exists(select 1 from public.igpat_arena_lms_entries x where x.event_id=p_event_id and x.round_no=e.current_round and x.user_id=p.user_id and x.advanced=false);

  select count(*) into active_count from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE';
  if active_count=1 then
    select p.user_id into champion from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE' limit 1;
    update public.igpat_arena_lms_participants set status='CHAMPION' where event_id=p_event_id and user_id=champion;
    update public.igpat_arena_lms_events set status='COMPLETED',champion_user_id=champion,completed_at=now() where id=p_event_id;
    return jsonb_build_object('completed',true,'champion_user_id',champion,'round',e.current_round);
  end if;
  update public.igpat_arena_lms_events set current_round=e.current_round+1,round_started_at=now() where id=p_event_id;
  return jsonb_build_object('completed',false,'remaining',active_count,'round',e.current_round+1);
end;
$$;

revoke all on function public.igpat_submit_squad_match_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_submit_squad_match_v1(uuid,uuid) to authenticated,service_role;
revoke all on function public.igpat_finalize_squad_match_v1(uuid) from public,anon;
grant execute on function public.igpat_finalize_squad_match_v1(uuid) to authenticated,service_role;
revoke all on function public.igpat_start_lms_event_v1(uuid) from public,anon;
grant execute on function public.igpat_start_lms_event_v1(uuid) to authenticated,service_role;
revoke all on function public.igpat_submit_lms_entry_v1(uuid,uuid) from public,anon;
grant execute on function public.igpat_submit_lms_entry_v1(uuid,uuid) to authenticated,service_role;
revoke all on function public.igpat_advance_lms_round_v1(uuid) from public,anon;
grant execute on function public.igpat_advance_lms_round_v1(uuid) to authenticated,service_role;
