-- DEV-only migration: individual manual claim cards and verified +5 BP AdMob bonus.
-- No changes to QMP, Bayanihan, cash balances or settlement.
-- Rollout is explicitly disabled until SSV endpoint + exact AdMob unit are verified.
create table if not exists private.buklod_ad_points_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  reward_points integer not null default 5 check (reward_points between 1 and 20),
  daily_limit integer not null default 20 check (daily_limit between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into private.buklod_ad_points_config (singleton,enabled,reward_points,daily_limit)
values (true,false,5,20) on conflict (singleton) do nothing;
revoke all on private.buklod_ad_points_config from public, anon, authenticated;

create table if not exists private.buklod_ad_points_attempts (
  nonce uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_point_id uuid not null references public.buklod_points_ledger(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','expired','credited')),
  transaction_id text unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  credited_at timestamptz
);
create unique index if not exists buklod_ad_points_one_credit_per_activity
on private.buklod_ad_points_attempts(user_id,source_point_id) where status='credited';
create index if not exists buklod_ad_points_daily_user_idx
on private.buklod_ad_points_attempts(user_id,credited_at) where status='credited';
create index if not exists buklod_ad_points_pending_user_idx
on private.buklod_ad_points_attempts(user_id,created_at) where status='pending';
alter table private.buklod_ad_points_attempts enable row level security;
revoke all on private.buklod_ad_points_attempts from public, anon, authenticated;

-- Claim-card list, not a shortcut for Claim All. Every claim uses the existing
-- atomic, rank-aware claim_my_buklod_reward_event(event_id) implementation.
create or replace function public.get_my_buklod_pending_claim_cards_v1(
  p_limit integer default 100, p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_uid uuid := (select auth.uid()); v_cards jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc,c.ledger_id desc),'[]'::jsonb)
  into v_cards
  from (
    select l.id as ledger_id,e.id as event_id,l.points,l.activity_type,
           l.description,l.created_at
    from public.buklod_points_ledger l
    join public.buklod_reward_events e
      on e.source_point_id=l.id and e.user_id=v_uid and e.event_type='points'
    where l.user_id=v_uid and l.direction='credit' and l.claim_state='pending'
    order by l.created_at desc,l.id desc
    limit least(greatest(coalesce(p_limit,100),1),100)
    offset least(greatest(coalesce(p_offset,0),0),100000)
  ) c;
  return v_cards;
end;
$$;
revoke all on function public.get_my_buklod_pending_claim_cards_v1(integer,integer) from public,anon;
grant execute on function public.get_my_buklod_pending_claim_cards_v1(integer,integer) to authenticated;

create or replace function public.get_my_buklod_ad_points_status_v1()
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cfg private.buklod_ad_points_config%rowtype;
  v_today integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_cfg from private.buklod_ad_points_config where singleton=true;
  select count(*) into v_today
    from private.buklod_ad_points_attempts a
    where a.user_id=v_uid and a.status='credited'
      and a.credited_at >= date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  return jsonb_build_object(
    'enabled',coalesce(v_cfg.enabled,false)
      and not public.buklod_is_official_system_admin(v_uid),
    'points',coalesce(v_cfg.reward_points,5),
    'daily_limit',coalesce(v_cfg.daily_limit,20),
    'earned_today',v_today,
    'remaining',greatest(0,coalesce(v_cfg.daily_limit,20)-v_today)
  );
end;
$$;
revoke all on function public.get_my_buklod_ad_points_status_v1() from public,anon;
grant execute on function public.get_my_buklod_ad_points_status_v1() to authenticated;

create or replace function public.prepare_my_buklod_ad_points_bonus_v1(p_source_point_id uuid)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cfg private.buklod_ad_points_config%rowtype;
  v_attempt private.buklod_ad_points_attempts%rowtype;
  v_today integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if public.buklod_is_official_system_admin(v_uid) then raise exception 'Not eligible'; end if;
  perform p.id from public.profiles p
  where p.id=v_uid and p.is_active=true and p.user_deactivated_at is null for update;
  if not found then raise exception 'Member account not active'; end if;
  select * into v_cfg from private.buklod_ad_points_config where singleton=true;
  if not coalesce(v_cfg.enabled,false) then raise exception 'Ad bonus not available'; end if;
  if p_source_point_id is null or not exists (
    select 1 from public.buklod_points_ledger l
    where l.id=p_source_point_id and l.user_id=v_uid and l.direction='credit'
      and l.claim_state in ('pending','claimed')
      and l.activity_type <> 'admob_rewarded_bonus'
      and l.created_at > now()-interval '30 days'
  ) then raise exception 'This activity is not eligible'; end if;
  if exists (select 1 from private.buklod_ad_points_attempts a
    where a.user_id=v_uid and a.source_point_id=p_source_point_id and a.status='credited')
  then raise exception 'Bonus already received for this activity'; end if;
  select count(*) into v_today
  from private.buklod_ad_points_attempts a
  where a.user_id=v_uid and a.status='credited'
    and a.credited_at >= date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  if v_today >= v_cfg.daily_limit then raise exception 'Daily rewarded ad limit reached'; end if;
  update private.buklod_ad_points_attempts a set status='expired'
  where a.user_id=v_uid and a.status='pending' and a.expires_at <= now();
  select * into v_attempt from private.buklod_ad_points_attempts a
  where a.user_id=v_uid and a.source_point_id=p_source_point_id
    and a.status='pending' and a.expires_at > now()
  order by created_at desc limit 1;
  if v_attempt.nonce is null then
    if (select count(*) from private.buklod_ad_points_attempts a
      where a.user_id=v_uid and a.status='pending') >= 3 then
      raise exception 'Complete your previous ad reward attempt first';
    end if;
    insert into private.buklod_ad_points_attempts(user_id,source_point_id,expires_at)
    values(v_uid,p_source_point_id,now()+interval '1 hour')
    returning * into v_attempt;
  end if;
  return jsonb_build_object('nonce',v_attempt.nonce,'points',v_cfg.reward_points,
    'expires_at',v_attempt.expires_at);
end;
$$;
revoke all on function public.prepare_my_buklod_ad_points_bonus_v1(uuid) from public,anon;
grant execute on function public.prepare_my_buklod_ad_points_bonus_v1(uuid) to authenticated;

-- Called ONLY by the Edge Function after verifying Google's ECDSA SSV signature,
-- exact AdMob ad unit, user_id, timestamp and unique transaction_id.
-- Authenticated clients cannot execute it, even if they spoof an SSV URL.
create or replace function public.confirm_buklod_ad_points_bonus_ssv_v1(
  p_nonce uuid, p_user_id uuid, p_transaction_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  v_attempt private.buklod_ad_points_attempts%rowtype;
  v_cfg private.buklod_ad_points_config%rowtype;
  v_old bigint; v_new bigint; v_available bigint; v_today integer;
  v_ledger uuid; v_old_rank record; v_new_rank record; v_rank_changed boolean;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Unauthorized';
  end if;
  if p_nonce is null or p_user_id is null or p_transaction_id is null
     or p_transaction_id !~ '^[a-zA-Z0-9_-]{12,128}$' then
    raise exception 'Invalid verified reward receipt';
  end if;
  -- Identical lock order to normal manual claims.
  perform p.id from public.profiles p
  where p.id=p_user_id and p.is_active=true and p.user_deactivated_at is null for update;
  if not found or public.buklod_is_official_system_admin(p_user_id) then
    raise exception 'Member account not eligible';
  end if;
  select * into v_attempt from private.buklod_ad_points_attempts a
    where a.nonce=p_nonce and a.user_id=p_user_id for update;
  if v_attempt.nonce is null then raise exception 'Unknown reward attempt'; end if;
  if v_attempt.status='credited' and v_attempt.transaction_id=p_transaction_id then
    return jsonb_build_object('credited',true,'already_processed',true);
  end if;
  if v_attempt.status<>'pending' or v_attempt.expires_at <= now() then
    raise exception 'Expired or completed reward attempt';
  end if;
  if exists (select 1 from private.buklod_ad_points_attempts a
    where a.transaction_id=p_transaction_id or
      (a.user_id=p_user_id and a.source_point_id=v_attempt.source_point_id and a.status='credited'))
  then raise exception 'Duplicate reward attempt'; end if;
  if not exists(select 1 from public.buklod_points_ledger l
    where l.id=v_attempt.source_point_id and l.user_id=p_user_id
      and l.direction='credit' and l.claim_state in ('pending','claimed')
      and l.activity_type<>'admob_rewarded_bonus') then
    raise exception 'Original activity no longer eligible';
  end if;
  select * into v_cfg from private.buklod_ad_points_config where singleton=true;
  if not coalesce(v_cfg.enabled,false) then raise exception 'Ad bonuses paused'; end if;
  select count(*) into v_today from private.buklod_ad_points_attempts a
  where a.user_id=p_user_id and a.status='credited'
    and a.credited_at >= date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  if v_today >= v_cfg.daily_limit then raise exception 'Daily rewarded ad limit reached'; end if;
  v_old := public.buklod_lifetime_points_for(p_user_id);
  insert into public.buklod_points_ledger(
    user_id,direction,points,activity_type,source_key,source_id,description,claim_state
  ) values (
    p_user_id,'credit',v_cfg.reward_points,'admob_rewarded_bonus',
    'admob-ssv:'||p_nonce::text,v_attempt.source_point_id,
    'Verified optional rewarded ad • in-app BP only','claimed'
  ) returning id into v_ledger;
  insert into public.buklod_user_points_balances(user_id,lifetime_points,available_points)
  values(p_user_id,v_cfg.reward_points,v_cfg.reward_points)
  on conflict(user_id) do update
  set lifetime_points=public.buklod_user_points_balances.lifetime_points+excluded.lifetime_points,
      available_points=public.buklod_user_points_balances.available_points+excluded.available_points,
      updated_at=now();
  v_new := public.buklod_lifetime_points_for(p_user_id);
  v_available := public.buklod_available_points_for(p_user_id);
  insert into public.buklod_rank_history(
    user_id,rank_order,rank_family,rank_level,rank_name,min_points,
    achieved_at,lifetime_points_at_achievement,trigger_ledger_id,achievement_source
  ) select p_user_id,r.rank_order,r.rank_family,r.rank_level,r.rank_name,r.min_points,
    now(),v_new,v_ledger,'admob_verified_bonus'
  from public.buklod_rank_levels r
  where r.is_active=true and r.min_points>v_old and r.min_points<=v_new
  order by r.rank_order on conflict(user_id,rank_order) do nothing;
  select * into v_old_rank from public.get_buklod_rank_for_points(v_old);
  select * into v_new_rank from public.get_buklod_rank_for_points(v_new);
  v_rank_changed := v_new_rank.rank_code is not null
    and v_new_rank.rank_code is distinct from v_old_rank.rank_code;
  if v_rank_changed then
    insert into public.buklod_reward_events(
      user_id,event_type,rank_code,rank_name,title,message,spoken_message,claimed_at
    ) values(p_user_id,'rank_up',v_new_rank.rank_code,v_new_rank.display_name,
      'BUKLOD Rank Up!','You reached '||v_new_rank.display_name||'.',
      'Rank up! You are now '||v_new_rank.display_name||'.',now());
  end if;
  update private.buklod_ad_points_attempts set
    status='credited', transaction_id=p_transaction_id, credited_at=now()
  where nonce=p_nonce;
  return jsonb_build_object('credited',true,'already_processed',false,
    'points',v_cfg.reward_points,'available_points',v_available,
    'lifetime_points',v_new,'rank_up',v_rank_changed);
end;
$$;
revoke all on function public.confirm_buklod_ad_points_bonus_ssv_v1(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.confirm_buklod_ad_points_bonus_ssv_v1(uuid,uuid,text)
  to service_role;

comment on function public.confirm_buklod_ad_points_bonus_ssv_v1(uuid,uuid,text) is
'Service-only AdMob ECDSA verified reward; never writes Community QMP, cash or Bayanihan.';

-- The client can confirm only its own nonce; it cannot claim or mutate a receipt.
create or replace function public.get_my_buklod_ad_points_receipt_v1(p_nonce uuid)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_uid uuid := (select auth.uid()); v_attempt private.buklod_ad_points_attempts%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_attempt from private.buklod_ad_points_attempts a
  where a.nonce=p_nonce and a.user_id=v_uid;
  if v_attempt.nonce is null then
    return jsonb_build_object('found',false,'credited',false);
  end if;
  return jsonb_build_object('found',true,
    'credited',v_attempt.status='credited','expires_at',v_attempt.expires_at);
end;
$$;
revoke all on function public.get_my_buklod_ad_points_receipt_v1(uuid) from public,anon;
grant execute on function public.get_my_buklod_ad_points_receipt_v1(uuid) to authenticated;

-- Official Admin-only runtime configuration; default remains disabled until SSV is set up.
create or replace function public.admin_configure_buklod_ad_points_bonus_v1(
  p_enabled boolean, p_reward_points integer default 5,
  p_daily_limit integer default 20
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.buklod_is_official_system_admin(v_uid) then
    raise exception 'Only BUKLOD Official may configure rewarded Points';
  end if;
  if p_reward_points not between 1 and 20 or p_daily_limit not between 1 and 100 then
    raise exception 'Invalid rewarded Points configuration';
  end if;
  update private.buklod_ad_points_config
    set enabled=coalesce(p_enabled,false),
        reward_points=p_reward_points, daily_limit=p_daily_limit,updated_at=now()
    where singleton=true;
  if not found then raise exception 'Reward configuration missing'; end if;
  return jsonb_build_object('enabled',coalesce(p_enabled,false),
    'points',p_reward_points,'daily_limit',p_daily_limit);
end;
$$;
revoke all on function public.admin_configure_buklod_ad_points_bonus_v1(boolean,integer,integer)
  from public,anon;
grant execute on function public.admin_configure_buklod_ad_points_bonus_v1(boolean,integer,integer)
  to authenticated;
