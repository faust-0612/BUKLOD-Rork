-- Read-only regression contract: user Economy/Referral RPCs remain callable
-- for authenticated users after the identity Edge Function CORS hotfix.
do $buklod_referral_identity_cors_v15$
declare
  v_financial oid := to_regprocedure('public.get_my_buklod_financial_summary_v3()');
  v_reconciliation oid := to_regprocedure('public.get_my_buklod_referral_reconciliation_v1()');
  v_referral oid := to_regprocedure('public.get_my_buklod_referral_summary_v2()');
  v_proc oid;
begin
  if v_financial is null or v_reconciliation is null or v_referral is null then
    raise exception 'Canonical Economy or referral RPC missing';
  end if;
  foreach v_proc in array array[v_financial,v_reconciliation,v_referral] loop
    if not has_function_privilege('authenticated',v_proc,'EXECUTE') then
      raise exception 'Authenticated caller lost Economy or referral access';
    end if;
    if position('auth.uid()' in pg_get_functiondef(v_proc)) = 0
       and v_proc <> v_referral then
      raise exception 'Principal binding missing in financial/referral reader';
    end if;
  end loop;
end;
$buklod_referral_identity_cors_v15$;
