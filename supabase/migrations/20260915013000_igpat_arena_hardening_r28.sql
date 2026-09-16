-- BUKLOD IGPAT R28-R30
-- Competitive layer hardening for Arena / Duel.
-- Source-only migration: do not apply to production until release verification.

create table if not exists public.igpat_arena_respect_votes (
  challenge_id uuid not null references public.igpat_arena_challenges(id) on delete cascade,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  result_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, voter_user_id)
);

alter table public.igpat_arena_respect_votes enable row level security;
revoke all on table public.igpat_arena_respect_votes from public;
revoke all on table public.igpat_arena_respect_votes from anon;
revoke all on table public.igpat_arena_respect_votes from authenticated;
grant all on table public.igpat_arena_respect_votes to service_role;

-- Arena tables are mediated by secured RPCs. Existing direct broad reads/writes are
-- removed so private/scoped IGPAT references are not leaked by Arena metadata.
drop policy if exists "igpat_arena_insert_own" on public.igpat_arena_challenges;
drop policy if exists "igpat_arena_read_authenticated" on public.igpat_arena_challenges;
drop policy if exists "igpat_arena_update_participant" on public.igpat_arena_challenges;
drop policy if exists "igpat_arena_results_insert_own" on public.igpat_arena_results;
drop policy if exists "igpat_arena_results_read_auth" on public.igpat_arena_results;

revoke all on table public.igpat_arena_challenges from public;
revoke all on table public.igpat_arena_challenges from anon;
revoke all on table public.igpat_arena_challenges from authenticated;
revoke all on table public.igpat_arena_results from public;
revoke all on table public.igpat_arena_results from anon;
revoke all on table public.igpat_arena_results from authenticated;
grant all on table public.igpat_arena_challenges to service_role;
grant all on table public.igpat_arena_results to service_role;

