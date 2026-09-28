-- BUKLOD LIFE / SHARE JESUS R1
-- Additive, privacy-first faith-journey milestones.
-- No finance/referral economy mutation.

create table if not exists private.buklod_life_journeys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stage text not null default 'NONE'
    check (stage in (
      'NONE',
      'JESUS_SHARED',
      'SEEKING',
      'NEW_BEGINNING',
      'WALKING_TOGETHER',
      'GROWING_IN_FAITH'
    )),
  jesus_shared_at timestamptz,
  seeking_at timestamptz,
  new_beginning_at timestamptz,
  walking_together_at timestamptz,
  growing_in_faith_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buklod_life_journeys_stage_idx
  on private.buklod_life_journeys(stage, updated_at desc);

create index if not exists buklod_referrals_referrer_referred_life_idx
  on public.buklod_referrals(referrer_id, referred_id);

create or replace function private.buklod_life_stage_rank_v1(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_stage,''))
    when 'NONE' then 0
    when 'JESUS_SHARED' then 1
    when 'SEEKING' then 2
    when 'NEW_BEGINNING' then 3
    when 'WALKING_TOGETHER' then 4
    when 'GROWING_IN_FAITH' then 5
    else -1
  end;
$$;

revoke all on function private.buklod_life_stage_rank_v1(text)
  from public, anon, authenticated;

create or replace function public.get_my_buklod_life_journey_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row private.buklod_life_journeys%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object(
      'authenticated', false,
      'stage', 'NONE'
    );
  end if;

  select *
  into v_row
  from private.buklod_life_journeys
  where user_id = v_uid;

  if not found then
    return jsonb_build_object(
      'authenticated', true,
      'stage', 'NONE',
      'jesus_shared_at', null,
      'seeking_at', null,
      'new_beginning_at', null,
      'walking_together_at', null,
      'growing_in_faith_at', null
    );
  end if;

  return jsonb_build_object(
    'authenticated', true,
    'stage', v_row.stage,
    'jesus_shared_at', v_row.jesus_shared_at,
    'seeking_at', v_row.seeking_at,
    'new_beginning_at', v_row.new_beginning_at,
    'walking_together_at', v_row.walking_together_at,
    'growing_in_faith_at', v_row.growing_in_faith_at
  );
end;
$$;

revoke all on function public.get_my_buklod_life_journey_v1() from public, anon;
grant execute on function public.get_my_buklod_life_journey_v1() to authenticated;

