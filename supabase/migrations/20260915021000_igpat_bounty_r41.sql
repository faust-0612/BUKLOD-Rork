-- BUKLOD IGPAT R41
-- Bounty is symbolic recognition attached to an existing legitimate Arena challenge.
-- The sponsor/admin never becomes a fake competitor. No money, paid wagering,
-- random rewards or financial mechanics are supported.

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

create or replace function public.admin_attach_igpat_bounty_v1(
  p_challenge_id uuid,
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
  safe_kind text := lower(trim(coalesce(p_reward_kind, '')));
  safe_label text := trim(coalesce(p_reward_label, ''));
  challenge public.igpat_arena_challenges%rowtype;
  active_count integer := 0;
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if safe_kind not in ('badge','title') then
    raise exception 'Bounty reward must be a symbolic badge or title';
  end if;

  if char_length(safe_label) < 2 or char_length(safe_label) > 80 then
    raise exception 'Bounty reward label must be 2 to 80 characters';
  end if;

  select * into challenge
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status in ('OPEN','ACCEPTED','ACTIVE');

  if challenge.id is null then
    raise exception 'Bounty can be attached only to an active Arena challenge';
  end if;

  if challenge.mode not in ('duel','prove_it','hard_mode','king_of_the_hill') then
    raise exception 'This Arena mode is not approved for Bounty recognition';
  end if;

  select count(*)::integer into active_count
  from public.igpat_arena_bounties b
  join public.igpat_arena_challenges c on c.id = b.challenge_id
  where c.status in ('OPEN','ACCEPTED','ACTIVE');

  if active_count >= 3 and not exists (
    select 1 from public.igpat_arena_bounties b where b.challenge_id = p_challenge_id
  ) then
    raise exception 'At most 3 Arena bounties may be active at once';
  end if;

  insert into public.igpat_arena_bounties(challenge_id, reward_kind, reward_label, created_by)
  values(p_challenge_id, safe_kind, safe_label, actor)
  on conflict(challenge_id) do update
    set reward_kind = excluded.reward_kind,
        reward_label = excluded.reward_label,
        created_by = actor,
        created_at = now();

  return p_challenge_id;
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
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    c.id,
    c.title,
    c.status,
    b.reward_kind,
    b.reward_label,
    c.winner_user_id,
    case when c.winner_user_id is null then null
      else coalesce(p.full_name, p.first_name, p.username, 'BUKLOD Member')::text end,
    c.created_at
  from public.igpat_arena_challenges c
  join public.igpat_arena_bounties b on b.challenge_id = c.id
  left join public.profiles p on p.id = c.winner_user_id
  where public.can_view_igpat_arena_challenge_v2(c.id)
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
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

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

revoke all on function public.admin_attach_igpat_bounty_v1(uuid,text,text) from public;
revoke all on function public.admin_attach_igpat_bounty_v1(uuid,text,text) from anon;
grant execute on function public.admin_attach_igpat_bounty_v1(uuid,text,text) to authenticated;
grant execute on function public.admin_attach_igpat_bounty_v1(uuid,text,text) to service_role;

revoke all on function public.get_buklod_igpat_bounties_v1(integer) from public;
revoke all on function public.get_buklod_igpat_bounties_v1(integer) from anon;
grant execute on function public.get_buklod_igpat_bounties_v1(integer) to authenticated;
grant execute on function public.get_buklod_igpat_bounties_v1(integer) to service_role;

revoke all on function public.get_my_buklod_igpat_bounty_rewards_v1() from public;
revoke all on function public.get_my_buklod_igpat_bounty_rewards_v1() from anon;
grant execute on function public.get_my_buklod_igpat_bounty_rewards_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_bounty_rewards_v1() to service_role;
