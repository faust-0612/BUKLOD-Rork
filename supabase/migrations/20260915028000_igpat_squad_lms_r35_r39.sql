-- BUKLOD IGPAT R35 / R39 — Squad vs Squad + Last Man Standing
-- No wagering, no forced participation, no public decline shame, no random elimination.
-- All content submissions remain real IGPATs and current visibility remains authoritative.

create table if not exists public.igpat_arena_squads (
  id uuid primary key default gen_random_uuid(),
  captain_user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists igpat_arena_one_active_captain_squad_idx
  on public.igpat_arena_squads(captain_user_id)
  where status = 'ACTIVE';

create table if not exists public.igpat_arena_squad_members (
  squad_id uuid not null references public.igpat_arena_squads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('INVITED','ACTIVE','DECLINED','LEFT')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (squad_id, user_id)
);

create unique index if not exists igpat_arena_one_active_squad_membership_idx
  on public.igpat_arena_squad_members(user_id)
  where status = 'ACTIVE';

create table if not exists public.igpat_arena_squad_matches (
  id uuid primary key default gen_random_uuid(),
  challenger_squad_id uuid not null references public.igpat_arena_squads(id) on delete cascade,
  opponent_squad_id uuid not null references public.igpat_arena_squads(id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN','ACCEPTED','ACTIVE','COMPLETED','CANCELLED')),
  challenger_post_id uuid references public.community_posts(id) on delete set null,
  opponent_post_id uuid references public.community_posts(id) on delete set null,
  winner_squad_id uuid references public.igpat_arena_squads(id) on delete set null,
  respect_score integer not null default 0 check (respect_score >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (challenger_squad_id <> opponent_squad_id)
);

create table if not exists public.igpat_arena_squad_votes (
  match_id uuid not null references public.igpat_arena_squad_matches(id) on delete cascade,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  squad_id uuid not null references public.igpat_arena_squads(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, voter_user_id)
);

create table if not exists public.igpat_arena_lms_events (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('sports','preaching','singing','teaching','creativity','fitness','craftsmanship','trivia','skills')),
  max_participants smallint not null default 8 check (max_participants between 4 and 16),
  status text not null default 'OPEN' check (status in ('OPEN','ACTIVE','COMPLETED','CANCELLED')),
  current_round smallint not null default 0 check (current_round between 0 and 16),
  champion_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.igpat_arena_lms_participants (
  event_id uuid not null references public.igpat_arena_lms_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ELIMINATED','CHAMPION','LEFT')),
  joined_at timestamptz not null default now(),
  eliminated_round smallint,
  primary key (event_id, user_id)
);

create table if not exists public.igpat_arena_lms_entries (
  event_id uuid not null references public.igpat_arena_lms_events(id) on delete cascade,
  round_no smallint not null check (round_no between 1 and 16),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  respect_received integer not null default 0 check (respect_received >= 0),
  submitted_at timestamptz not null default now(),
  advanced boolean,
  primary key (event_id, round_no, user_id)
);

create table if not exists public.igpat_arena_lms_votes (
  event_id uuid not null references public.igpat_arena_lms_events(id) on delete cascade,
  round_no smallint not null,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  participant_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, round_no, voter_user_id)
);

alter table public.igpat_arena_squads enable row level security;
alter table public.igpat_arena_squad_members enable row level security;
alter table public.igpat_arena_squad_matches enable row level security;
alter table public.igpat_arena_squad_votes enable row level security;
alter table public.igpat_arena_lms_events enable row level security;
alter table public.igpat_arena_lms_participants enable row level security;
alter table public.igpat_arena_lms_entries enable row level security;
alter table public.igpat_arena_lms_votes enable row level security;

revoke all on table public.igpat_arena_squads from public, anon, authenticated;
revoke all on table public.igpat_arena_squad_members from public, anon, authenticated;
revoke all on table public.igpat_arena_squad_matches from public, anon, authenticated;
revoke all on table public.igpat_arena_squad_votes from public, anon, authenticated;
revoke all on table public.igpat_arena_lms_events from public, anon, authenticated;
revoke all on table public.igpat_arena_lms_participants from public, anon, authenticated;
revoke all on table public.igpat_arena_lms_entries from public, anon, authenticated;
revoke all on table public.igpat_arena_lms_votes from public, anon, authenticated;

grant all on table public.igpat_arena_squads to service_role;
grant all on table public.igpat_arena_squad_members to service_role;
grant all on table public.igpat_arena_squad_matches to service_role;
grant all on table public.igpat_arena_squad_votes to service_role;
grant all on table public.igpat_arena_lms_events to service_role;
grant all on table public.igpat_arena_lms_participants to service_role;
grant all on table public.igpat_arena_lms_entries to service_role;
grant all on table public.igpat_arena_lms_votes to service_role;

create or replace function public.igpat_is_active_squad_member_v1(p_squad_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.igpat_arena_squad_members m
    where m.squad_id = p_squad_id and m.user_id = p_user_id and m.status = 'ACTIVE'
  );
$$;

create or replace function public.igpat_create_my_squad_v1()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  existing_id uuid;
  new_id uuid;
  actor_name text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select s.id into existing_id from public.igpat_arena_squads s where s.captain_user_id = actor and s.status = 'ACTIVE';
  if existing_id is not null then return existing_id; end if;
  if exists (select 1 from public.igpat_arena_squad_members m where m.user_id = actor and m.status = 'ACTIVE') then
    raise exception 'Leave your current Arena Squad before creating another';
  end if;
  select coalesce(nullif(trim(p.first_name),''), nullif(trim(p.username),''), 'BUKLOD') into actor_name
  from public.profiles p where p.id = actor and coalesce(p.is_active,false) = true;
  if actor_name is null then raise exception 'Active BUKLOD profile required'; end if;
  insert into public.igpat_arena_squads(captain_user_id,display_name)
  values(actor, left('Squad · ' || actor_name, 120)) returning id into new_id;
  insert into public.igpat_arena_squad_members(squad_id,user_id,status,invited_by,responded_at)
  values(new_id,actor,'ACTIVE',actor,now());
  return new_id;
end;
$$;

create or replace function public.igpat_invite_squad_member_v1(p_squad_id uuid, p_target_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); active_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.igpat_arena_squads s where s.id=p_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then
    raise exception 'Only the active Squad captain can invite members';
  end if;
  if p_target_user_id = actor then raise exception 'Captain is already in the Squad'; end if;
  if not exists (select 1 from public.buklod_user_follows f where f.follower_id=actor and f.followed_user_id=p_target_user_id) then
    raise exception 'Follow this member first before inviting them to your Squad';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_target_user_id and coalesce(p.is_active,false)=true) then
    raise exception 'Member is not active';
  end if;
  if exists (select 1 from public.igpat_arena_squad_members m where m.user_id=p_target_user_id and m.status='ACTIVE') then
    raise exception 'Member already belongs to an active Arena Squad';
  end if;
  select count(*) into active_count from public.igpat_arena_squad_members m where m.squad_id=p_squad_id and m.status='ACTIVE';
  if active_count >= 8 then raise exception 'Arena Squads are limited to 8 active members'; end if;
  insert into public.igpat_arena_squad_members(squad_id,user_id,status,invited_by,responded_at)
  values(p_squad_id,p_target_user_id,'INVITED',actor,null)
  on conflict(squad_id,user_id) do update set status='INVITED', invited_by=actor, created_at=now(), responded_at=null
  where igpat_arena_squad_members.status <> 'ACTIVE';
end;
$$;

create or replace function public.igpat_respond_squad_invite_v1(p_squad_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); active_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.igpat_arena_squad_members m where m.squad_id=p_squad_id and m.user_id=actor and m.status='INVITED') then
    raise exception 'Squad invitation is unavailable';
  end if;
  if coalesce(p_accept,false) then
    if exists (select 1 from public.igpat_arena_squad_members m where m.user_id=actor and m.status='ACTIVE') then
      raise exception 'Leave your current Arena Squad before accepting another';
    end if;
    select count(*) into active_count from public.igpat_arena_squad_members m where m.squad_id=p_squad_id and m.status='ACTIVE';
    if active_count >= 8 then raise exception 'This Arena Squad is already full'; end if;
    update public.igpat_arena_squad_members set status='ACTIVE', responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='INVITED';
  else
    update public.igpat_arena_squad_members set status='DECLINED', responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='INVITED';
  end if;
