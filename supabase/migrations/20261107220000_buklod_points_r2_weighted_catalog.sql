-- BUKLOD points R2: additive configuration; does not issue any points by itself.
-- Historical credits and claim records are never rewritten.
-- New activity families intentionally disabled pending authoritative completion validators.
insert into public.buklod_point_rules (activity_type,label,base_points,max_points_per_event,is_active,notes,updated_at)
values
('community_reaction', 'community reaction', 1, 1, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('community_comment', 'community comment', 2, 2, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('community_post', 'community post', 5, 5, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('daily_bible_reading', 'daily bible reading', 10, 10, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('daily_devotional_reflection', 'daily devotional reflection', 12, 12, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('bible_quiz_easy', 'bible quiz easy', 3, 3, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('bible_quiz_medium', 'bible quiz medium', 6, 6, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('bible_quiz_hard', 'bible quiz hard', 12, 12, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('formation_assessment', 'formation assessment', 25, 25, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('formation_module', 'formation module', 75, 75, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('verified_cluster_attendance', 'verified church attendance', 10, 10, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('verified_volunteer_service', 'verified volunteer service', 20, 20, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('verified_mentoring_session', 'verified mentoring session', 15, 15, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('bible_weekly_streak', 'bible weekly streak', 20, 20, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('consistency_30_day', 'consistency 30 day', 50, 50, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('ministry_major_milestone', 'ministry major milestone', 100, 100, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('kl_episode', 'kl episode', 5, 5, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('kl_season', 'kl season', 30, 30, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_first_qualified', 'game first qualified', 2, 2, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_medium_win', 'game medium win', 5, 5, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_hard_win', 'game hard win', 10, 10, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_advanced_perfect', 'game advanced perfect', 20, 20, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_puzzle_series', 'game puzzle series', 25, 25, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_expert_campaign', 'game expert campaign', 50, 50, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('game_tournament_champion', 'game tournament champion', 100, 100, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('achievement_bible_scholar', 'achievement bible scholar', 100, 100, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('achievement_community_builder', 'achievement community builder', 150, 150, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('achievement_faithful_mentor', 'achievement faithful mentor', 200, 200, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls'),
('achievement_kingdom_champion', 'achievement kingdom champion', 250, 250, false, 'R2 proposal: activate only after verified server-side qualification, scope and abuse controls')
on conflict (activity_type) do nothing;

-- Existing approved meaningful comments earn +2 BP on future verified actions.
-- Do not rewrite historical credits, completed activities, or claim balances.
update public.buklod_point_rules
set base_points=2, max_points_per_event=2,
    notes='Approved R2 meaningful comment +2 BP for future verified activity; historical credits preserved',
    updated_at=now()
where activity_type='community_comment';

-- ABC already has validated, unique lesson completion source keys. New awards use R2 amount.
-- Preserve historical ledger rows and the original source-key namespace.
update public.buklod_point_rules set base_points=8,max_points_per_event=8,
 notes='R2 validated ABC lesson; configurable reward, unique per lesson, no retroactive balance changes',updated_at=now()
where activity_type='abc_growth_lesson';

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
  reward_points integer;
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

  select greatest(0, least(100,r.base_points,coalesce(r.max_points_per_event,100)))::integer into reward_points
  from public.buklod_point_rules r
  where r.activity_type = 'abc_growth_lesson' and r.is_active = true;

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
    if reward_points is null or reward_points <= 0 then
      raise exception 'ABC reward configuration unavailable';
    end if;
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
      reward_points,
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
    'points', coalesce((select l.points from public.buklod_points_ledger l where l.id = ledger_id and l.user_id = actor), reward_points, 5),
    'claim_state', coalesce(current_claim_state, 'legacy'),
    'point_ledger_id', ledger_id,
    'completed_at', completed_when
  );
end;
$$;


comment on function public.complete_my_abc_growth_lesson_v1(text) is
 'R2 uses authoritative active rule for future ABC awards; existing completions and credits remain unchanged.';
