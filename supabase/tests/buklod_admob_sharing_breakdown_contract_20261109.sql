-- Read-only contract: exact provisional sharing fields, private source, no payouts.
do $buklod_admob_sharing_breakdown$
declare
  v_reader oid := to_regprocedure('public.get_my_buklod_community_contribution_live_v1()');
  v_src text;
begin
  if v_reader is null then
    raise exception 'Private Community AdMob reader is missing';
  end if;
  if has_function_privilege('anon',v_reader,'EXECUTE') then
    raise exception 'Anonymous users must not access Community revenue breakdown';
  end if;
  if not has_function_privilege('authenticated',v_reader,'EXECUTE') then
    raise exception 'Authenticated users cannot see their private QMP report';
  end if;
  if has_table_privilege('authenticated','private.buklod_community_admob_estimate_snapshots','SELECT') then
    raise exception 'AdMob snapshots exposed without individual authentication';
  end if;
  v_src := pg_get_functiondef(v_reader);
  if position('estimated_gross_revenue_minor' in v_src) = 0
     or position('estimated_pool_bps' in v_src) = 0
     or position('estimated_non_pool_revenue_minor' in v_src) = 0
     or position('estimated_share_of_total_revenue' in v_src) = 0
     or position('estimate_source_mode' in v_src) = 0
     or position('v_snapshot.amount_minor-v_pool' in v_src) = 0
     or position('least(v_qmp/v_total,1)*v_bps/10000' in v_src) = 0
     or position('PROVISIONAL_ADMOB' in v_src) = 0
     or position('RECONCILED_OR_FINALIZED' in v_src) = 0
     or position('SOURCE_NOT_CONNECTED' in v_src) = 0
     or position('STALE' in v_src) = 0 then
    raise exception 'Source-backed guarded gross/pool/member preview fields missing';
  end if;
  if position('admin_finalize' in v_src) > 0
     or position('credit_wallet' in v_src) > 0
     or position('process_withdrawal' in v_src) > 0 then
    raise exception 'Revenue preview must never finalize or credit cash';
  end if;
end;
$buklod_admob_sharing_breakdown$;
