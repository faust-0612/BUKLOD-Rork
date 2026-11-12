-- Post-migration BUKLOD Official source-of-truth contract.
-- Run against the migration target in one rollback-only transaction.
begin;
do $test$
declare
  v_official uuid;
  v_other uuid;
  v_person uuid;
  v_month private.buklod_community_settlement_periods%rowtype;
  v_dash jsonb;
  v_mark integer;
  v_before integer;
  v_after integer;
begin
  select user_id into v_official
    from private.buklod_official_identity_snapshot_v1
    where principal_key='OFFICIAL_SYSTEM_ADMIN';
  if v_official is null or not private.buklod_is_platform_official_v1(v_official)
     or not public.get_buklod_official_identity_v1(v_official) then
    raise exception 'Protected principal / official badge missing';
  end if;

  select id into v_other from public.profiles
   where id<>v_official and is_active=true limit 1;
  if v_other is null or private.buklod_is_platform_official_v1(v_other)
     or public.get_buklod_official_identity_v1(v_other) then
    raise exception 'Ordinary member was made official';
  end if;
  if (select full_name from public.profiles where id=v_official)<>'BUKLOD' then
    raise exception 'Protected profile was not branded BUKLOD';
  end if;
  if (select role::text from public.profiles where id=v_official)<>'system_admin'
     or not (select is_active from public.profiles where id=v_official) then
    raise exception 'Original administrator authority compromised';
  end if;

  if has_table_privilege('authenticated','private.buklod_official_identity_snapshot_v1','SELECT')
     or has_table_privilege('anon','private.buklod_official_identity_snapshot_v1','SELECT') then
    raise exception 'Private original identity snapshot exposed';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.buklod_official_identity_snapshot_v1'::regclass) then
    raise exception 'Private identity snapshot must have RLS enabled';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname='buklod_is_platform_official_v1'
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then raise exception 'Official principal evaluator should not be directly callable by members';end if;

  if (select count(*) from public.get_buklod_points_leaderboard('all_time',200,null)
      where user_id=v_official) <>0 then
    raise exception 'Official account appeared in all-time member points leaderboard';
  end if;

  select count(*) into v_before from public.buklod_points_ledger where user_id=v_official;
  insert into public.buklod_points_ledger
    (user_id,direction,points,activity_type,source_key,description,awarded_by)
  values(v_official,'credit',5,'community_post',
    'buklod_official_identity_contract_rollback_only','Rollback-only test',v_official)
  on conflict (user_id,source_key) do nothing;
  select count(*) into v_after from public.buklod_points_ledger where user_id=v_official;
  if v_before<>v_after then raise exception 'Official account earned a new Points credit';end if;

  select l.person_id into v_person from private.buklod_pf_user_links l
   where l.user_id=v_official and l.retired_at is null limit 1;
  select * into v_month from private.buklod_community_settlement_periods
   where status='OPEN' order by starts_at desc limit 1;
  if v_person is not null and v_month.id is not null
     and private.buklod_pf_monthly_points_v3(v_person,v_month.starts_at,v_month.ends_at)<>0 then
    raise exception 'Official Finance numerator remains included';
  end if;


  insert into private.buklod_r36_bcu_ledger
    (user_id,direction,units,event_key,source_type,policy_version,qualification_state)
  values(v_official,'credit',1,'buklod_official_bcu_contract_rollback',
         'community_post','r36_social_economy_v1','qualified');
  if exists(select 1 from private.buklod_r36_bcu_ledger
       where user_id=v_official and event_key='buklod_official_bcu_contract_rollback') then
    raise exception 'Official BCU credit was not blocked';
  end if;
  if not exists(select 1 from pg_trigger
     where tgrelid='private.buklod_r38_rcu_ledger'::regclass
       and tgname='zz_buklod_official_rcu_guard_v1' and tgenabled='O') then
    raise exception 'RCU official guard disabled';
  end if;
  if not exists(select 1 from pg_trigger
     where tgrelid='public.buklod_rank_history'::regclass
       and tgname='zz_buklod_official_rank_history_guard_v1' and tgenabled='O') then
    raise exception 'Rank guard disabled';
  end if;
  if not exists(select 1 from pg_trigger
     where tgrelid='private.buklod_kingdom_shards_ledger_v1'::regclass
       and tgname='zz_buklod_official_shards_guard_v1' and tgenabled='O') then
    raise exception 'Kingdom shard guard disabled';
  end if;

  perform set_config('request.jwt.claim.sub',v_official::text,true);
  v_dash:=public.get_my_buklod_official_dashboard_v1();
  if v_dash->>'is_official'<>'true'
     or v_dash->>'points_eligible'<>'false'
     or v_dash->>'qmp_eligible'<>'false'
     or v_dash->>'payout_eligible'<>'false' then
    raise exception 'Official console returned earning privileges';
  end if;
end $test$;
rollback;
