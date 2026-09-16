-- BUKLOD IGPAT R33
-- King of the Hill uses fixed/approved categories and verified Arena submissions.

alter table public.igpat_arena_challenges
  add column if not exists arena_category text;

create table if not exists public.igpat_arena_categories (
  key text primary key,
  label text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.igpat_arena_categories(key, label, enabled, sort_order)
values
  ('sports', 'Sports', true, 10),
  ('preaching', 'Preaching', true, 20),
  ('singing', 'Singing', true, 30),
  ('teaching', 'Teaching', true, 40),
  ('creativity', 'Creativity', true, 50)
on conflict(key) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

create table if not exists public.igpat_arena_hill_titles (
  category_key text primary key references public.igpat_arena_categories(key) on delete cascade,
  champion_user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id uuid references public.igpat_arena_challenges(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.igpat_arena_categories enable row level security;
alter table public.igpat_arena_hill_titles enable row level security;
revoke all on table public.igpat_arena_categories from public;
revoke all on table public.igpat_arena_categories from anon;
revoke all on table public.igpat_arena_categories from authenticated;
revoke all on table public.igpat_arena_hill_titles from public;
revoke all on table public.igpat_arena_hill_titles from anon;
revoke all on table public.igpat_arena_hill_titles from authenticated;
grant all on table public.igpat_arena_categories to service_role;
grant all on table public.igpat_arena_hill_titles to service_role;

create or replace function public.get_buklod_igpat_hills_v1()
returns table(
  category_key text,
  category_label text,
  champion_user_id uuid,
  champion_name text,
  title_challenge_id uuid,
  active_challenge_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    cat.key,
    cat.label,
    hill.champion_user_id,
    case when hill.champion_user_id is null then null
      else coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text end,
    hill.challenge_id,
    (
      select c.id
      from public.igpat_arena_challenges c
      where c.mode = 'king_of_the_hill'
        and c.arena_category = cat.key
        and c.status in ('OPEN','ACCEPTED','ACTIVE')
      order by c.created_at desc
      limit 1
    )
  from public.igpat_arena_categories cat
  left join public.igpat_arena_hill_titles hill on hill.category_key = cat.key
  left join public.profiles p on p.id = hill.champion_user_id
  where cat.enabled = true
  order by cat.sort_order asc, cat.key asc;
end;
$$;

create or replace function public.igpat_challenge_hill_v1(
  p_category_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_key text := lower(trim(coalesce(p_category_key, '')));
  category_label text;
  champion_id uuid;
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select cat.label into category_label
  from public.igpat_arena_categories cat
  where cat.key = safe_key
    and cat.enabled = true;

  if category_label is null then
    raise exception 'King of the Hill category is not approved';
  end if;

  select hill.champion_user_id into champion_id
  from public.igpat_arena_hill_titles hill
  where hill.category_key = safe_key;

  if champion_id = actor then
    raise exception 'You already hold this Hill title';
  end if;

  if exists (
    select 1
    from public.igpat_arena_challenges c
    where c.mode = 'king_of_the_hill'
      and c.arena_category = safe_key
      and c.status in ('OPEN','ACCEPTED','ACTIVE')
  ) then
    raise exception 'This Hill already has an active challenge';
  end if;

  insert into public.igpat_arena_challenges(
    creator_user_id,
    mode,
    post_id,
    opponent_user_id,
    squad_id,
    title,
    status,
    arena_category
  )
  values(
    actor,
    'king_of_the_hill',
    null,
    champion_id,
    null,
    left(concat('KING OF THE HILL · ', category_label), 160),
    'OPEN',
    safe_key
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- Strengthen result submission for the modes currently exposed by the client.
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

  if challenge.mode in ('duel','prove_it','hard_mode','king_of_the_hill')
     and p_post_id is null then
    raise exception 'This Arena mode requires an actual IGPAT submission';
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

-- Replaces R28 completion to crown a verified Hill winner when applicable.
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

  if challenge.mode in ('duel','king_of_the_hill') and result_count < 2 then
    raise exception 'Both competitors must submit before finalization';
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
    insert into public.igpat_arena_hill_titles(
      category_key,
      champion_user_id,
      challenge_id,
      updated_at
    )
    values(
      challenge.arena_category,
      computed_winner,
      p_challenge_id,
      now()
    )
    on conflict(category_key) do update
      set champion_user_id = excluded.champion_user_id,
          challenge_id = excluded.challenge_id,
          updated_at = now();
  end if;

  return computed_winner;
end;
$$;

revoke all on function public.get_buklod_igpat_hills_v1() from public;
revoke all on function public.get_buklod_igpat_hills_v1() from anon;
grant execute on function public.get_buklod_igpat_hills_v1() to authenticated;
grant execute on function public.get_buklod_igpat_hills_v1() to service_role;

revoke all on function public.igpat_challenge_hill_v1(text) from public;
revoke all on function public.igpat_challenge_hill_v1(text) from anon;
grant execute on function public.igpat_challenge_hill_v1(text) to authenticated;
grant execute on function public.igpat_challenge_hill_v1(text) to service_role;

revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from public;
revoke all on function public.igpat_submit_arena_result_v1(uuid,uuid,text) from anon;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to authenticated;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to service_role;

revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from public;
revoke all on function public.igpat_complete_arena_challenge_v2(uuid) from anon;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v2(uuid) to service_role;
