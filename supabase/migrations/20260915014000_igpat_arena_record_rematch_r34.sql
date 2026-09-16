-- BUKLOD IGPAT R32 + R34
-- Structured W/L record is private to the signed-in user.
-- Rival Rematch is allowed once only; rematches cannot spawn another rematch.

alter table public.igpat_arena_challenges
  add column if not exists rematch_of uuid references public.igpat_arena_challenges(id) on delete set null;

create unique index if not exists igpat_arena_one_rematch_per_challenge_idx
  on public.igpat_arena_challenges(rematch_of)
  where rematch_of is not null;

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
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select * into src
  from public.igpat_arena_challenges c
  where c.id = p_challenge_id
    and c.status = 'COMPLETED'
  for update;

  if src.id is null
     or (src.creator_user_id <> actor and src.opponent_user_id is distinct from actor) then
    raise exception 'Rematch unavailable';
  end if;

  if src.rematch_of is not null then
    raise exception 'Only one Rival Rematch is allowed';
  end if;

  if exists (
    select 1
    from public.igpat_arena_challenges child
    where child.rematch_of = src.id
  ) then
    raise exception 'A Rival Rematch already exists for this challenge';
  end if;

  other_user := case
    when src.creator_user_id = actor then src.opponent_user_id
    else src.creator_user_id
  end;

  if other_user is null then
    raise exception 'Rematch needs the previous opponent';
  end if;

  new_id := public.igpat_create_arena_challenge_v2(
    src.mode,
    null,
    other_user,
    left(concat('REMATCH · ', coalesce(nullif(src.title, ''), src.mode)), 160)
  );

  update public.igpat_arena_challenges
  set rematch_of = src.id
  where id = new_id;

  return new_id;
end;
$$;

create or replace function public.get_my_buklod_igpat_arena_record_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_data record;
  wins integer := 0;
  losses integer := 0;
  draws integer := 0;
  current_streak integer := 0;
  best_streak integer := 0;
  running_streak integer := 0;
  current_open boolean := true;
  total integer := 0;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  for row_data in
    select
      c.completed_at,
      case
        when c.winner_user_id = actor then 'W'
        when c.winner_user_id is null then 'D'
        else 'L'
      end as outcome
    from public.igpat_arena_challenges c
    where c.status = 'COMPLETED'
      and (c.creator_user_id = actor or c.opponent_user_id = actor)
    order by c.completed_at desc nulls last, c.id desc
  loop
    total := total + 1;

    if row_data.outcome = 'W' then
      wins := wins + 1;
      running_streak := running_streak + 1;
      best_streak := greatest(best_streak, running_streak);
      if current_open then
        current_streak := current_streak + 1;
      end if;
    elsif row_data.outcome = 'L' then
      losses := losses + 1;
      running_streak := 0;
      current_open := false;
    else
      draws := draws + 1;
      running_streak := 0;
      current_open := false;
    end if;
  end loop;

  return jsonb_build_object(
    'wins', wins,
    'losses', losses,
    'draws', draws,
    'completed', total,
    'win_rate', case when wins + losses = 0 then 0 else round((wins::numeric * 100) / (wins + losses), 1) end,
    'current_win_streak', current_streak,
    'best_win_streak', best_streak
  );
end;
$$;

revoke all on function public.igpat_rematch_arena_challenge_v1(uuid) from public;
revoke all on function public.igpat_rematch_arena_challenge_v1(uuid) from anon;
grant execute on function public.igpat_rematch_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_rematch_arena_challenge_v1(uuid) to service_role;

revoke all on function public.get_my_buklod_igpat_arena_record_v1() from public;
revoke all on function public.get_my_buklod_igpat_arena_record_v1() from anon;
grant execute on function public.get_my_buklod_igpat_arena_record_v1() to authenticated;
grant execute on function public.get_my_buklod_igpat_arena_record_v1() to service_role;
