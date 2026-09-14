-- BUKLOD IGPAT R41
-- Bounty Challenge supports symbolic badge/title recognition only.
-- No money, paid wagering, random rewards or financial mechanics.

create table if not exists public.igpat_arena_bounties (
  challenge_id uuid primary key references public.igpat_arena_challenges(id) on delete cascade,
  reward_kind text not null check (reward_kind in ('badge','title')),
  reward_label text not null check (char_length(trim(reward_label)) between 2 and 80),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.igpat_arena_bounties enable row level security;
revoke all on table public.igpat_arena_bounties from public;
revoke all on table public.igpat_arena_bounties from anon;
revoke all on table public.igpat_arena_bounties from authenticated;
grant all on table public.igpat_arena_bounties to service_role;

create or replace function public.admin_create_igpat_bounty_v1(
  p_title text,
  p_reward_kind text,
  p_reward_label text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_title text := trim(coalesce(p_title, ''));
  safe_kind text := lower(trim(coalesce(p_reward_kind, '')));
  safe_label text := trim(coalesce(p_reward_label, ''));
  challenge_id uuid;
  active_count integer := 0;
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if char_length(safe_title) < 3 or char_length(safe_title) > 160 then
    raise exception 'Bounty title must be 3 to 160 characters';
  end if;

  if safe_kind not in ('badge','title') then
    raise exception 'Bounty reward must be a symbolic badge or title';
  end if;

  if char_length(safe_label) < 2 or char_length(safe_label) > 80 then
    raise exception 'Bounty reward label must be 2 to 80 characters';
  end if;

  select count(*)::integer into active_count
  from public.igpat_arena_challenges c
  where c.mode = 'bounty_challenge'
    and c.status in ('OPEN','ACCEPTED','ACTIVE');

  if active_count >= 3 then
    raise exception 'At most 3 Arena bounties may be active at once';
  end if;

  insert into public.igpat_arena_challenges(
    creator_user_id, mode, post_id, opponent_user_id, squad_id, title, status
  )
  values(actor, 'bounty_challenge', null, null, null, safe_title, 'OPEN')
  returning id into challenge_id;

  insert into public.igpat_arena_bounties(challenge_id, reward_kind, reward_label, created_by)
  values(challenge_id, safe_kind, safe_label, actor);

  return challenge_id;
end;
$$;

create or replace function public.get_buklod_igpat_bounties_v1(
  p_limit integer default 30
)
returns table(
  challenge_id uuid,
  title text,
  status text,
  reward_kind text,
  reward_label text,
  winner_user_id uuid,
  winner_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
begin
  if actor is null then raise exception 'Authentication required'; end if;

  return query
  select
    c.id,
    c.title,
    c.status,
    b.reward_kind,
    b.reward_label,
    c.winner_user_id,
    case when c.winner_user_id is null then null else coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text end,
    c.created_at
  from public.igpat_arena_challenges c
  join public.igpat_arena_bounties b on b.challenge_id = c.id
  left join public.profiles p on p.id = c.winner_user_id
  where public.can_view_igpat_arena_challenge_v2(c.id)
     or (c.status = 'OPEN' and c.opponent_user_id is null)
  order by case when c.status in ('OPEN','ACCEPTED','ACTIVE') then 0 else 1 end,
           c.created_at desc
  limit safe_limit;
end;
$$;

create or replace function public.get_my_buklod_igpat_bounty_rewards_v1()
returns table(
  challenge_id uuid,
  reward_kind text,
  reward_label text,
  challenge_title text,
  earned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'Authentication required'; end if;

  return query
  select
    c.id,
    b.reward_kind,
    b.reward_label,
    c.title,
    c.completed_at
  from public.igpat_arena_challenges c
  join public.igpat_arena_bounties b on b.challenge_id = c.id
  where c.status = 'COMPLETED'
    and c.winner_user_id = actor
  order by c.completed_at desc, c.id desc;
end;
$$;

-- Bounty challenges require actual content and two accepted competitors before result.
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
  if actor is null then raise exception 'Authentication required'; end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and (c.creator_user_id = actor or c.opponent_user_id = actor)
    and c.status in ('ACCEPTED','ACTIVE')
  for update;

  if challenge.id is null then raise exception 'You are not an active Arena participant'; end if;

  if challenge.mode in ('duel','prove_it','hard_mode','king_of_the_hill','bounty_challenge')
     and p_post_id is null then
    raise exception 'This Arena mode requires an actual IGPAT submission';
  end if;

  if p_post_id is not null and not exists (
    select 1 from public.community_posts cp
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
    select 1 from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id
      and r.submitted_by <> actor
      and r.post_id = p_post_id
  ) then
    raise exception 'Each Arena participant must submit their own IGPAT';
  end if;

  insert into public.igpat_arena_results(challenge_id, submitted_by, post_id, completion_note, verified, respect_received)
  values(p_challenge_id, actor, p_post_id, left(trim(coalesce(p_completion_note, '')), 800), true, 0)
  on conflict(challenge_id, submitted_by) do update
    set post_id = excluded.post_id,
        completion_note = excluded.completion_note,
        verified = true
  returning id into new_id;

  update public.igpat_arena_challenges
  set status = 'ACTIVE'
  where id = p_challenge_id and status = 'ACCEPTED';

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
  if actor is null then raise exception 'Authentication required'; end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'ACTIVE'
    and (c.creator_user_id = actor or c.opponent_user_id = actor)
  for update;

  if challenge.id is null then raise exception 'Only an active Arena participant can finalize this challenge'; end if;

  select count(*)::integer into result_count
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id and r.verified = true;

  if challenge.opponent_user_id is not null
     and challenge.mode in ('duel','prove_it','hard_mode','king_of_the_hill','bounty_challenge')
     and result_count < 2 then
    raise exception 'Both competitors must submit before finalization';
  end if;

  if challenge.mode = 'hard_mode' and coalesce(challenge.respect_score, 0) < 1 then
    raise exception 'Hard Mode needs at least one outside Respect vote before finalization';
  end if;

  select coalesce(max(r.respect_received), 0)::integer into top_score
  from public.igpat_arena_results r
  where r.challenge_id = p_challenge_id and r.verified = true;

  if top_score > 0 then
    select count(*)::integer into top_count
    from public.igpat_arena_results r
    where r.challenge_id = p_challenge_id and r.verified = true and r.respect_received = top_score;

    if top_count = 1 then
      select r.submitted_by into computed_winner
      from public.igpat_arena_results r
      where r.challenge_id = p_challenge_id and r.verified = true and r.respect_received = top_score
      limit 1;
    end if;
  end if;

  update public.igpat_arena_challenges
  set status = 'COMPLETED', winner_user_id = computed_winner, completed_at = now()
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

revoke all on function public.admin_create_igpat_bounty_v1(text,text,text) from public;
revoke all on function public.admin_create_igpat_bounty_v1(text,text,text) from anon;
grant execute on function public.admin_create_igpat_bounty_v1(text,text,text) to authenticated;
grant execute on function public.admin_create_igpat_bounty_v1(text,text,text) to service_role;

revoke all on function public.get_buklod_igpat_bounties_v1(integer) from public;
revoke all on function public.get_buklod_igpat_bounties_v1(integer) from anon;
grant execute on function public.get_buklod_igpat_bounties_v1(integer) to authenticated;
grant execute on function public.get_buklod_igpat_bounties_v1(integer) to service_role;

revoke all on function public.get_my_buklod_igpat_bounty_rewards_v1() from public;
revoke all on function public.get_my_buklod_igpat_bounty_rewards_v1() from anon;
grant execute on function public.get_my_buklod_igpat_bounty_rewards_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_bounty_rewards_v1() to service_role;

revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from public;
revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from anon;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to authenticated;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to service_role;

revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from public;
revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from anon;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to service_role;
