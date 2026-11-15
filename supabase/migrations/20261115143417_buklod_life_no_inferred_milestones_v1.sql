-- BUKLOD LIFE: privacy gate for legacy clients. Deployed to BUKLOD Connect on 2026-11-15 as migration 20261115143417.
-- Legacy v1 RPCs previously inferred faith milestones from simple taps and
-- emitted inviter notifications. Those events can reveal sensitive choices
-- even when a recipient name is not attached.
-- New LIFE uses explicit, encrypted, per-user on-device checkpoints.
-- Isolated PostgreSQL 17 security regression passed before deployment.
-- Production Android app and OTA remain unchanged. No data rows were deleted.

create or replace function public.buklod_life_mark_my_stage_v1(p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  -- Backwards-compatible no-op. Older clients must not create spiritual
  -- milestones or notify inviters merely by navigating/choosing an option.
  return public.get_my_buklod_life_journey_v1();
end;
$$;

revoke all on function public.buklod_life_mark_my_stage_v1(text)
  from public, anon;
grant execute on function public.buklod_life_mark_my_stage_v1(text)
  to authenticated;

create or replace function public.get_my_buklod_life_impact_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_reached integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- Invitation counts only; third-party spirituality, prayer, exploration,
  -- and conversion-style signals are not available to inviters.
  select count(*)::integer into v_reached
  from public.buklod_referrals
  where referrer_id = v_uid;

  return jsonb_build_object(
    'people_reached', v_reached,
    'gospel_opened', 0,
    'faith_journeys_started', 0,
    'new_beginning', 0,
    'walking_with_you', 0,
    'growing_in_faith', 0,
    'recent_activity', '[]'::jsonb,
    'identity_private', true,
    'partial', true
  );
end;
$$;

revoke all on function public.get_my_buklod_life_impact_v1()
  from public, anon;
grant execute on function public.get_my_buklod_life_impact_v1()
  to authenticated;
