-- BUKLOD Show Faith ABC Points v1
-- All-access ABC study; +5 BUKLOD Points once per rewardable lesson.
-- Points enter the existing Ready-to-Claim flow through buklod_points_ledger.

insert into public.buklod_point_rules (
  activity_type,
  label,
  base_points,
  max_points_per_event,
  daily_cap_points,
  weekly_cap_points,
  is_active,
  notes,
  updated_by,
  updated_at
)
values (
  'abc_growth_lesson',
  'ABC Christian Growth Lesson',
  5,
  5,
  null,
  null,
  true,
  'Self-guided Show Faith ABC lesson completion. One reward per lesson through canonical source keys.',
  null,
  now()
)
on conflict (activity_type) do nothing;

create table if not exists public.buklod_abc_growth_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz not null default now(),
  point_ledger_id uuid references public.buklod_points_ledger(id) on delete set null,
  source_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  unique (user_id, source_key),
  constraint buklod_abc_growth_progress_lesson_check check (
    lesson_id = any (array[
      'prelim-01'::text,
      'prelim-02'::text,
      'lesson-01'::text,
      'lesson-02'::text,
      'lesson-03'::text,
      'lesson-04'::text,
      'lesson-05'::text,
      'lesson-06'::text,
      'lesson-07'::text,
      'lesson-08'::text,
      'lesson-09'::text,
      'lesson-10'::text,
      'lesson-11'::text,
      'lesson-12'::text,
      'lesson-13'::text,
      'lesson-14'::text,
      'lesson-15'::text,
      'lesson-16'::text,
      'lesson-17'::text,
      'lesson-18'::text,
      'lesson-19'::text,
      'lesson-20'::text,
      'lesson-21'::text,
      'lesson-22'::text,
      'lesson-23'::text,
      'lesson-24'::text,
      'lesson-25'::text,
      'lesson-26'::text
    ])
  )
);

create index if not exists idx_buklod_abc_growth_progress_user_completed
on public.buklod_abc_growth_progress (user_id, completed_at desc);

alter table public.buklod_abc_growth_progress enable row level security;

revoke all on table public.buklod_abc_growth_progress from public;
revoke all on table public.buklod_abc_growth_progress from anon;
revoke all on table public.buklod_abc_growth_progress from authenticated;
grant select on table public.buklod_abc_growth_progress to authenticated;

drop policy if exists "Users can read own ABC growth progress"
on public.buklod_abc_growth_progress;

create policy "Users can read own ABC growth progress"
on public.buklod_abc_growth_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.complete_my_abc_growth_lesson_v1(
  p_lesson_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  normalized_lesson text := lower(trim(coalesce(p_lesson_id, '')));
  canonical_source_key text;
  ledger_id uuid;
  current_claim_state text;
  completed_when timestamptz;
  was_already_completed boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if normalized_lesson <> all (array[
      'prelim-01'::text,
      'prelim-02'::text,
      'lesson-01'::text,
      'lesson-02'::text,
      'lesson-03'::text,
      'lesson-04'::text,
      'lesson-05'::text,
      'lesson-06'::text,
      'lesson-07'::text,
      'lesson-08'::text,
      'lesson-09'::text,
      'lesson-10'::text,
      'lesson-11'::text,
      'lesson-12'::text,
      'lesson-13'::text,
      'lesson-14'::text,
      'lesson-15'::text,
      'lesson-16'::text,
      'lesson-17'::text,
      'lesson-18'::text,
      'lesson-19'::text,
      'lesson-20'::text,
      'lesson-21'::text,
      'lesson-22'::text,
      'lesson-23'::text,
      'lesson-24'::text,
      'lesson-25'::text,
      'lesson-26'::text
    ]) then
    raise exception 'This ABC item is not rewardable';
  end if;

  canonical_source_key := 'abc_growth:v1:' || normalized_lesson;

  select
    p.point_ledger_id,
    p.completed_at
  into
    ledger_id,
    completed_when
  from public.buklod_abc_growth_progress p
  where p.user_id = actor
    and p.lesson_id = normalized_lesson;

  if found then
    was_already_completed := true;
  else
    insert into public.buklod_points_ledger (
      user_id,
      direction,
      points,
      activity_type,
      source_key,
      source_id,
      description,
      awarded_by
    )
    values (
      actor,
      'credit',
      5,
      'abc_growth_lesson',
      canonical_source_key,
      null,
      'ABC''s ng Paglagong Kristyano lesson completed: ' || normalized_lesson,
      actor
    )
    on conflict (user_id, source_key) do nothing
    returning id into ledger_id;

    if ledger_id is null then
      select l.id
      into ledger_id
      from public.buklod_points_ledger l
      where l.user_id = actor
        and l.source_key = canonical_source_key
      limit 1;
    end if;

    if ledger_id is null then
      raise exception 'Could not create or locate the ABC points reward';
    end if;

    insert into public.buklod_abc_growth_progress (
      user_id,
      lesson_id,
      completed_at,
      point_ledger_id,
      source_key
    )
    values (
      actor,
      normalized_lesson,
      now(),
      ledger_id,
      canonical_source_key
    )
    on conflict (user_id, lesson_id) do update
    set point_ledger_id = coalesce(
      public.buklod_abc_growth_progress.point_ledger_id,
      excluded.point_ledger_id
    )
    returning completed_at into completed_when;
  end if;

  if ledger_id is null then
    select l.id
    into ledger_id
    from public.buklod_points_ledger l
    where l.user_id = actor
      and l.source_key = canonical_source_key
    limit 1;
  end if;

  select l.claim_state
  into current_claim_state
  from public.buklod_points_ledger l
  where l.id = ledger_id
    and l.user_id = actor;

  return jsonb_build_object(
    'lesson_id', normalized_lesson,
    'completed', true,
    'already_completed', was_already_completed,
    'points', 5,
    'claim_state', coalesce(current_claim_state, 'legacy'),
    'point_ledger_id', ledger_id,
    'completed_at', completed_when
  );
end;
$$;

revoke all on function public.complete_my_abc_growth_lesson_v1(text) from public;
revoke all on function public.complete_my_abc_growth_lesson_v1(text) from anon;
grant execute on function public.complete_my_abc_growth_lesson_v1(text) to authenticated;

create or replace function public.get_my_abc_growth_progress_v1()
returns table (
  lesson_id text,
  completed_at timestamptz,
  points integer,
  claim_state text,
  point_ledger_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.lesson_id,
    p.completed_at,
    coalesce(l.points, 5)::integer as points,
    coalesce(l.claim_state, 'legacy')::text as claim_state,
    p.point_ledger_id
  from public.buklod_abc_growth_progress p
  left join public.buklod_points_ledger l
    on l.id = p.point_ledger_id
   and l.user_id = p.user_id
  where p.user_id = (select auth.uid())
  order by p.completed_at asc;
$$;

revoke all on function public.get_my_abc_growth_progress_v1() from public;
revoke all on function public.get_my_abc_growth_progress_v1() from anon;
grant execute on function public.get_my_abc_growth_progress_v1() to authenticated;

comment on table public.buklod_abc_growth_progress is
  'Server-side completion registry for the all-access Show Faith ABC Christian Growth lessons. Answers remain local; only completion and reward linkage are stored.';

comment on function public.complete_my_abc_growth_lesson_v1(text) is
  'Completes one allowlisted ABC lesson for the signed-in user and creates exactly one +5 BUKLOD Points pending reward via the existing ledger/claim system.';