end;
$$;

create or replace function public.igpat_leave_squad_v1(p_squad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); captain uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select s.captain_user_id into captain from public.igpat_arena_squads s where s.id=p_squad_id and s.status='ACTIVE';
  if captain is null then raise exception 'Squad is unavailable'; end if;
  if captain = actor then
    if exists(select 1 from public.igpat_arena_squad_matches m where (m.challenger_squad_id=p_squad_id or m.opponent_squad_id=p_squad_id) and m.status in ('OPEN','ACCEPTED','ACTIVE')) then
      raise exception 'Finish or cancel active Squad matches before archiving the Squad';
    end if;
    update public.igpat_arena_squads set status='ARCHIVED',updated_at=now() where id=p_squad_id;
    update public.igpat_arena_squad_members set status='LEFT',responded_at=now() where squad_id=p_squad_id and status in ('ACTIVE','INVITED');
  else
    update public.igpat_arena_squad_members set status='LEFT',responded_at=now()
    where squad_id=p_squad_id and user_id=actor and status='ACTIVE';
    if not found then raise exception 'You are not an active member of this Squad'; end if;
  end if;
end;
$$;

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
  return new_id;
end;
$$;

create or replace function public.igpat_respond_squad_match_v1(p_match_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); opponent_squad uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select m.opponent_squad_id into opponent_squad from public.igpat_arena_squad_matches m where m.id=p_match_id and m.status='OPEN' for update;
  if opponent_squad is null or not exists(select 1 from public.igpat_arena_squads s where s.id=opponent_squad and s.captain_user_id=actor and s.status='ACTIVE') then
    raise exception 'Only the challenged Squad captain can respond';
  end if;
  update public.igpat_arena_squad_matches set status=case when coalesce(p_accept,false) then 'ACCEPTED' else 'CANCELLED' end where id=p_match_id;
