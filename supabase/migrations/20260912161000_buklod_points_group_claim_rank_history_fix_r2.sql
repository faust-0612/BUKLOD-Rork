-- BUKLOD Points grouped claim rank-history repair R2
-- Fixes grouped claims that cross a Circle Rank threshold.
-- buklod_rank_history intentionally permits only baseline/ledger_crossing sources,
-- so grouped claims must record the rank crossing using the canonical ledger source.

create or replace function public.claim_my_buklod_reward_group_v1(p_group_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
    'formation', 'mentoring', 'attendance', 'bonus', 'other'
  ) then
    raise exception 'Unknown reward group';
  end if;

  -- Serialize all point-claim paths for this member.
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
      (clean_group = 'posting' and l.activity_type in ('community_post', 'r36_publish_wall'))
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
$$;

revoke execute on function public.claim_my_buklod_reward_group_v1(text) from public, anon;
grant execute on function public.claim_my_buklod_reward_group_v1(text) to authenticated;
