-- BUKLOD admin Economy: one source-consistent read-only monthly reporting snapshot.
-- No revenue ingestion, payment allocation, cash mutation or gate activation.
create or replace function public.admin_get_buklod_canonical_economy_snapshot_v1(p_period_key text)
returns jsonb language plpgsql stable security definer set search_path to ''
as $qmp_economy_report$
declare
  v_key text:=trim(coalesce(p_period_key,''));
  v_finance jsonb;
  v_qmp jsonb;
  v_admob jsonb;
begin
  if (select auth.uid()) is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;
  if v_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Finance month must be YYYY-MM (01-12)';
  end if;

  -- These existing APIs are the canonical sources; never join to R38 money,
  -- legacy Community pool, BCU/RCU or provisional AdMob as funded cash.
  v_finance:=public.admin_get_buklod_pf_finance_console_v3(v_key);
  v_qmp:=public.admin_get_buklod_pf_qmp_readiness_v1(v_key);
  v_admob:=public.admin_get_buklod_community_admob_estimate_v1(v_key);

  if coalesce(v_finance->>'period_key','')<>v_key
     or coalesce(v_qmp->>'period_key','')<>v_key
     or (v_admob is not null and coalesce(v_admob->>'period_key','')<>v_key) then
    raise exception 'Economy reporting period mismatch';
  end if;

  return jsonb_build_object(
    'period_key',v_key,
    'generated_at',transaction_timestamp(),
    'finance',v_finance,
    'qmp',v_qmp,
    'admob_provisional',v_admob,
    'source','CANONICAL_FINANCE_V3'
  );
end;
$qmp_economy_report$;
revoke all on function public.admin_get_buklod_canonical_economy_snapshot_v1(text)
from public,anon,authenticated;
grant execute on function public.admin_get_buklod_canonical_economy_snapshot_v1(text) to authenticated;
comment on function public.admin_get_buklod_canonical_economy_snapshot_v1(text) is
'Admin-only one-month read snapshot of canonical Finance V3, QMP readiness and provisional AdMob; does not create cash or combine legacy pools.';