end;
$$;

create or replace function public.igpat_submit_squad_match_v1(p_match_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); match_row public.igpat_arena_squad_matches%rowtype; actor_squad uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into match_row from public.igpat_arena_squad_matches m where m.id=p_match_id and m.status in ('ACCEPTED','ACTIVE') for update;
  if match_row.id is null then raise exception 'Squad match is not accepting submissions'; end if;
  if exists(select 1 from public.igpat_arena_squads s where s.id=match_row.challenger_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then
    actor_squad := match_row.challenger_squad_id;
  elsif exists(select 1 from public.igpat_arena_squads s where s.id=match_row.opponent_squad_id and s.captain_user_id=actor and s.status='ACTIVE') then
    actor_squad := match_row.opponent_squad_id;
  else raise exception 'Only a participating Squad captain can submit the team IGPAT'; end if;
  if not exists(select 1 from public.community_posts cp where cp.id=p_post_id and cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and public.can_view_community_post_v2(cp.id)) then
    raise exception 'Squad submission must be the captain''s own visible IGPAT';
  end if;
  if actor_squad=match_row.challenger_squad_id then
    update public.igpat_arena_squad_matches set challenger_post_id=p_post_id where id=p_match_id;
  else
    update public.igpat_arena_squad_matches set opponent_post_id=p_post_id where id=p_match_id;
  end if;
  update public.igpat_arena_squad_matches set status='ACTIVE'
  where id=p_match_id and challenger_post_id is not null and opponent_post_id is not null;
end;
$$;

create or replace function public.igpat_vote_squad_match_v1(p_match_id uuid, p_squad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); m public.igpat_arena_squad_matches%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into m from public.igpat_arena_squad_matches x where x.id=p_match_id and x.status='ACTIVE';
  if m.id is null then raise exception 'Squad match is unavailable for Respect'; end if;
  if p_squad_id not in (m.challenger_squad_id,m.opponent_squad_id) then raise exception 'Invalid Squad vote'; end if;
  if public.igpat_is_active_squad_member_v1(m.challenger_squad_id,actor) or public.igpat_is_active_squad_member_v1(m.opponent_squad_id,actor) then
    raise exception 'Match participants cannot vote in their own Squad battle';
  end if;
  if not public.can_view_community_post_v2(m.challenger_post_id) or not public.can_view_community_post_v2(m.opponent_post_id) then
    raise exception 'Both Squad IGPATs must be visible before voting';
  end if;
  insert into public.igpat_arena_squad_votes(match_id,voter_user_id,squad_id)
  values(p_match_id,actor,p_squad_id)
  on conflict(match_id,voter_user_id) do update set squad_id=excluded.squad_id,created_at=now();
  update public.igpat_arena_squad_matches set respect_score=(select count(*) from public.igpat_arena_squad_votes v where v.match_id=p_match_id) where id=p_match_id;
end;
$$;

create or replace function public.igpat_finalize_squad_match_v1(p_match_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); m public.igpat_arena_squad_matches%rowtype; a integer; b integer; winner uuid := null;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into m from public.igpat_arena_squad_matches x where x.id=p_match_id and x.status='ACTIVE' for update;
  if m.id is null then raise exception 'Squad match is not active'; end if;
  if not (public.igpat_is_active_squad_member_v1(m.challenger_squad_id,actor) or public.igpat_is_active_squad_member_v1(m.opponent_squad_id,actor)) then
    raise exception 'Only a participating Squad member can finalize';
  end if;
  if m.challenger_post_id is null or m.opponent_post_id is null then raise exception 'Both Squads must submit first'; end if;
  select count(*) into a from public.igpat_arena_squad_votes v where v.match_id=p_match_id and v.squad_id=m.challenger_squad_id;
  select count(*) into b from public.igpat_arena_squad_votes v where v.match_id=p_match_id and v.squad_id=m.opponent_squad_id;
  if a>b then winner:=m.challenger_squad_id; elsif b>a then winner:=m.opponent_squad_id; end if;
  update public.igpat_arena_squad_matches set status='COMPLETED',winner_squad_id=winner,respect_score=a+b,completed_at=now() where id=p_match_id;
  return winner;
end;
$$;

create or replace function public.get_my_buklod_igpat_squad_hub_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); own_squad uuid; payload jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select m.squad_id into own_squad from public.igpat_arena_squad_members m join public.igpat_arena_squads s on s.id=m.squad_id
  where m.user_id=actor and m.status='ACTIVE' and s.status='ACTIVE' limit 1;
  select jsonb_build_object(
    'my_squad', case when own_squad is null then null else (
      select jsonb_build_object('id',s.id,'display_name',s.display_name,'captain_user_id',s.captain_user_id,'is_captain',s.captain_user_id=actor,
        'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member'),'status',m.status) order by (m.status='ACTIVE') desc,m.created_at) from public.igpat_arena_squad_members m join public.profiles p on p.id=m.user_id where m.squad_id=s.id and m.status in ('ACTIVE','INVITED')),'[]'::jsonb))
      from public.igpat_arena_squads s where s.id=own_squad
    ) end,
    'invites', coalesce((select jsonb_agg(jsonb_build_object('squad_id',s.id,'display_name',s.display_name,'captain_name',coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member'),'created_at',m.created_at) order by m.created_at desc)
      from public.igpat_arena_squad_members m join public.igpat_arena_squads s on s.id=m.squad_id join public.profiles p on p.id=s.captain_user_id
      where m.user_id=actor and m.status='INVITED' and s.status='ACTIVE'),'[]'::jsonb),
    'invite_candidates', case when own_squad is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('user_id',f.followed_user_id,'name',coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member')) order by coalesce(p.full_name,p.first_name,p.username,''))
      from public.buklod_user_follows f join public.profiles p on p.id=f.followed_user_id
      where f.follower_id=actor and coalesce(p.is_active,false)=true and not exists(select 1 from public.igpat_arena_squad_members x where x.user_id=f.followed_user_id and x.status='ACTIVE')
        and not exists(select 1 from public.igpat_arena_squad_members x where x.squad_id=own_squad and x.user_id=f.followed_user_id and x.status in ('ACTIVE','INVITED'))),'[]'::jsonb) end,
    'opponents', case when own_squad is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('squad_id',s.id,'display_name',s.display_name,'captain_user_id',s.captain_user_id,'captain_name',coalesce(p.full_name,p.first_name,p.username,'BUKLOD Member'),'active_members',(select count(*) from public.igpat_arena_squad_members sm where sm.squad_id=s.id and sm.status='ACTIVE')) order by s.created_at desc)
      from public.igpat_arena_squads s join public.profiles p on p.id=s.captain_user_id join public.buklod_user_follows f on f.follower_id=actor and f.followed_user_id=s.captain_user_id
      where s.status='ACTIVE' and s.id<>own_squad and (select count(*) from public.igpat_arena_squad_members sm where sm.squad_id=s.id and sm.status='ACTIVE')>=2),'[]'::jsonb) end,
    'matches', case when own_squad is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'status',m.status,'challenger_squad_id',m.challenger_squad_id,'challenger_name',cs.display_name,'opponent_squad_id',m.opponent_squad_id,'opponent_name',os.display_name,'challenger_post_id',case when m.challenger_post_id is not null and public.can_view_community_post_v2(m.challenger_post_id) then m.challenger_post_id else null end,'opponent_post_id',case when m.opponent_post_id is not null and public.can_view_community_post_v2(m.opponent_post_id) then m.opponent_post_id else null end,'winner_squad_id',m.winner_squad_id,'respect_score',m.respect_score,'created_at',m.created_at) order by m.created_at desc)
      from public.igpat_arena_squad_matches m join public.igpat_arena_squads cs on cs.id=m.challenger_squad_id join public.igpat_arena_squads os on os.id=m.opponent_squad_id where m.challenger_squad_id=own_squad or m.opponent_squad_id=own_squad),'[]'::jsonb) end,
    'votable_matches', coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'challenger_squad_id',m.challenger_squad_id,'challenger_name',cs.display_name,'opponent_squad_id',m.opponent_squad_id,'opponent_name',os.display_name,'challenger_post_id',m.challenger_post_id,'opponent_post_id',m.opponent_post_id,'my_vote_squad_id',(select v.squad_id from public.igpat_arena_squad_votes v where v.match_id=m.id and v.voter_user_id=actor),'respect_score',m.respect_score) order by m.created_at desc)
      from public.igpat_arena_squad_matches m join public.igpat_arena_squads cs on cs.id=m.challenger_squad_id join public.igpat_arena_squads os on os.id=m.opponent_squad_id
      where m.status='ACTIVE' and not public.igpat_is_active_squad_member_v1(m.challenger_squad_id,actor) and not public.igpat_is_active_squad_member_v1(m.opponent_squad_id,actor) and public.can_view_community_post_v2(m.challenger_post_id) and public.can_view_community_post_v2(m.opponent_post_id)),'[]'::jsonb),
    'my_igpats', coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'created_at',x.created_at) order by x.created_at desc) from (select cp.id,cp.body,cp.created_at from public.community_posts cp where cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' order by cp.created_at desc limit 20) x),'[]'::jsonb)
  ) into payload;
  return payload;
