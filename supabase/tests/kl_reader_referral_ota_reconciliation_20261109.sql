-- Read-only DB contract: no user data is modified and no monetary entitlement is inferred.
do $$
declare v progress record; v_readers record; v_ref record; v_resolver record;
begin
  select p.oid,p.prosecdef,pg_get_functiondef(p.oid) as def into v
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='kl_reading_progress_v1';
  if v.oid is null or not v.prosecdef or v.def not like '%interval ''60 seconds''%' or v.def not like '%ping_count<2%' then
    raise exception 'KL server timing/ping gate absent';
  end if;
  select p.oid,p.prosecdef,pg_get_functiondef(p.oid) as def into v_readers
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='kl_list_readers_v2';
  if v_readers.oid is null or not v_readers.prosecdef
    or not has_function_privilege('authenticated',v_readers.oid,'execute')
    or has_function_privilege('anon',v_readers.oid,'execute')
    or v_readers.def not like '%FROM public.kl_reading_sessions s WHERE s.episode_id=p_episode_id;%' then
    raise exception 'KL cumulative reader access contract invalid';
  end if;
  select p.oid,p.prosecdef,pg_get_functiondef(p.oid) as def into v_ref
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_my_buklod_referral_reconciliation_v1';
  if v_ref.oid is null or not v_ref.prosecdef
    or not has_function_privilege('authenticated',v_ref.oid,'execute')
    or has_function_privilege('anon',v_ref.oid,'execute')
    or v_ref.def not like '%coalesce(v_financial_code,'''')%'
    or v_ref.def not like '%legacy_unreconciled_count%' then
    raise exception 'Referral account or cash-isolation contract invalid';
  end if;
  select p.oid,p.prosecdef,pg_get_functiondef(p.oid) as def into v_resolver
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='resolve_buklod_referral_target_v1';
  if v_resolver.oid is null or not v_resolver.prosecdef
    or v_resolver.def not like '%buklod_referral_codes_v2%'
    or v_resolver.def not like '%canonical_referral_code%' then
    raise exception 'Registration canonical+historical code resolution missing';
  end if;
end $$;
