-- BUKLOD IGPAT R37 + R42
-- Hard Mode is intentionally stricter. Direct Call Out challenges are rate-limited.

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
  recent_direct_count integer := 0;
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

  if safe_mode in ('duel','hard_mode') and p_opponent_user_id is null then
    raise exception 'This Arena mode needs a specific opponent';
  end if;

  if p_opponent_user_id = actor then
    raise exception 'You cannot challenge yourself';
  end if;

  if p_opponent_user_id is not null then
    if not exists (select 1 from public.profiles p where p.id = p_opponent_user_id) then
      raise exception 'Arena opponent was not found';
    end if;

    if not exists (
      select 1
      from public.buklod_user_follows f
      where f.follower_id = actor
        and f.followed_user_id = p_opponent_user_id
    ) then
      raise exception 'Follow this member first before sending a direct Arena challenge';
    end if;

    if exists (
      select 1
      from public.igpat_arena_challenges c
      where c.creator_user_id = actor
        and c.opponent_user_id = p_opponent_user_id
        and c.mode = safe_mode
        and c.status in ('OPEN','ACCEPTED','ACTIVE')
    ) then
      raise exception 'You already have an active challenge with this member in this mode';
    end if;

    select count(*)::integer into recent_direct_count
    from public.igpat_arena_challenges c
    where c.creator_user_id = actor
      and c.opponent_user_id is not null
      and c.created_at >= now() - interval '24 hours';

    if recent_direct_count >= 3 then
      raise exception 'Direct Arena challenge limit reached for the last 24 hours';
    end if;

    if exists (
      select 1
      from public.igpat_arena_challenges c
      where c.creator_user_id = actor
        and c.opponent_user_id = p_opponent_user_id
        and c.mode = safe_mode
        and c.status = 'CANCELLED'
        and c.created_at >= now() - interval '6 hours'
    ) then
      raise exception 'Give this member time before sending another challenge';
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
    creator_user_id, mode, post_id, opponent_user_id, squad_id, title, status
  )
  values(
    actor, safe_mode, p_post_id, p_opponent_user_id, null, safe_title, 'OPEN'
  )
  returning id into new_id;

  return new_id;
end;
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

  select count(*)::integer into result_count
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id
    and r.verified = true;

  if challenge.opponent_user_id is not null
     and challenge.mode in ('duel','prove_it','hard_mode','king_of_the_hill')
     and result_count < 2 then
    raise exception 'Both competitors must submit before finalization';
  end if;

  if challenge.mode = 'hard_mode' and coalesce(challenge.respect_score, 0) < 1 then
    raise exception 'Hard Mode needs at least one outside Respect vote before finalization';
  end if;

  select coalesce(max(r.respect_received), 0)::integer into top_score
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id
    and r.verified = true;

  if top_score > 0 then
    select count(*)::integer into top_count
    from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id
      and r.verified = true
      and r.respect_received = top_score;

    if top_count = 1 then
      select r.submitted_by into computed_winner
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

  if challenge.mode = 'king_of_the_hill'
     and challenge.arena_category is not null
     and computed_winner is not null then
    insert into public.igpat_arena_hill_titles(category_key, champion_user_id, challenge_id, updated_at)
    values(challenge.arena_category, computed_winner, p_challenge_id, now())
    on conflict(category_key) do update
      set champion_user_id = excluded.champion_user_id,
          challenge_id = excluded.challenge_id,
          updated_at = now();
  end if;

  return computed_winner;
end;
$$;

revoke all on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) from public;
revoke all on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) from anon;
grant execute on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) to authenticated;
grant execute on function public.igpat_create_arena_challenge_v2(text,uuid,uuid,text) to service_role;

revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from public;
revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from anon;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to service_role;
