-- BUKLOD referral BP: +10 for a verified referral, +10 one-time for a subsequent
-- claimed Circle Rank advance while the referred member is active in a Cluster.
-- The member's configured +10 signup BP is preserved. Finance cash is NOT automated.
-- Source keys include the immutable referral UUID: safe under retries/concurrency.
-- Keep the legacy admin cash-qualification path but prevent duplicate BP credit.

insert into public.buklod_point_rules
  (activity_type,label,base_points,max_points_per_event,is_active,notes)
values
  ('referral_rank_bonus','Referral Circle Rank advancement',10,10,true,
   'One-time referrer bonus when a verified referred member advances a claimed Circle Rank while active in a Cluster')
on conflict (activity_type) do nothing;

create or replace function private.buklod_award_referral_rank_bonus_v2(p_referred_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $bonus$
declare
  v_ref public.buklod_referrals%rowtype;
  v_rank_id uuid;
  v_points integer;
begin
  select r.* into v_ref from public.buklod_referrals r
  where r.referred_id=p_referred_id for update;
  if not found or v_ref.referrer_id=v_ref.referred_id
     or v_ref.status not in ('qualified','rewarded') then
    return;
  end if;

  if not exists (
    select 1 from public.profiles invited
    join public.profiles inviter on inviter.id=v_ref.referrer_id
    where invited.id=v_ref.referred_id
      and invited.is_verified=true
      and invited.is_active=true
      and invited.user_deactivated_at is null
      and inviter.is_active=true
      and inviter.user_deactivated_at is null
  ) or private.buklod_is_platform_official_v1(v_ref.referrer_id)
    or private.buklod_is_platform_official_v1(v_ref.referred_id) then
    return;
  end if;

  select least(r.base_points,coalesce(r.max_points_per_event,r.base_points))
  into v_points from public.buklod_point_rules r
  where r.activity_type='referral_rank_bonus' and r.is_active=true;
  if coalesce(v_points,0)<=0 then return; end if;

  -- Rank must be reached after attribution, above the rank already held then.
  -- A genuine, claimed, non-referral activity must support the progression.
  -- Leaderboard position is NOT Circle Rank and is never used as proof.
  select h.id into v_rank_id
  from public.buklod_rank_history h
  where h.user_id=v_ref.referred_id
    and h.achievement_source='ledger_crossing'
    and h.rank_order>1
    and h.achieved_at>v_ref.created_at
    and h.rank_order>coalesce((
      select max(prior.rank_order) from public.buklod_rank_history prior
      where prior.user_id=v_ref.referred_id
        and prior.achieved_at<=v_ref.created_at
    ),1)
    and h.trigger_ledger_id is not null
    and exists (
      select 1 from public.buklod_points_ledger crossing
      where crossing.id=h.trigger_ledger_id
        and crossing.user_id=v_ref.referred_id
        and crossing.direction='credit'
        and crossing.claim_state in ('claimed','legacy')
    )
    and exists (
      select 1 from public.buklod_points_ledger earned
      where earned.user_id=v_ref.referred_id
        and earned.direction='credit'
        and earned.claim_state in ('claimed','legacy')
        and earned.activity_type not like 'referral%'
        and earned.created_at>v_ref.created_at
        and earned.created_at<=h.achieved_at
    )
    and exists (
      select 1 from public.buklod_scope_memberships m
      join public.buklod_scopes s on s.id=m.scope_id
      where m.user_id=v_ref.referred_id
        and m.membership_status='ACTIVE'
        and m.left_at is null
        and coalesce(m.joined_at,m.created_at)<=h.achieved_at
        and s.scope_type='CLUSTER'
        and s.status='ACTIVE'
    )
  order by h.achieved_at,h.rank_order,h.id
  limit 1;

  if v_rank_id is null then return; end if;

  insert into public.buklod_points_ledger
    (user_id,direction,points,activity_type,source_key,source_id,description)
  values
    (v_ref.referrer_id,'credit',v_points,'referral_rank_bonus',
     'referral:rank:v2:'||v_ref.id::text,v_ref.id,
     'Referral bonus: invited member advanced a verified Circle Rank')
  on conflict (user_id,source_key) do nothing;
end;
$bonus$;

create or replace function private.buklod_award_verified_referral_points_v2(p_referred_id uuid)
returns void
language plpgsql security definer set search_path to ''
as $verified$
declare
  v_ref public.buklod_referrals%rowtype;
  v_cfg public.buklod_referral_rewards_config%rowtype;
begin
  select r.* into v_ref from public.buklod_referrals r
  where r.referred_id=p_referred_id for update;
  if not found or v_ref.referrer_id=v_ref.referred_id then return; end if;

  if not exists (
    select 1 from public.profiles invited
    join public.profiles inviter on inviter.id=v_ref.referrer_id
    where invited.id=v_ref.referred_id
      and invited.is_verified=true
      and invited.is_active=true
      and invited.user_deactivated_at is null
      and inviter.is_active=true
      and inviter.user_deactivated_at is null
  ) or private.buklod_is_platform_official_v1(v_ref.referrer_id)
    or private.buklod_is_platform_official_v1(v_ref.referred_id) then
    return;
  end if;

  select * into v_cfg from public.buklod_referral_rewards_config where id=1;
  if not found then raise exception 'Referral BP configuration unavailable'; end if;

  if v_cfg.referrer_points>0 then
    insert into public.buklod_points_ledger
      (user_id,direction,points,activity_type,source_key,source_id,description)
    values
      (v_ref.referrer_id,'credit',v_cfg.referrer_points,'referral',
       'referral:verified:v2:'||v_ref.id::text,v_ref.id,
       'Verified referral: new member')
    on conflict (user_id,source_key) do nothing;
  end if;

  if v_cfg.referred_points>0 then
    insert into public.buklod_points_ledger
      (user_id,direction,points,activity_type,source_key,source_id,description)
    values
      (v_ref.referred_id,'credit',v_cfg.referred_points,'referral_new_member',
       'referral:welcome:v2:'||v_ref.id::text,v_ref.id,
       'Welcome to BUKLOD: verified referral')
    on conflict (user_id,source_key) do nothing;
  end if;

  update public.buklod_referrals
  set status='qualified',qualified_at=coalesce(qualified_at,now()),updated_at=now()
  where id=v_ref.id and status='pending';

  -- Also handles an eligible rank earned before admin verified the profile.
  perform private.buklod_award_referral_rank_bonus_v2(p_referred_id);
end;
$verified$;

-- All helpers are internal trigger/admin-only entry points, not member RPCs.
revoke all on function private.buklod_award_referral_rank_bonus_v2(uuid)
  from public,anon,authenticated;
revoke all on function private.buklod_award_verified_referral_points_v2(uuid)
  from public,anon,authenticated;

create or replace function private.buklod_verified_referral_profile_event_v2()
returns trigger language plpgsql security definer set search_path to ''
as $profile$
begin
  if new.is_verified=true and new.is_active=true
     and new.user_deactivated_at is null then
    perform private.buklod_award_verified_referral_points_v2(new.id);
  end if;
  return new;
end;
$profile$;

create or replace function private.buklod_verified_referral_attach_event_v2()
returns trigger language plpgsql security definer set search_path to ''
as $attach$
begin
  perform private.buklod_award_verified_referral_points_v2(new.referred_id);
  return new;
end;
$attach$;

create or replace function private.buklod_verified_referral_rank_event_v2()
returns trigger language plpgsql security definer set search_path to ''
as $rank$
begin
  if new.achievement_source='ledger_crossing' and new.rank_order>1 then
    perform private.buklod_award_referral_rank_bonus_v2(new.user_id);
  end if;
  return new;
end;
$rank$;

revoke all on function private.buklod_verified_referral_profile_event_v2()
  from public,anon,authenticated;
revoke all on function private.buklod_verified_referral_attach_event_v2()
  from public,anon,authenticated;
revoke all on function private.buklod_verified_referral_rank_event_v2()
  from public,anon,authenticated;

drop trigger if exists trg_buklod_verified_referral_profile_v2 on public.profiles;
create trigger trg_buklod_verified_referral_profile_v2
after insert or update of is_verified,is_active,user_deactivated_at
on public.profiles for each row
execute function private.buklod_verified_referral_profile_event_v2();

drop trigger if exists trg_buklod_verified_referral_attach_v2 on public.buklod_referrals;
create trigger trg_buklod_verified_referral_attach_v2
after insert on public.buklod_referrals for each row
execute function private.buklod_verified_referral_attach_event_v2();

drop trigger if exists trg_buklod_verified_referral_rank_v2 on public.buklod_rank_history;
create trigger trg_buklod_verified_referral_rank_v2
after insert on public.buklod_rank_history for each row
execute function private.buklod_verified_referral_rank_event_v2();

-- Keep the established admin-only legacy CASH path. Replace only its BP
-- award calls with the same idempotent engine used by automatic verification.
-- No new automated cash payouts, no conversion between cash and BP.
create or replace function public.buklod_qualify_referral_v1(p_referred_id uuid)
returns jsonb
language plpgsql security definer set search_path to ''
as $manual$
declare
  v_row public.buklod_referrals%rowtype;
  v_cfg public.buklod_referral_rewards_config%rowtype;
begin
  if not public.is_system_admin() then
    raise exception 'Admin only' using errcode='42501';
  end if;

  select * into v_row from public.buklod_referrals
  where referred_id=p_referred_id for update;
  if not found then raise exception 'Referral not found'; end if;
  if v_row.status='rewarded' then
    return jsonb_build_object('status','rewarded','already',true);
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_row.referred_id and p.is_verified=true and p.is_active=true
      and p.user_deactivated_at is null
  ) then
    raise exception 'Verified active referred member required';
  end if;

  perform private.buklod_award_verified_referral_points_v2(p_referred_id);
  select * into v_cfg from public.buklod_referral_rewards_config where id=1;

  update public.buklod_referrals
  set status='rewarded',qualified_at=coalesce(qualified_at,now()),updated_at=now()
  where id=v_row.id;

  if v_cfg.referrer_bayanihan>0 then
    perform public.buklod_internal_credit_bayanihan_v1(
      v_row.referrer_id,v_cfg.referrer_bayanihan,
      'referral','Referral Bayanihan — referrer');
  end if;
  if v_cfg.referred_bayanihan>0 then
    perform public.buklod_internal_credit_bayanihan_v1(
      v_row.referred_id,v_cfg.referred_bayanihan,
      'referral','Referral Bayanihan — new member');
  end if;

  return jsonb_build_object('status','rewarded','referrer_id',v_row.referrer_id,
                             'referred_id',v_row.referred_id);
end;
$manual$;

comment on function private.buklod_award_referral_rank_bonus_v2(uuid) is
'One-time configuration-driven +10 BP after attributable claimed Circle Rank crossing by a verified active Cluster member; no cash payout.';
comment on function private.buklod_award_verified_referral_points_v2(uuid) is
'Idempotent verified referral +10 BP for referrer and configured welcome BP for referred member; no cash payout.';
