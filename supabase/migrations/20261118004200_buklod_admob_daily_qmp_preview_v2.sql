-- Noncash official AdMob daily preview. Canonical Finance V3 remains untouched.
create table if not exists private.buklod_admob_daily_preview_v1 (
  report_date date primary key,
  period_key text not null check (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount_minor bigint not null check (amount_minor >= 0),
  source_reference text not null check (length(trim(source_reference)) between 3 and 240),
  reporting_time_zone text not null check (length(trim(reporting_time_zone)) between 3 and 64),
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.buklod_admob_daily_preview_v1 enable row level security;
revoke all on private.buklod_admob_daily_preview_v1 from public, anon, authenticated;

create or replace function public.buklod_write_admob_daily_preview_v2(
  p_period_key text,p_month_php numeric,p_report_date date,p_today_php numeric,
  p_source_reference text,p_reporting_time_zone text,p_observed_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_last timestamptz;
begin
  if coalesce((select auth.role()),'') <> 'service_role' then
    raise exception 'Trusted AdMob scheduler required';
  end if;
  if p_period_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_report_date is null or p_period_key <> to_char(p_report_date,'YYYY-MM') then
    raise exception 'Inconsistent AdMob reporting period';
  end if;
  if p_observed_at is null
     or p_observed_at > now()+interval '1 hour'
     or p_observed_at < now()-interval '1 day' then
    raise exception 'Invalid report freshness';
  end if;
  if p_month_php is null or p_today_php is null
     or p_month_php < 0 or p_today_php < 0
     or p_month_php > 1000000000 or p_today_php > p_month_php then
    raise exception 'Invalid preliminary AdMob amounts';
  end if;
  if length(trim(coalesce(p_source_reference,''))) not between 3 and 240
     or length(trim(coalesce(p_reporting_time_zone,''))) not between 3 and 64 then
    raise exception 'Missing source identity or AdMob reporting time zone';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(6149,pg_catalog.hashtext(p_period_key));
  select observed_at into v_last
  from private.buklod_community_admob_estimate_snapshots
  where period_key=p_period_key for update;
  if v_last is not null and v_last > p_observed_at then
    return jsonb_build_object('status','OLDER_REPORT_IGNORED',
      'period_key',p_period_key,'cash_credited',false,'withdrawable',false);
  end if;
  perform public.admin_set_buklod_community_admob_estimate_v1(
    p_period_key,p_month_php,p_source_reference,'OFFICIAL_ADMOB_API',p_observed_at
  );
  insert into private.buklod_admob_daily_preview_v1(
    report_date,period_key,amount_minor,source_reference,reporting_time_zone,observed_at
  ) values (
    p_report_date,p_period_key,round(p_today_php*100)::bigint,
    p_source_reference,p_reporting_time_zone,p_observed_at
  )
  on conflict (report_date) do update set
    period_key=excluded.period_key,
    amount_minor=excluded.amount_minor,
    source_reference=excluded.source_reference,
    reporting_time_zone=excluded.reporting_time_zone,
    observed_at=excluded.observed_at
  where private.buklod_admob_daily_preview_v1.observed_at <= excluded.observed_at;
  return jsonb_build_object('status','PRELIMINARY_ONLY',
    'period_key',p_period_key,'report_date',p_report_date,
    'cash_credited',false,'withdrawable',false);
end;
$function$;
revoke all on function public.buklod_write_admob_daily_preview_v2(text,numeric,date,numeric,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.buklod_write_admob_daily_preview_v2(text,numeric,date,numeric,text,text,timestamptz) to service_role;

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
  v_day private.buklod_admob_daily_preview_v1%rowtype;
  v_day_share bigint;
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

  if v_snapshot.observed_at<now()-interval '36 hours' then
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

  select * into v_day from private.buklod_admob_daily_preview_v1 d
  where d.period_key=v_key
    and d.source_reference=v_snapshot.source_reference
    and d.observed_at=v_snapshot.observed_at
    and v_snapshot.source_mode='OFFICIAL_ADMOB_API'
  order by d.report_date desc limit 1;
  v_day_share:=case when v_day.report_date is not null and v_total>0
    then floor(floor(v_day.amount_minor::numeric*v_bps/10000)*v_qmp/v_total)::bigint
    else null end;

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
    'today_estimated_share_minor',v_day_share,
    'today_report_date',case when v_day.report_date is not null
      then to_char(v_day.report_date,'YYYY-MM-DD') else null end,
    'today_report_timezone',v_day.reporting_time_zone,
    'today_estimate_below_cent',v_day.report_date is not null
      and v_total>0 and v_qmp>0 and v_day.amount_minor>0 and v_day_share=0,
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