end;
$$;

create or replace function public.igpat_create_lms_event_v1(p_category text, p_max_participants integer default 8)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); category text := lower(trim(coalesce(p_category,''))); cap integer := least(greatest(coalesce(p_max_participants,8),4),16); new_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if category not in ('sports','preaching','singing','teaching','creativity','fitness','craftsmanship','trivia','skills') then raise exception 'Invalid Last Man Standing category'; end if;
  if exists(select 1 from public.igpat_arena_lms_events e where e.creator_user_id=actor and e.status in ('OPEN','ACTIVE')) then raise exception 'Finish your current Last Man Standing event first'; end if;
  insert into public.igpat_arena_lms_events(creator_user_id,category,max_participants) values(actor,category,cap) returning id into new_id;
  insert into public.igpat_arena_lms_participants(event_id,user_id,status) values(new_id,actor,'ACTIVE');
  return new_id;
end;
$$;

create or replace function public.igpat_join_lms_event_v1(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype; joined integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='OPEN' for update;
  if e.id is null then raise exception 'Last Man Standing event is not open'; end if;
  select count(*) into joined from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE';
  if joined>=e.max_participants then raise exception 'Last Man Standing event is full'; end if;
  insert into public.igpat_arena_lms_participants(event_id,user_id,status) values(p_event_id,actor,'ACTIVE') on conflict(event_id,user_id) do update set status='ACTIVE',joined_at=now(),eliminated_round=null;
end;
$$;

create or replace function public.igpat_leave_lms_event_v1(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id for update;
  if e.id is null then raise exception 'Last Man Standing event is unavailable'; end if;
  if e.creator_user_id=actor and e.status='OPEN' then
    update public.igpat_arena_lms_events set status='CANCELLED' where id=p_event_id;
    update public.igpat_arena_lms_participants set status='LEFT' where event_id=p_event_id and status='ACTIVE';
  elsif e.status='OPEN' then
    update public.igpat_arena_lms_participants set status='LEFT' where event_id=p_event_id and user_id=actor and status='ACTIVE';
    if not found then raise exception 'You are not joined to this event'; end if;
  else
    raise exception 'Participants cannot leave after elimination rounds begin';
  end if;
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
  update public.igpat_arena_lms_events set status='ACTIVE',current_round=1 where id=p_event_id and status='OPEN';
end;
$$;

create or replace function public.igpat_submit_lms_entry_v1(p_event_id uuid, p_post_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='ACTIVE';
  if e.id is null or not exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=actor and p.status='ACTIVE') then raise exception 'You are not active in this elimination round'; end if;
  if not exists(select 1 from public.community_posts cp where cp.id=p_post_id and cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' and public.can_view_community_post_v2(cp.id)) then raise exception 'Round entry must be your own visible IGPAT'; end if;
  insert into public.igpat_arena_lms_entries(event_id,round_no,user_id,post_id,respect_received,submitted_at,advanced)
  values(p_event_id,e.current_round,actor,p_post_id,0,now(),null)
  on conflict(event_id,round_no,user_id) do update set post_id=excluded.post_id,respect_received=0,submitted_at=now(),advanced=null;
  delete from public.igpat_arena_lms_votes v where v.event_id=p_event_id and v.round_no=e.current_round;
  update public.igpat_arena_lms_entries x set respect_received=0 where x.event_id=p_event_id and x.round_no=e.current_round;
end;
$$;

create or replace function public.igpat_vote_lms_v1(p_event_id uuid, p_participant_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype; post_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='ACTIVE';
  if e.id is null then raise exception 'Last Man Standing is unavailable for Respect'; end if;
  if exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=actor and p.status in ('ACTIVE','ELIMINATED','CHAMPION')) then raise exception 'Event participants cannot vote in their own elimination event'; end if;
  select x.post_id into post_id from public.igpat_arena_lms_entries x where x.event_id=p_event_id and x.round_no=e.current_round and x.user_id=p_participant_user_id;
  if post_id is null or not public.can_view_community_post_v2(post_id) then raise exception 'Round entry is unavailable to this account'; end if;
  insert into public.igpat_arena_lms_votes(event_id,round_no,voter_user_id,participant_user_id)
  values(p_event_id,e.current_round,actor,p_participant_user_id)
  on conflict(event_id,round_no,voter_user_id) do update set participant_user_id=excluded.participant_user_id,created_at=now();
  update public.igpat_arena_lms_entries x set respect_received=(select count(*) from public.igpat_arena_lms_votes v where v.event_id=p_event_id and v.round_no=e.current_round and v.participant_user_id=x.user_id)
  where x.event_id=p_event_id and x.round_no=e.current_round;
end;
$$;

create or replace function public.igpat_advance_lms_round_v1(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); e public.igpat_arena_lms_events%rowtype; active_count integer; entry_count integer; advance_count integer; champion uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into e from public.igpat_arena_lms_events x where x.id=p_event_id and x.status='ACTIVE' for update;
  if e.id is null then raise exception 'Last Man Standing event is not active'; end if;
  if not exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=actor and p.status='ACTIVE') and e.creator_user_id<>actor then raise exception 'Only an active participant or event creator can advance a completed round'; end if;
  select count(*) into active_count from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.status='ACTIVE';
  select count(*) into entry_count from public.igpat_arena_lms_entries x where x.event_id=p_event_id and x.round_no=e.current_round and exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=p_event_id and p.user_id=x.user_id and p.status='ACTIVE');
  if entry_count<>active_count then raise exception 'Every active participant must submit before advancement'; end if;
  if active_count<=1 then raise exception 'Event already has its final participant'; end if;
  advance_count := case when active_count=2 then 1 else ceil(active_count::numeric/2.0)::integer end;
  with ranked as (
    select x.user_id,row_number() over(order by x.respect_received desc,x.submitted_at asc,x.user_id asc) as rn
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
  update public.igpat_arena_lms_events set current_round=e.current_round+1 where id=p_event_id;
  return jsonb_build_object('completed',false,'remaining',active_count,'round',e.current_round+1);
end;
$$;

create or replace function public.get_buklod_igpat_lms_hub_v1()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'category',e.category,'max_participants',e.max_participants,'status',e.status,'current_round',e.current_round,'creator_user_id',e.creator_user_id,'creator_name',coalesce(cp.full_name,cp.first_name,cp.username,'BUKLOD Member'),'champion_user_id',e.champion_user_id,'champion_name',coalesce(wp.full_name,wp.first_name,wp.username,null),'created_at',e.created_at,
      'is_creator',e.creator_user_id=actor,
      'my_status',(select p.status from public.igpat_arena_lms_participants p where p.event_id=e.id and p.user_id=actor),
      'participants',coalesce((select jsonb_agg(jsonb_build_object('user_id',p.user_id,'name',coalesce(pr.full_name,pr.first_name,pr.username,'BUKLOD Member'),'status',p.status,'joined_at',p.joined_at,'eliminated_round',p.eliminated_round) order by p.joined_at) from public.igpat_arena_lms_participants p join public.profiles pr on pr.id=p.user_id where p.event_id=e.id and p.status<>'LEFT'),'[]'::jsonb),
      'entries',case when e.current_round>0 then coalesce((select jsonb_agg(jsonb_build_object('user_id',x.user_id,'name',coalesce(pr.full_name,pr.first_name,pr.username,'BUKLOD Member'),'post_id',case when public.can_view_community_post_v2(x.post_id) then x.post_id else null end,'respect_received',x.respect_received,'submitted_at',x.submitted_at,'advanced',x.advanced,'my_vote',exists(select 1 from public.igpat_arena_lms_votes v where v.event_id=e.id and v.round_no=e.current_round and v.voter_user_id=actor and v.participant_user_id=x.user_id)) order by x.respect_received desc,x.submitted_at) from public.igpat_arena_lms_entries x join public.profiles pr on pr.id=x.user_id where x.event_id=e.id and x.round_no=e.current_round),'[]'::jsonb) else '[]'::jsonb end
    ) order by case e.status when 'ACTIVE' then 0 when 'OPEN' then 1 else 2 end,e.created_at desc)
    from public.igpat_arena_lms_events e join public.profiles cp on cp.id=e.creator_user_id left join public.profiles wp on wp.id=e.champion_user_id
    where e.status in ('OPEN','ACTIVE') or exists(select 1 from public.igpat_arena_lms_participants p where p.event_id=e.id and p.user_id=actor)),'[]'::jsonb),
    'my_igpats',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'created_at',x.created_at) order by x.created_at desc) from (select cp.id,cp.body,cp.created_at from public.community_posts cp where cp.user_id=actor and cp.is_reel=true and cp.is_hidden=false and cp.deleted_at is null and cp.media_mime_type like 'video/%' order by cp.created_at desc limit 20) x),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.igpat_is_active_squad_member_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_create_my_squad_v1() from public,anon;
