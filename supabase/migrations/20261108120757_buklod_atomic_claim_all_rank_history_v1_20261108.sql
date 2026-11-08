-- Already applied to production yhanxndaqbmuzbdqlblu as 20261108120757.
-- Preserve all canonical Claim All authorization, idempotency, accounting
-- and historical rank crossing. The crossing must be ledger-backed and use
-- the permitted 'ledger_crossing' source, not 'claim_all_crossing'.
begin;
CREATE OR REPLACE FUNCTION public.claim_all_my_buklod_reward_events()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  old_lifetime bigint := 0;
  new_lifetime bigint := 0;
  new_available bigint := 0;
  total_claimed bigint := 0;
  claimed_count bigint := 0;
  first_claim_ledger uuid;
  old_rank record;
  new_rank record;
  rank_changed boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;

  -- User row lock serializes Claim and Claim All across multiple taps/devices.
  perform p.id from public.profiles p where p.id=uid for update;
  old_lifetime := public.buklod_lifetime_points_for(uid);

  with newly_claimed as (
    update public.buklod_points_ledger l
    set claim_state='claimed'
    where l.user_id=uid
      and l.direction='credit'
      and l.claim_state='pending'
    returning l.id,l.points
  )
  select coalesce(sum(points),0)::bigint,count(*)::bigint,(array_agg(id order by id))[1]
  into total_claimed,claimed_count,first_claim_ledger
  from newly_claimed;

  if total_claimed>0 then
    insert into public.buklod_user_points_balances(user_id,lifetime_points,available_points)
    values(uid,total_claimed,total_claimed)
    on conflict(user_id) do update
    set lifetime_points=public.buklod_user_points_balances.lifetime_points+excluded.lifetime_points,
        available_points=public.buklod_user_points_balances.available_points+excluded.available_points,
        updated_at=now();
  end if;

  -- Any point card whose ledger is now claimed/legacy is permanently closed.
  update public.buklod_reward_events e
  set claimed_at=coalesce(e.claimed_at,now())
  where e.user_id=uid and e.event_type='points' and e.claimed_at is null
    and exists (
      select 1 from public.buklod_points_ledger l
      where l.id=e.source_point_id and l.user_id=uid and l.direction='credit'
        and l.claim_state in ('claimed','legacy')
    );

  new_lifetime := public.buklod_lifetime_points_for(uid);
  new_available := public.buklod_available_points_for(uid);

  if new_lifetime>old_lifetime then
    insert into public.buklod_rank_history(
      user_id,rank_order,rank_family,rank_level,rank_name,min_points,
      achieved_at,lifetime_points_at_achievement,trigger_ledger_id,achievement_source
    )
    select uid,r.rank_order,r.rank_family,r.rank_level,r.rank_name,r.min_points,
           now(),new_lifetime,first_claim_ledger,'ledger_crossing'
    from public.buklod_rank_levels r
    where r.is_active=true
      and r.min_points>old_lifetime
      and r.min_points<=new_lifetime
    order by r.rank_order
    on conflict(user_id,rank_order) do nothing;
  end if;

  select * into old_rank from public.get_buklod_rank_for_points(old_lifetime);
  select * into new_rank from public.get_buklod_rank_for_points(new_lifetime);
  rank_changed := new_rank.rank_code is not null and new_rank.rank_code is distinct from old_rank.rank_code;

  if rank_changed then
    insert into public.buklod_reward_events(
      user_id,event_type,points,rank_code,rank_name,title,message,spoken_message,created_at,claimed_at
    ) values (
      uid,'rank_up',null,new_rank.rank_code,new_rank.display_name,
      'BUKLOD Rank Up!','You reached '||new_rank.display_name||'.',
      'Rank up! You are now '||new_rank.display_name||'.',now(),now()
    );
  end if;

  return jsonb_build_object(
    'claimed_count',claimed_count,
    'claimed_points',total_claimed,
    'lifetime_points',new_lifetime,
    'available_points',new_available,
    'pending_claimable_points',public.buklod_pending_claimable_points_for(uid),
    'remaining_count',public.get_my_unclaimed_buklod_reward_count(),
    'rank_up',rank_changed,
    'rank_name',case when rank_changed then new_rank.display_name else null end,
    'idempotent_empty',claimed_count=0
  );
end;
$function$;
commit;
