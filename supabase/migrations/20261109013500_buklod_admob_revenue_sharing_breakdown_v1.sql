-- BUKLOD Community Contribution: exact preliminary AdMob sharing transparency.
-- Read-only response fields only; preserve all existing QMP, pool, and cash rules.
-- Existing API signature and grants stay unchanged. No settlement/payout writes.
create or replace function public.get_my_buklod_community_contribution_live_v1()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_base jsonb;
  v_key text;
  v_snapshot private.buklod_community_admob_estimate_snapshots%rowtype;
  v_qmp numeric;
  v_total numeric;
  v_bps integer:=3000;
  v_pool bigint;
  v_share bigint;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  v_base:=public.get_my_buklod_community_contribution_v2();
  v_key:=v_base->'period'->>'key';

  -- Existing reconciled Community User Pool always has precedence.
  if coalesce((v_base->>'estimated_pool_minor')::bigint,0)>0
     or (v_base->'finalized_share' is not null and v_base->'finalized_share'<>'null'::jsonb) then
    return v_base || jsonb_build_object(
      'estimate_status','RECONCILED_OR_FINALIZED','estimate_updated_at',null
    );
  end if;

  select * into v_snapshot
  from private.buklod_community_admob_estimate_snapshots
  where period_key=v_key and source_reference<>'';

  if not found then
    return v_base || jsonb_build_object(
      'estimated_share_minor',null,'estimated_pool_minor',0,
      'estimate_status','SOURCE_NOT_CONNECTED','estimate_updated_at',null,
      'estimate_label','AdMob estimate not yet synced. QMP is participation only, not pesos or withdrawable cash.'
    );
  end if;

  if v_snapshot.observed_at<now()-interval '7 days' then
    return v_base || jsonb_build_object(
      'estimated_share_minor',null,'estimated_pool_minor',0,
      'estimate_status','STALE','estimate_updated_at',v_snapshot.observed_at,
      'estimate_label','Last AdMob preview is stale. Refresh the source report; no cash entitlement is implied.'
    );
  end if;

  select greatest(0,least(10000,coalesce((r.config->>'pool_bps')::integer,3000)))
  into v_bps
  from private.buklod_community_qmp_rule_versions r
  where r.rule_version=v_base->>'rule_version';
  v_bps:=coalesce(v_bps,3000);
  v_qmp:=greatest(coalesce((v_base->>'this_month_qmp')::numeric,0),0);
  v_total:=greatest(coalesce((v_base->>'total_qualified_qmp')::numeric,0),0);
  v_pool:=floor(v_snapshot.amount_minor::numeric*v_bps/10000)::bigint;
  v_share:=case when v_total>0 and v_qmp>0
    then floor(v_pool::numeric*v_qmp/v_total)::bigint
    else 0 end;

  return v_base || jsonb_build_object(
    -- Snapshot fields are supplied only for fresh, source-backed AdMob
    -- previews. The displayed 30%/70% split derives from the same
    -- authoritative period rule used for the cent-rounded private share.
    'estimated_gross_revenue_minor',v_snapshot.amount_minor,
    'estimated_pool_bps',v_bps,
    'estimated_non_pool_revenue_minor',v_snapshot.amount_minor-v_pool,
    'estimated_share_of_total_revenue',case when v_total>0
      then least(v_qmp/v_total,1)*v_bps/10000
      else null end,
    'estimate_source_mode',v_snapshot.source_mode,
    'estimated_pool_minor',v_pool,
    'estimated_share_minor',case when v_total>0 then v_share else null end,
    'estimate_below_cent',v_total>0 and v_qmp>0 and v_snapshot.amount_minor>0 and v_bps>0 and v_share=0,
    'estimate_status','PROVISIONAL_ADMOB',
    'estimate_updated_at',v_snapshot.observed_at,
    'estimate_label','ADMOB PRELIMINARY REPORT · ESTIMATE ONLY · NOT FINAL · NOT FUNDED OR WITHDRAWABLE · SUBJECT TO ADJUSTMENT AND QUALIFICATION REVIEW'
  );
end;
$function$;

revoke all on function public.get_my_buklod_community_contribution_live_v1() from public,anon;
grant execute on function public.get_my_buklod_community_contribution_live_v1() to authenticated;

comment on function public.get_my_buklod_community_contribution_live_v1() is
'Private, noncash preview of a manually verified or official AdMob estimated revenue snapshot weighted by qualified Community QMP. No finalization or payout.';
