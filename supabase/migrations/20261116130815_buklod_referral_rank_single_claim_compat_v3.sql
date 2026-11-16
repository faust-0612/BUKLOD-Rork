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
    and h.achievement_source in ('ledger_crossing','claimed_crossing')
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


-- Claim One emits claimed_crossing; Claim All/Group emits ledger_crossing.
-- Both are emitted by server-authenticated canonical claim paths.
create or replace function private.buklod_verified_referral_rank_event_v2()
returns trigger language plpgsql security definer set search_path to ''
as $rank$
begin
  if new.achievement_source in ('ledger_crossing','claimed_crossing')
     and new.rank_order>1 then
    perform private.buklod_award_referral_rank_bonus_v2(new.user_id);
  end if;
  return new;
end;
$rank$;

revoke all on function private.buklod_award_referral_rank_bonus_v2(uuid)
  from public,anon,authenticated;
revoke all on function private.buklod_verified_referral_rank_event_v2()
  from public,anon,authenticated;
