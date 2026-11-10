-- BUKLOD QMP-Finance V3 post-migration contract. Read-only.
-- Verifies canonical weight, own-account RLS boundary, and no duplicate payer.
do $qmp_finance_contract$
declare
  v_my oid:=to_regprocedure('public.get_my_buklod_monthly_earnings_v1()');
  v_own_link oid:=to_regprocedure('public.ensure_my_buklod_qmp_finance_identity_v1()');
  v_admin oid:=to_regprocedure('public.admin_get_buklod_pf_qmp_readiness_v1(text)');
  v_queue oid:=to_regprocedure('public.admin_list_buklod_qmp_month_review_queue_v1(text,integer)');
  v_finance oid:=to_regprocedure('public.admin_finalize_buklod_pf_month_v3(text,text)');
  v_legacy oid:=to_regprocedure('public.admin_finalize_buklod_community_user_pool_v1(text,text)');
  v_points oid:=to_regprocedure('private.buklod_pf_monthly_points_v3(uuid,timestamp with time zone,timestamp with time zone)');
  v_code text;
  v_month private.buklod_community_settlement_periods%rowtype;
  v_total bigint;
  v_actual bigint;
  v_missing bigint;
begin
  if v_my is null or v_own_link is null or v_admin is null
    or v_queue is null or v_finance is null or v_legacy is null
    or v_points is null then
    raise exception 'Required canonical QMP-Finance functions missing';
  end if;

  if has_function_privilege('anon',v_my,'EXECUTE')
    or has_function_privilege('anon',v_own_link,'EXECUTE')
    or has_function_privilege('anon',v_admin,'EXECUTE')
    or has_function_privilege('anon',v_queue,'EXECUTE') then
    raise exception 'Private monthly Finance RPC accessible to anonymous';
  end if;
  if not has_function_privilege('authenticated',v_my,'EXECUTE')
    or not has_function_privilege('authenticated',v_own_link,'EXECUTE')
    or not has_function_privilege('authenticated',v_admin,'EXECUTE')
    or not has_function_privilege('authenticated',v_queue,'EXECUTE') then
    raise exception 'Required authenticated RPC grant missing';
  end if;

  v_code:=pg_get_functiondef(v_points);
  if position('buklod_community_qmp_accounts' in v_code)=0
    or position('buklod_points_ledger' in v_code)>0
    or position('user_share_activated_at' in v_code)>0 then
    raise exception 'Finance monthly weight incorrectly uses lifetime BP or legacy activation';
  end if;

  v_code:=pg_get_functiondef(v_finance);
  if position('Qualified QMP snapshot does not reconcile' in v_code)=0
    or position('Outstanding QMP reviews' in v_code)=0
    or position('Verified source-backed eligible revenue' in v_code)=0
    or position('idempotent_replay' in v_code)=0 then
    raise exception 'Canonical finalization lacks eligibility, revenue or replay guards';
  end if;
  v_code:=pg_get_functiondef(v_legacy);
  if position('retired to prevent duplicate cash distributions' in v_code)=0 then
    raise exception 'Legacy Community payout still active';
  end if;
  v_code:=pg_get_functiondef(v_my);
  if position('auth.uid()' in v_code)=0
    or position('available_finalized_minor' in v_code)=0
    or position('reserved_for_payout_minor' in v_code)=0
    or position('current_month_estimate_included' in v_code)=0
    or position('insert into private.' in lower(v_code))>0 then
    raise exception 'Monthly reader leaks accounts or creates cash';
  end if;
  v_code:=pg_get_functiondef(v_admin);
  if position('buklod_is_system_admin()' in v_code)=0 then
    raise exception 'Finance readiness lacks administrator authorization';
  end if;

  select * into v_month from private.buklod_community_settlement_periods
  order by starts_at desc limit 1;
  if v_month.id is not null then
    select count(*) into v_missing
    from private.buklod_community_qmp_accounts q
    join public.profiles pr on pr.id=q.user_id
    left join private.buklod_pf_user_links l on l.user_id=q.user_id
    where q.settlement_period_id=v_month.id and q.qualified_qmp>0
      and pr.is_active=true and pr.user_deactivated_at is null
      and l.person_id is null;
    if v_missing>0 then
      raise exception 'Qualified QMP identities unresolved: %',v_missing;
    end if;
    select coalesce(sum(q.qualified_qmp),0)::bigint into v_total
    from private.buklod_community_qmp_accounts q
    join private.buklod_pf_user_links l on l.user_id=q.user_id
    join private.buklod_pf_persons p on p.person_id=l.person_id and p.risk_status='CLEAR'
    join public.profiles pr on pr.id=p.current_user_id
    where q.settlement_period_id=v_month.id
      and pr.is_active=true and pr.user_deactivated_at is null;
    v_actual:=private.buklod_pf_total_monthly_qmp_v1(v_month.starts_at,v_month.ends_at);
    if v_total<>v_actual then raise exception 'Canonical QMP denominator mismatch'; end if;
  end if;
end;
$qmp_finance_contract$;