create or replace function public.buklod_life_mark_my_stage_v1(p_stage text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target text := upper(trim(coalesce(p_stage,'')));
  v_old_stage text := 'NONE';
  v_old_rank integer := 0;
  v_target_rank integer;
  v_referrer uuid;
  v_now timestamptz := now();
  v_title text;
  v_body text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  -- GROWING_IN_FAITH is intentionally not self-declared. It is reserved for
  -- a future server-derived continued-participation signal.
  if v_target not in (
    'JESUS_SHARED',
    'SEEKING',
    'NEW_BEGINNING',
    'WALKING_TOGETHER'
  ) then
    raise exception 'Unsupported LIFE stage';
  end if;

  v_target_rank := private.buklod_life_stage_rank_v1(v_target);

  select stage
  into v_old_stage
  from private.buklod_life_journeys
  where user_id = v_uid
  for update;

  if not found then
    insert into private.buklod_life_journeys(
      user_id,
      stage
    )
    values(
      v_uid,
      'NONE'
    )
    on conflict(user_id) do nothing;

    v_old_stage := 'NONE';
  end if;

  v_old_rank := private.buklod_life_stage_rank_v1(v_old_stage);

  if v_target_rank <= v_old_rank then
    return public.get_my_buklod_life_journey_v1();
  end if;

  update private.buklod_life_journeys
  set
    stage = v_target,
    jesus_shared_at = case
      when v_target_rank >= 1 then coalesce(jesus_shared_at, v_now)
      else jesus_shared_at
    end,
    seeking_at = case
      when v_target_rank >= 2 then coalesce(seeking_at, v_now)
      else seeking_at
    end,
    new_beginning_at = case
      when v_target_rank >= 3 then coalesce(new_beginning_at, v_now)
      else new_beginning_at
    end,
    walking_together_at = case
      when v_target_rank >= 4 then coalesce(walking_together_at, v_now)
      else walking_together_at
    end,
    updated_at = v_now
  where user_id = v_uid;

  -- Anonymous impact notice only. Never expose the recipient identity here.
  select referrer_id
  into v_referrer
  from public.buklod_referrals
  where referred_id = v_uid
  order by created_at asc
  limit 1;

  if v_referrer is not null then
    if v_target = 'JESUS_SHARED' then
      v_title := 'A seed is growing';
      v_body := 'Someone you invited opened the Discover Jesus journey.';
    elsif v_target = 'SEEKING' then
      v_title := 'A journey of faith has started';
      v_body := 'Someone you reached has started exploring faith.';
    elsif v_target = 'NEW_BEGINNING' then
      v_title := 'A new beginning';
      v_body := 'Someone you reached through BUKLOD chose to begin a journey with Jesus.';
    elsif v_target = 'WALKING_TOGETHER' then
      v_title := 'Walking together';
      v_body := 'Someone you reached chose a next step in their faith journey.';
    end if;

    insert into public.notifications(
      user_id,
      title,
      body,
      kind,
      data
    )
    values(
      v_referrer,
      v_title,
      v_body,
      'life_impact',
      jsonb_build_object(
        'route', '/life/impact',
        'milestone', v_target,
        'anonymous', true
      )
    );
  end if;

  return public.get_my_buklod_life_journey_v1();
end;
$$;

revoke all on function public.buklod_life_mark_my_stage_v1(text) from public, anon;
grant execute on function public.buklod_life_mark_my_stage_v1(text) to authenticated;

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
  v_gospel integer := 0;
  v_seeking integer := 0;
  v_new_beginning integer := 0;
  v_walking integer := 0;
  v_growing integer := 0;
  v_recent jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where j.jesus_shared_at is not null
    )::integer,
    count(*) filter (
      where j.seeking_at is not null
    )::integer,
    count(*) filter (
      where j.new_beginning_at is not null
    )::integer,
    count(*) filter (
      where j.walking_together_at is not null
    )::integer,
    count(*) filter (
      where j.growing_in_faith_at is not null
    )::integer
  into
    v_reached,
    v_gospel,
    v_seeking,
    v_new_beginning,
    v_walking,
    v_growing
  from public.buklod_referrals r
  left join private.buklod_life_journeys j
    on j.user_id = r.referred_id
  where r.referrer_id = v_uid;

  with referred as (
    select
      r.referred_id,
      j.jesus_shared_at,
      j.seeking_at,
      j.new_beginning_at,
      j.walking_together_at,
      j.growing_in_faith_at
    from public.buklod_referrals r
    join private.buklod_life_journeys j
      on j.user_id = r.referred_id
    where r.referrer_id = v_uid
  ),
  events as (
    select 'GOSPEL_OPENED'::text as event_type, jesus_shared_at as occurred_at
    from referred where jesus_shared_at is not null
    union all
    select 'SEEKING', seeking_at from referred where seeking_at is not null
    union all
    select 'NEW_BEGINNING', new_beginning_at from referred where new_beginning_at is not null
    union all
    select 'WALKING_TOGETHER', walking_together_at from referred where walking_together_at is not null
    union all
    select 'GROWING_IN_FAITH', growing_in_faith_at from referred where growing_in_faith_at is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event_type', e.event_type,
        'occurred_at', e.occurred_at,
        'anonymous', true
      )
      order by e.occurred_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select event_type, occurred_at
    from events
    order by occurred_at desc
    limit 12
  ) e;

  return jsonb_build_object(
    'people_reached', v_reached,
    'gospel_opened', v_gospel,
    'seeking', v_seeking,
    'faith_journeys_started', v_seeking,
    'new_beginning', v_new_beginning,
    'walking_with_you', v_walking,
    'growing_in_faith', v_growing,
    'recent_activity', v_recent,
    'identity_private', true
  );
end;
$$;

revoke all on function public.get_my_buklod_life_impact_v1() from public, anon;
grant execute on function public.get_my_buklod_life_impact_v1() to authenticated;

comment on table private.buklod_life_journeys is
  'Private, self-controlled BUKLOD LIFE faith-journey milestones. Never public identity data.';

comment on function public.buklod_life_mark_my_stage_v1(text) is
  'Self-service LIFE milestone advancement. No inviter may set another user faith status.';

comment on function public.get_my_buklod_life_impact_v1() is
  'Returns anonymized aggregated LIFE impact counts for the authenticated inviter.';
