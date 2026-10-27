-- Additive, estimate-only preview: never credit cash, qualify referrals, or enable payouts.
-- BUKLOD_COMMUNITY_ADMOB_PROVISIONAL_ESTIMATE_V1

create table if not exists private.buklod_community_admob_estimate_snapshots (
  period_key text primary key check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_minor bigint not null check (amount_minor >= 0),
  source_mode text not null check (source_mode in ('ADMIN_ADMOB_REPORT','OFFICIAL_ADMOB_API')),
  source_reference text not null check (length(trim(source_reference)) between 3 and 240),
  observed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists private.buklod_community_admob_estimate_audit (
  id bigint generated always as identity primary key,
  period_key text not null,
  old_amount_minor bigint,
  new_amount_minor bigint not null,
  source_mode text not null,
  source_reference text not null,
  observed_at timestamptz not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on private.buklod_community_admob_estimate_snapshots from public, anon, authenticated;
revoke all on private.buklod_community_admob_estimate_audit from public, anon, authenticated;

-- This RPC records only a provisional AdMob-report snapshot. It deliberately
-- does not touch either canonical Finance V3 or Community cash settlement.
create or replace function public.admin_set_buklod_community_admob_estimate_v1(
  p_period_key text,
  p_amount_php numeric,
  p_source_reference text,
  p_source_mode text default 'ADMIN_ADMOB_REPORT',
  p_observed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_role text := coalesce((select auth.role()), '');
  v_mode text := upper(trim(coalesce(p_source_mode,'')));
  v_reference text := trim(coalesce(p_source_reference,''));
  v_minor bigint;
  v_previous bigint;
  v_row private.buklod_community_admob_estimate_snapshots%rowtype;
begin
  if not (v_role='service_role' or (v_actor is not null and public.buklod_is_system_admin())) then
    raise exception 'System Admin or authorized sync service required';
  end if;
  if coalesce(p_period_key,'') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid YYYY-MM period';
  end if;
  if p_amount_php is null or p_amount_php<0 or p_amount_php>1000000000 then
    raise exception 'Invalid non-negative preliminary PHP revenue';
  end if;
  if length(v_reference)<3 or length(v_reference)>240 then
    raise exception 'AdMob report/reference required (3-240 chars)';
  end if;
  if v_mode not in ('ADMIN_ADMOB_REPORT','OFFICIAL_ADMOB_API') then
    raise exception 'Unsupported preliminary estimate source';
  end if;
  if v_mode='OFFICIAL_ADMOB_API' and v_role<>'service_role' then
    raise exception 'Official AdMob API source may only be written by the trusted server';
  end if;
  if p_observed_at is null or p_observed_at>now()+interval '1 hour'
     or p_observed_at<now()-interval '30 days' then
    raise exception 'Estimate observation time outside permitted window';
  end if;

  v_minor := round(p_amount_php*100)::bigint;
  select s.amount_minor into v_previous
  from private.buklod_community_admob_estimate_snapshots s
  where s.period_key=p_period_key for update;

  insert into private.buklod_community_admob_estimate_snapshots(
    period_key,amount_minor,source_mode,source_reference,observed_at,updated_at,updated_by
  ) values (
    p_period_key,v_minor,v_mode,v_reference,p_observed_at,now(),v_actor
  )
  on conflict(period_key) do update set
    amount_minor=excluded.amount_minor,
    source_mode=excluded.source_mode,
    source_reference=excluded.source_reference,
    observed_at=excluded.observed_at,
    updated_at=now(),
    updated_by=excluded.updated_by
  returning * into v_row;

  if v_previous is distinct from v_minor then
    insert into private.buklod_community_admob_estimate_audit(
      period_key,old_amount_minor,new_amount_minor,source_mode,
      source_reference,observed_at,actor_id
    ) values (
      p_period_key,v_previous,v_minor,v_mode,v_reference,p_observed_at,v_actor
    );
  end if;

  return jsonb_build_object(
    'period_key',v_row.period_key,
    'amount_minor',v_row.amount_minor,
    'source_mode',v_row.source_mode,
    'observed_at',v_row.observed_at,
    'updated_at',v_row.updated_at,
    'cash_credited',false,
    'withdrawable',false
  );
end;
$function$;

revoke all on function public.admin_set_buklod_community_admob_estimate_v1(text,numeric,text,text,timestamptz) from public, anon;
grant execute on function public.admin_set_buklod_community_admob_estimate_v1(text,numeric,text,text,timestamptz) to authenticated,service_role;

create or replace function public.admin_get_buklod_community_admob_estimate_v1(p_period_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_row private.buklod_community_admob_estimate_snapshots%rowtype;
begin
  if (select auth.uid()) is null or not public.buklod_is_system_admin() then
    raise exception 'System Admin access required';
  end if;
  select * into v_row from private.buklod_community_admob_estimate_snapshots
  where period_key=p_period_key;
  if not found then return null; end if;
  return jsonb_build_object(
    'period_key',v_row.period_key,'amount_minor',v_row.amount_minor,
    'source_mode',v_row.source_mode,'source_reference',v_row.source_reference,
    'observed_at',v_row.observed_at,'updated_at',v_row.updated_at
  );
end;
$function$;

revoke all on function public.admin_get_buklod_community_admob_estimate_v1(text) from public,anon;
grant execute on function public.admin_get_buklod_community_admob_estimate_v1(text) to authenticated;

-- Use the already validated Community QMP / engagement RPC. Never mix this
-- preview with finalized/referral/available balances in canonical Finance V3.
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
    'estimated_pool_minor',v_pool,
    'estimated_share_minor',case when v_total>0 then v_share else null end,
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
