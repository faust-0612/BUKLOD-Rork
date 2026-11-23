-- BUKLOD grouped BP claims: category-specific atomic claims, preserving
-- rank history and server source ledger. Generated from the verified current
-- MAIN function definitions on 2026-11-24; no cash or QMP effect.
-- Newer app MUST ship before disabling old-version Claim All RPC.
CREATE OR REPLACE FUNCTION public.get_my_buklod_claim_groups_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  result jsonb;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  with pending as (
    select
      case
        when l.activity_type in ('todays_best_story','todays_best_comment','todays_best_reaction','todays_best_streak') then 'todays_best'
        when l.activity_type='connect_message' then 'connect'
        when l.activity_type in ('child_story_complete','child_teaching_session') then 'children'
        when l.activity_type='personal_bible_reflection' then 'bible_personal'
        when l.activity_type='bayanihan_verified_action' then 'bayanihan'
        when l.activity_type in ('community_post', 'r36_publish_wall') then 'posting'
        when l.activity_type in (
          'community_comment', 'community_reaction', 'prayer_response',
          'r36_engager_comment', 'r36_engager_reaction', 'r36_engager_reply'
        ) then 'engagement'
        when l.activity_type in ('daily_bible', 'daily_bible_verification') then 'daily_bible'
        when l.activity_type = 'devotional' then 'devotional'
        when l.activity_type in (
          'abc_growth_lesson', 'formation_lesson', 'learning_progress_verification', 'stage_completion'
        ) then 'formation'
        when l.activity_type in ('mentor_session', 'mentoring_release') then 'mentoring'
        when l.activity_type in ('event_attendance', 'scope_attendance', 'ministry_activity') then 'attendance'
        when l.activity_type in (
          'reflection_quality_bonus', 'weekly_consistency', 'verified_giving_participation', 'admin_bonus'
        ) then 'bonus'
        else 'other'
      end as group_key,
      l.points
    from public.buklod_points_ledger l
    where l.user_id = uid
      and l.direction = 'credit'
      and l.claim_state = 'pending'
  ), grouped as (
    select
      p.group_key,
      case p.group_key
        when 'todays_best' then 'Today''s Best'
        when 'connect' then 'Connect'
        when 'children' then 'Children''s Learning'
        when 'bible_personal' then 'Personal Bible Reading'
        when 'bayanihan' then 'Bayanihan'
        when 'posting' then 'Posting'
        when 'engagement' then 'Comments & Reactions'
        when 'daily_bible' then 'Bible Reading'
        when 'devotional' then 'Devotional'
        when 'formation' then 'Formation & Learning'
        when 'mentoring' then 'Mentoring'
        when 'attendance' then 'Attendance & Ministry'
        when 'bonus' then 'Bonuses'
        else 'Other'
      end as group_label,
      count(*)::integer as event_count,
      coalesce(sum(p.points), 0)::bigint as total_points,
      case p.group_key
        when 'todays_best' then 5
        when 'connect' then 15
        when 'children' then 25
        when 'bible_personal' then 35
        when 'bayanihan' then 65
        when 'posting' then 10
        when 'engagement' then 20
        when 'daily_bible' then 30
        when 'devotional' then 40
        when 'formation' then 50
        when 'mentoring' then 60
        when 'attendance' then 70
        when 'bonus' then 80
        else 90
      end as sort_order
    from pending p
    group by p.group_key
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'group_key', g.group_key,
        'group_label', g.group_label,
        'event_count', g.event_count,
        'total_points', g.total_points
      )
      order by g.sort_order, g.group_label
    ),
    '[]'::jsonb
  )
  into result
  from grouped g;

  return result;
end;
$function$