revoke all on function public.igpat_invite_squad_member_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_respond_squad_invite_v1(uuid,boolean) from public,anon;
revoke all on function public.igpat_leave_squad_v1(uuid) from public,anon;
revoke all on function public.igpat_create_squad_match_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_respond_squad_match_v1(uuid,boolean) from public,anon;
revoke all on function public.igpat_submit_squad_match_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_vote_squad_match_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_finalize_squad_match_v1(uuid) from public,anon;
revoke all on function public.get_my_buklod_igpat_squad_hub_v1() from public,anon;
revoke all on function public.igpat_create_lms_event_v1(text,integer) from public,anon;
revoke all on function public.igpat_join_lms_event_v1(uuid) from public,anon;
revoke all on function public.igpat_leave_lms_event_v1(uuid) from public,anon;
revoke all on function public.igpat_start_lms_event_v1(uuid) from public,anon;
revoke all on function public.igpat_submit_lms_entry_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_vote_lms_v1(uuid,uuid) from public,anon;
revoke all on function public.igpat_advance_lms_round_v1(uuid) from public,anon;
revoke all on function public.get_buklod_igpat_lms_hub_v1() from public,anon;

grant execute on function public.igpat_is_active_squad_member_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_create_my_squad_v1() to authenticated,service_role;
grant execute on function public.igpat_invite_squad_member_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_respond_squad_invite_v1(uuid,boolean) to authenticated,service_role;
grant execute on function public.igpat_leave_squad_v1(uuid) to authenticated,service_role;
grant execute on function public.igpat_create_squad_match_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_respond_squad_match_v1(uuid,boolean) to authenticated,service_role;
grant execute on function public.igpat_submit_squad_match_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_vote_squad_match_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_finalize_squad_match_v1(uuid) to authenticated,service_role;
grant execute on function public.get_my_buklod_igpat_squad_hub_v1() to authenticated,service_role;
grant execute on function public.igpat_create_lms_event_v1(text,integer) to authenticated,service_role;
grant execute on function public.igpat_join_lms_event_v1(uuid) to authenticated,service_role;
grant execute on function public.igpat_leave_lms_event_v1(uuid) to authenticated,service_role;
grant execute on function public.igpat_start_lms_event_v1(uuid) to authenticated,service_role;
grant execute on function public.igpat_submit_lms_entry_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_vote_lms_v1(uuid,uuid) to authenticated,service_role;
grant execute on function public.igpat_advance_lms_round_v1(uuid) to authenticated,service_role;
grant execute on function public.get_buklod_igpat_lms_hub_v1() to authenticated,service_role;