create or replace function public.can_view_igpat_arena_challenge_v2(
  p_challenge_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_data public.igpat_arena_challenges%rowtype;
begin
  if actor is null then
    return false;
  end if;

  select * into row_data
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id;

  if row_data.id is null then
    return false;
  end if;

  if row_data.post_id is not null
     and not public.can_view_community_post_v2(row_data.post_id) then
    return false;
  end if;

  return
    row_data.creator_user_id = actor
    or row_data.opponent_user_id = actor
    or (row_data.status = 'OPEN' and row_data.opponent_user_id is null)
    or row_data.status = 'COMPLETED';
end;
$$;

create or replace function public.igpat_create_arena_challenge_v2(
  p_mode text,
  p_post_id uuid default null,
  p_opponent_user_id uuid default null,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_mode text := lower(trim(coalesce(p_mode, '')));
  safe_title text := left(trim(coalesce(p_title, '')), 160);
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_mode not in (
    'duel','prove_it','squad_battle','king_of_the_hill','hard_mode',
    'iron_streak','ranked_season','boss_challenge','last_man_standing','bounty_challenge'
  ) then
    raise exception 'Invalid Arena mode';
  end if;

  if safe_mode = 'duel' and p_opponent_user_id is null then
    raise exception 'A Duel needs a specific opponent';
  end if;

  if p_opponent_user_id = actor then
    raise exception 'You cannot challenge yourself';
  end if;

  if p_opponent_user_id is not null then
    if not exists (
      select 1 from public.profiles p where p.id = p_opponent_user_id
    ) then
      raise exception 'Arena opponent was not found';
    end if;

    -- Deliberately narrow targeting: Arena may challenge only someone the actor
    -- already follows. This avoids turning Arena into a member-directory targeting tool.
    if not exists (
      select 1
      from public.buklod_user_follows f
      where f.follower_id = actor
        and f.followed_user_id = p_opponent_user_id
    ) then
      raise exception 'Follow this member first before sending a direct Arena challenge';
    end if;
  end if;

  if p_post_id is not null and not exists (
    select 1
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id)
  ) then
    raise exception 'Arena starter content must be your own visible IGPAT';
  end if;

  insert into public.igpat_arena_challenges(
    creator_user_id,
    mode,
    post_id,
    opponent_user_id,
    squad_id,
    title,
    status
  )
  values(
    actor,
    safe_mode,
    p_post_id,
    p_opponent_user_id,
    null,
    safe_title,
    'OPEN'
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Legacy compatibility: old callers are routed through the hardened contract.
create or replace function public.igpat_create_arena_challenge_v1(
  p_mode text,
  p_post_id uuid default null,
  p_opponent_user_id uuid default null,
  p_squad_id uuid default null,
  p_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_squad_id is not null then
    raise exception 'Squad Arena is not enabled in the hardened client yet';
  end if;
  return public.igpat_create_arena_challenge_v2(
    p_mode,
    p_post_id,
    p_opponent_user_id,
    p_title
  );
end;
$$;

create or replace function public.igpat_accept_arena_challenge_v1(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge public.igpat_arena_challenges%rowtype;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'OPEN'
  for update;

  if challenge.id is null
     or challenge.creator_user_id = actor
     or (challenge.opponent_user_id is not null and challenge.opponent_user_id <> actor) then
    raise exception 'Challenge is not available to accept';
  end if;

  if challenge.post_id is not null
     and not public.can_view_community_post_v2(challenge.post_id) then
    raise exception 'Challenge starter IGPAT is not available to this account';
  end if;

  update public.igpat_arena_challenges
  set opponent_user_id = coalesce(challenge.opponent_user_id, actor),
      status = 'ACCEPTED'
  where id = p_challenge_id;
end;
$$;

create or replace function public.igpat_decline_arena_challenge_v1(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  update public.igpat_arena_challenges c
  set status = 'CANCELLED'
  where c.id = p_challenge_id
    and c.status = 'OPEN'
    and c.opponent_user_id = actor;

  if not found then
    raise exception 'This Arena challenge cannot be declined by this account';
  end if;
end;
$$;

create or replace function public.igpat_cancel_arena_challenge_v1(
  p_challenge_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  update public.igpat_arena_challenges c
  set status = 'CANCELLED'
  where c.id = p_challenge_id
    and c.status = 'OPEN'
    and c.creator_user_id = actor;

  if not found then
    raise exception 'Only an unaccepted challenge can be cancelled by its creator';
  end if;
end;
$$;

create or replace function public.igpat_submit_arena_result_v1(
  p_challenge_id uuid,
  p_post_id uuid default null,
  p_completion_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge public.igpat_arena_challenges%rowtype;
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and (c.creator_user_id = actor or c.opponent_user_id = actor)
    and c.status in ('ACCEPTED','ACTIVE')
  for update;

  if challenge.id is null then
    raise exception 'You are not an active Arena participant';
  end if;

  if challenge.mode = 'duel' and p_post_id is null then
    raise exception 'A Duel result requires an IGPAT submission';
  end if;

  if p_post_id is not null and not exists (
    select 1
    from public.community_posts cp
    where cp.id = p_post_id
      and cp.user_id = actor
      and cp.is_reel = true
      and cp.is_hidden = false
      and cp.deleted_at is null
      and cp.media_mime_type like 'video/%'
      and public.can_view_community_post_v2(cp.id)
  ) then
    raise exception 'Arena result must be your own visible IGPAT';
  end if;

  if p_post_id is not null and exists (
    select 1
    from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id
      and r.submitted_by <> actor
      and r.post_id = p_post_id
  ) then
    raise exception 'Each Arena participant must submit their own IGPAT';
  end if;

  insert into public.igpat_arena_results(
    challenge_id,
    submitted_by,
    post_id,
    completion_note,
    verified,
    respect_received
  )
  values(
    p_challenge_id,
    actor,
    p_post_id,
    left(trim(coalesce(p_completion_note, '')), 800),
    true,
    0
  )
  on conflict(challenge_id, submitted_by) do update
    set post_id = excluded.post_id,
        completion_note = excluded.completion_note,
        verified = true
  returning id into new_id;

  update public.igpat_arena_challenges
  set status = 'ACTIVE'
  where id = p_challenge_id
    and status = 'ACCEPTED';

  return new_id;
end;
$$;

create or replace function public.igpat_give_arena_respect_v2(
  p_challenge_id uuid,
  p_result_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge public.igpat_arena_challenges%rowtype;
  result_post_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'ACTIVE';

  if challenge.id is null or not public.can_view_igpat_arena_challenge_v2(p_challenge_id) then
    raise exception 'Arena challenge is not available for Respect voting';
  end if;

  if actor = challenge.creator_user_id or actor = challenge.opponent_user_id then
    raise exception 'Arena participants cannot vote in their own challenge';
  end if;

  select r.post_id into result_post_id
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id
    and r.submitted_by = p_result_user_id
    and r.verified = true;

  if not found then
    raise exception 'Arena result was not found';
  end if;

  if result_post_id is not null
     and not public.can_view_community_post_v2(result_post_id) then
    raise exception 'This Arena result is not available to this account';
  end if;

  insert into public.igpat_arena_respect_votes(
    challenge_id,
    voter_user_id,
    result_user_id,
    created_at
  )
  values(p_challenge_id, actor, p_result_user_id, now())
  on conflict(challenge_id, voter_user_id) do update
    set result_user_id = excluded.result_user_id,
        created_at = now();

  update public.igpat_arena_results r
  set respect_received = (
    select count(*)::integer
    from public.igpat_arena_respect_votes v
    where v.challenge_id = p_challenge_id
      and v.result_user_id = r.submitted_by
  )
  where r.challenge_id = p_challenge_id;

  update public.igpat_arena_challenges c
  set respect_score = (
    select count(*)::integer
    from public.igpat_arena_respect_votes v
    where v.challenge_id = p_challenge_id
  )
  where c.id = p_challenge_id;
end;
$$;

create or replace function public.igpat_give_arena_respect_v1(
  p_challenge_id uuid,
  p_result_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.igpat_give_arena_respect_v2(p_challenge_id, p_result_user_id);
$$;

create or replace function public.igpat_complete_arena_challenge_v2(
  p_challenge_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  challenge public.igpat_arena_challenges%rowtype;
  result_count integer := 0;
  top_score integer := 0;
  top_count integer := 0;
  computed_winner uuid := null;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'ACTIVE'
    and (c.creator_user_id = actor or c.opponent_user_id = actor)
  for update;

  if challenge.id is null then
    raise exception 'Only an active Arena participant can finalize this challenge';
  end if;

  select count(*)::integer
  into result_count
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id
    and r.verified = true;

  if challenge.mode = 'duel' and result_count < 2 then
    raise exception 'Both Duel participants must submit before finalization';
  end if;

  select coalesce(max(r.respect_received), 0)::integer
  into top_score
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id
    and r.verified = true;

  if top_score > 0 then
    select count(*)::integer
    into top_count
    from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id
      and r.verified = true
      and r.respect_received = top_score;

    if top_count = 1 then
      select r.submitted_by
      into computed_winner
      from public.igpat_arena_results r
      where r.challenge_id = p_challenge_id
        and r.verified = true
        and r.respect_received = top_score
      limit 1;
    end if;
  end if;

  update public.igpat_arena_challenges
  set status = 'COMPLETED',
      winner_user_id = computed_winner,
      completed_at = now()
  where id = p_challenge_id;

  return computed_winner;
end;
$$;

-- Legacy signature no longer trusts a caller-supplied winner.
create or replace function public.igpat_complete_arena_challenge_v1(
  p_challenge_id uuid,
  p_winner_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.igpat_complete_arena_challenge_v2(p_challenge_id);
end;
$$;

create or replace function public.igpat_rematch_arena_challenge_v1(
  p_challenge_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  src public.igpat_arena_challenges%rowtype;
  other_user uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into src
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'COMPLETED';

  if src.id is null
     or (src.creator_user_id <> actor and src.opponent_user_id is distinct from actor) then
    raise exception 'Rematch unavailable';
  end if;

  other_user := case
    when src.creator_user_id = actor then src.opponent_user_id
    else src.creator_user_id
  end;

  if other_user is null then
    raise exception 'Rematch needs the previous opponent';
  end if;

  return public.igpat_create_arena_challenge_v2(
    src.mode,
    null,
    other_user,
    left(concat('REMATCH · ', coalesce(nullif(src.title, ''), src.mode)), 160)
  );
end;
$$;

create or replace function public.get_buklod_igpat_arena_v2(
  p_scope text default 'mine',
  p_limit integer default 30
)
returns table(
  id uuid,
  mode text,
  title text,
  status text,
  creator_user_id uuid,
  creator_name text,
  opponent_user_id uuid,
  opponent_name text,
  winner_user_id uuid,
  winner_name text,
  starter_post_id uuid,
  result_count integer,
  respect_score integer,
  created_at timestamptz,
  completed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_scope text := lower(coalesce(nullif(trim(p_scope), ''), 'mine'));
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if safe_scope not in ('mine','open','completed') then
    raise exception 'Invalid Arena scope';
  end if;

  return query
  select
    c.id,
    c.mode,
    c.title,
    c.status,
    c.creator_user_id,
    coalesce(cp.full_name, cp.first_name, cp.username, 'BUKLOD Member')::text,
    c.opponent_user_id,
    case when c.opponent_user_id is null then null
      else coalesce(op.full_name, op.first_name, op.username, 'BUKLOD Member')::text end,
    c.winner_user_id,
    case when c.winner_user_id is null then null
      else coalesce(wp.full_name, wp.first_name, wp.username, 'BUKLOD Member')::text end,
    c.post_id,
    (
      select count(*)::integer
      from public.igpat_arena_results r
      where r.challenge_id = c.id and r.verified = true
    ),
    c.respect_score,
    c.created_at,
    c.completed_at
  from public.igpat_arena_challenges c
  join public.profiles cp on cp.id = c.creator_user_id
  left join public.profiles op on op.id = c.opponent_user_id
  left join public.profiles wp on wp.id = c.winner_user_id
  where public.can_view_igpat_arena_challenge_v2(c.id)
    and (
      (safe_scope = 'mine' and (c.creator_user_id = actor or c.opponent_user_id = actor))
      or (safe_scope = 'open' and c.status = 'OPEN' and c.opponent_user_id is null)
      or (safe_scope = 'completed' and c.status = 'COMPLETED')
    )
  order by c.created_at desc, c.id desc
  limit safe_limit;
end;
$$;

create or replace function public.get_buklod_igpat_arena_detail_v2(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.igpat_arena_challenges%rowtype;
  result_data jsonb := '[]'::jsonb;
  my_vote uuid := null;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_view_igpat_arena_challenge_v2(p_challenge_id) then
    raise exception 'Arena challenge is unavailable for this account';
  end if;

  select * into c
  from public.igpat_arena_challenges row_data
  where row_data.id = p_challenge_id;

  select coalesce(jsonb_agg(item order by (item->>'created_at')::timestamptz), '[]'::jsonb)
  into result_data
  from (
    select jsonb_build_object(
      'submitted_by', r.submitted_by,
      'participant_name', coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member'),
      'post_id', case
        when r.post_id is null or public.can_view_community_post_v2(r.post_id) then r.post_id
        else null
      end,
      'completion_note', r.completion_note,
      'respect_received', r.respect_received,
      'verified', r.verified,
      'created_at', r.created_at
    ) as item
    from public.igpat_arena_results r
    join public.profiles p on p.id = r.submitted_by
    where r.challenge_id = p_challenge_id
      and r.verified = true
  ) visible_results;

  select v.result_user_id
  into my_vote
  from public.igpat_arena_respect_votes v
  where v.challenge_id = p_challenge_id
    and v.voter_user_id = actor;

  return jsonb_build_object(
    'id', c.id,
    'mode', c.mode,
    'title', c.title,
    'status', c.status,
    'creator_user_id', c.creator_user_id,
    'creator_name', (select coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member') from public.profiles p where p.id = c.creator_user_id),
    'opponent_user_id', c.opponent_user_id,
    'opponent_name', (select coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member') from public.profiles p where p.id = c.opponent_user_id),
    'winner_user_id', c.winner_user_id,
    'winner_name', (select coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member') from public.profiles p where p.id = c.winner_user_id),
    'starter_post_id', case
      when c.post_id is null or public.can_view_community_post_v2(c.post_id) then c.post_id
      else null
    end,
    'respect_score', c.respect_score,
    'results', result_data,
    'my_vote_result_user_id', my_vote,
    'is_creator', c.creator_user_id = actor,
    'is_opponent', c.opponent_user_id = actor,
    'can_accept', c.status = 'OPEN' and c.creator_user_id <> actor and (c.opponent_user_id is null or c.opponent_user_id = actor),
    'can_decline', c.status = 'OPEN' and c.opponent_user_id = actor,
    'can_cancel', c.status = 'OPEN' and c.creator_user_id = actor,
    'can_submit', c.status in ('ACCEPTED','ACTIVE') and (c.creator_user_id = actor or c.opponent_user_id = actor),
    'can_vote', c.status = 'ACTIVE' and actor <> c.creator_user_id and actor is distinct from c.opponent_user_id,
    'can_finalize', c.status = 'ACTIVE' and (c.creator_user_id = actor or c.opponent_user_id = actor),
    'created_at', c.created_at,
    'completed_at', c.completed_at
  );
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
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  with entries as (
    select
      r.submitted_by as user_id,
      count(*) filter (where c.status = 'COMPLETED')::integer as completed_entries,
      count(*) filter (where c.status = 'COMPLETED' and c.winner_user_id = r.submitted_by)::integer as wins,
      coalesce(sum(r.respect_received) filter (where c.status = 'COMPLETED'), 0)::integer as respect_received
    from public.igpat_arena_results r
    join public.igpat_arena_challenges c on c.id = r.challenge_id
    where r.verified = true
      and c.status = 'COMPLETED'
    group by r.submitted_by
  )
  select
    e.user_id,
    coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text,
    e.completed_entries,
    e.wins,
    e.respect_received,
    (e.wins * 10 + e.respect_received + e.completed_entries)::integer as arena_score
  from entries e
  join public.profiles p on p.id = e.user_id
  order by (e.wins * 10 + e.respect_received + e.completed_entries) desc,
           e.respect_received desc,
           e.completed_entries desc,
           e.user_id asc
  limit safe_limit;
end;
$$;

-- Lock function execution to authenticated clients/service role.
revoke all on function public.can_view_igpat_arena_challenge_v2(uuid) from public;
revoke all on function public.can_view_igpat_arena_challenge_v2(uuid) from anon;
grant execute on function public.can_view_igpat_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.can_view_igpat_arena_challenge_v2(uuid) to service_role;

revoke all on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) from public;
revoke all on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) from anon;
grant execute on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) to authenticated;
grant execute on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) to service_role;

revoke all on function public.igpat_create_arena_challenge_v1(text,uuid,uuid,uuid,text) from public;
revoke all on function public.igpat_create_arena_challenge_v1(text,uuid,uuid,uuid,text) from anon;
grant execute on function public.igpat_create_arena_challenge_v1(text,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.igpat_create_arena_challenge_v1(text,uuid,uuid,uuid,text) to service_role;

revoke all on function public.igpat_accept_arena_challenge_v1(uuid) from public;
revoke all on function public.igpat_accept_arena_challenge_v1(uuid) from anon;
grant execute on function public.igpat_accept_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_accept_arena_challenge_v1(uuid) to service_role;

revoke all on function public.igpat_decline_arena_challenge_v1(uuid) from public;
revoke all on function public.igpat_decline_arena_challenge_v1(uuid) from anon;
grant execute on function public.igpat_decline_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_decline_arena_challenge_v1(uuid) to service_role;

revoke all on function public.igpat_cancel_arena_challenge_v1(uuid) from public;
revoke all on function public.igpat_cancel_arena_challenge_v1(uuid) from anon;
grant execute on function public.igpat_cancel_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_cancel_arena_challenge_v1(uuid) to service_role;

revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from public;
revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from anon;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to authenticated;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to service_role;

revoke all on function public.igpat_give_arena_respect_v2(uuid,uuid) from public;
revoke all on function public.igpat_give_arena_respect_v2(uuid,uuid) from anon;
grant execute on function public.igpat_give_arena_respect_v2(uuid,uuid) to authenticated;
grant execute on function public.igpat_give_arena_respect_v2(uuid,uuid) to service_role;

revoke all on function public.igpat_give_arena_respect_v1(uuid,uuid) from public;
revoke all on function public.igpat_give_arena_respect_v1(uuid,uuid) from anon;
grant execute on function public.igpat_give_arena_respect_v1(uuid,uuid) to authenticated;
grant execute on function public.igpat_give_arena_respect_v1(uuid,uuid) to service_role;

revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from public;
revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from anon;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to service_role;

revoke all on function public.igpat_complete_arena_challenge_v1(uuid,uuid) from public;
revoke all on function public.igpat_complete_arena_challenge_v1(uuid,uuid) from anon;
grant execute on function public.igpat_complete_arena_challenge_v1(uuid,uuid) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v1(uuid,uuid) to service_role;

revoke all on function public.igpat_rematch_arena_challenge_v1(uuid) from public;
revoke all on function public.igpat_rematch_arena_challenge_v1(uuid) from anon;
grant execute on function public.igpat_rematch_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_rematch_arena_challenge_v1(uuid) to service_role;

revoke all on function public.get_buklod_igpat_arena_v2(text,integer) from public;
revoke all on function public.get_buklod_igpat_arena_v2(text,integer) from anon;
grant execute on function public.get_buklod_igpat_arena_v2(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_arena_v2(text,integer) to service_role;

revoke all on function public.get_buklod_igpat_arena_detail_v2(uuid) from public;
revoke all on function public.get_buklod_igpat_arena_detail_v2(uuid) from anon;
grant execute on function public.get_buklod_igpat_arena_detail_v2(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_arena_detail_v2(uuid) to service_role;

revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from public;
revoke all on function public.get_buklod_igpat_arena_rankings_v1(integer) from anon;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to authenticated;
grant execute on function public.get_buklod_igpat_arena_rankings_v1(integer) to service_role;