CREATE OR REPLACE FUNCTION public.claim_my_buklod_reward_group_v1(p_group_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  clean_group text := lower(trim(coalesce(p_group_key, '')));
  ledger_ids uuid[];
  claimed_count integer := 0;
  claimed_points bigint := 0;
  old_lifetime bigint := 0;
  new_lifetime bigint := 0;
  new_available bigint := 0;
  remaining_count bigint := 0;
  old_rank record;
  new_rank record;
  rank_changed boolean := false;
  trigger_ledger uuid;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if clean_group not in (
    'posting', 'engagement', 'daily_bible', 'devotional',
    'formation', 'mentoring', 'attendance', 'bonus', 'other',
    'todays_best', 'connect', 'children', 'bible_personal', 'bayanihan'
  ) then
    raise exception 'Unknown reward group';
  end if;

  perform p.id
  from public.profiles p
  where p.id = uid
  for update;

  old_lifetime := public.buklod_lifetime_points_for(uid);

  select
    array_agg(l.id order by l.created_at, l.id),
    count(*)::integer,
    coalesce(sum(l.points), 0)::bigint
  into ledger_ids, claimed_count, claimed_points
  from public.buklod_points_ledger l
  where l.user_id = uid
    and l.direction = 'credit'
    and l.claim_state = 'pending'
    and (
      (clean_group = 'todays_best' and l.activity_type in ('todays_best_story','todays_best_comment','todays_best_reaction','todays_best_streak'))
      or (clean_group = 'connect' and l.activity_type = 'connect_message')
      or (clean_group = 'children' and l.activity_type in ('child_story_complete','child_teaching_session'))
      or (clean_group = 'bible_personal' and l.activity_type = 'personal_bible_reflection')
      or (clean_group = 'bayanihan' and l.activity_type = 'bayanihan_verified_action')
      or (clean_group = 'posting' and l.activity_type in ('community_post', 'r36_publish_wall'))
      or (clean_group = 'engagement' and l.activity_type in (
        'community_comment', 'community_reaction', 'prayer_response',
        'r36_engager_comment', 'r36_engager_reaction', 'r36_engager_reply'
      ))
      or (clean_group = 'daily_bible' and l.activity_type in ('daily_bible', 'daily_bible_verification'))
      or (clean_group = 'devotional' and l.activity_type = 'devotional')
      or (clean_group = 'formation' and l.activity_type in (
        'abc_growth_lesson', 'formation_lesson', 'learning_progress_verification', 'stage_completion'
      ))
      or (clean_group = 'mentoring' and l.activity_type in ('mentor_session', 'mentoring_release'))
      or (clean_group = 'attendance' and l.activity_type in ('event_attendance', 'scope_attendance', 'ministry_activity'))
      or (clean_group = 'bonus' and l.activity_type in (
        'reflection_quality_bonus', 'weekly_consistency', 'verified_giving_participation', 'admin_bonus'
      ))
      or (clean_group = 'other' and coalesce(l.activity_type, '') not in (
        'community_post', 'r36_publish_wall',
        'community_comment', 'community_reaction', 'prayer_response',
        'r36_engager_comment', 'r36_engager_reaction', 'r36_engager_reply',
        'daily_bible', 'daily_bible_verification', 'devotional',
        'abc_growth_lesson', 'formation_lesson', 'learning_progress_verification', 'stage_completion',
        'mentor_session', 'mentoring_release',
        'event_attendance', 'scope_attendance', 'ministry_activity',
        'todays_best_story', 'todays_best_comment', 'todays_best_reaction', 'todays_best_streak',
        'connect_message', 'child_story_complete', 'child_teaching_session',
        'personal_bible_reflection', 'bayanihan_verified_action',
        'reflection_quality_bonus', 'weekly_consistency', 'verified_giving_participation', 'admin_bonus'
      ))
    );

  if claimed_count = 0 or ledger_ids is null then
    return jsonb_build_object(
      'group_key', clean_group,
      'claimed_count', 0,
      'claimed_points', 0,
      'lifetime_points', public.buklod_lifetime_points_for(uid),
      'available_points', public.buklod_available_points_for(uid),
      'rank_up', false,
      'rank_name', null,
      'remaining_count', public.get_my_unclaimed_buklod_reward_count()
    );
  end if;

  trigger_ledger := ledger_ids[1];

  update public.buklod_points_ledger l
  set claim_state = 'claimed'
  where l.user_id = uid
    and l.id = any(ledger_ids)
    and l.direction = 'credit'
    and l.claim_state = 'pending';

  insert into public.buklod_user_points_balances(user_id, lifetime_points, available_points)
  values(uid, claimed_points, claimed_points)
  on conflict(user_id) do update
  set lifetime_points = public.buklod_user_points_balances.lifetime_points + excluded.lifetime_points,
      available_points = public.buklod_user_points_balances.available_points + excluded.available_points,
      updated_at = now();

  new_lifetime := public.buklod_lifetime_points_for(uid);
  new_available := public.buklod_available_points_for(uid);

  insert into public.buklod_rank_history(
    user_id, rank_order, rank_family, rank_level, rank_name, min_points,
    achieved_at, lifetime_points_at_achievement, trigger_ledger_id, achievement_source
  )
  select
    uid, r.rank_order, r.rank_family, r.rank_level, r.rank_name, r.min_points,
    now(), new_lifetime, trigger_ledger, 'ledger_crossing'
  from public.buklod_rank_levels r
  where r.is_active = true
    and r.min_points > old_lifetime
    and r.min_points <= new_lifetime
  order by r.rank_order
  on conflict(user_id, rank_order) do nothing;

  select * into old_rank from public.get_buklod_rank_for_points(old_lifetime);
  select * into new_rank from public.get_buklod_rank_for_points(new_lifetime);
  rank_changed := new_rank.rank_code is not null
    and new_rank.rank_code is distinct from old_rank.rank_code;

  if rank_changed then
    insert into public.buklod_reward_events(
      user_id, event_type, points, rank_code, rank_name,
      title, message, spoken_message, created_at, claimed_at
    ) values (
      uid, 'rank_up', null, new_rank.rank_code, new_rank.display_name,
      'BUKLOD Rank Up!', 'You reached ' || new_rank.display_name || '.',
      'Rank up! You are now ' || new_rank.display_name || '.', now(), now()
    );
  end if;

  update public.buklod_reward_events e
  set claimed_at = coalesce(e.claimed_at, now())
  where e.user_id = uid
    and e.claimed_at is null
    and e.source_point_id = any(ledger_ids);

  update public.buklod_reward_events e
  set claimed_at = coalesce(e.claimed_at, now())
  where e.user_id = uid
    and e.event_type = 'points'
    and e.claimed_at is null
    and exists (
      select 1
      from public.buklod_points_ledger l
      where l.id = e.source_point_id
        and l.user_id = uid
        and l.claim_state in ('claimed', 'legacy')
    );

  remaining_count := public.get_my_unclaimed_buklod_reward_count();

  return jsonb_build_object(
    'group_key', clean_group,
    'claimed_count', claimed_count,
    'claimed_points', claimed_points,
    'lifetime_points', new_lifetime,
    'available_points', new_available,
    'rank_up', rank_changed,
    'rank_name', case when rank_changed then new_rank.display_name else null end,
    'remaining_count', remaining_count
  );
end;
$function$

