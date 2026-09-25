-- BUKLOD FBC R8: universal finance/provider monitoring
-- Additive only. No destructive rewrites of historical ledgers.
-- Runtime state was first verified on the linked production project.

create table if not exists private.buklod_fbc_sources (
  source_key text primary key,
  display_name text not null,
  source_kind text not null check (
    source_kind in ('APP','PROVIDER','REVENUE_SOURCE','COST_SOURCE','MANUAL')
  ),
  finance_role text not null check (
    finance_role in ('REVENUE','COST','BOTH','NON_OPERATING','LIABILITY','MONITOR_ONLY')
  ),
  connection_state text not null default 'NOT_CONNECTED',
  provider_state text not null default 'UNKNOWN',
  required_for_complete_finance boolean not null default true,
  app_key text,
  provider_name text,
  billing_plan text,
  approval_state text,
  warning_rules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.buklod_fbc_finance_events (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references private.buklod_fbc_sources(source_key),
  event_type text not null check (
    event_type in ('REVENUE','COST','FEE','REFUND','TAX','LIABILITY','ADJUSTMENT')
  ),
  amount numeric not null check (amount >= 0),
  currency text not null default 'PHP',
  normalized_amount_php numeric,
  financial_state text not null default 'PROVIDER_REPORTED' check (
    financial_state in (
      'ESTIMATED','PROVIDER_REPORTED','RECONCILED',
      'SETTLED','EXCLUDED','NEEDS_FX'
    )
  ),
  external_reference text,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now(),
  ledger_entry_id uuid,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists buklod_fbc_finance_events_source_time_idx
  on private.buklod_fbc_finance_events(source_key, occurred_at desc);

create index if not exists buklod_fbc_finance_events_state_idx
  on private.buklod_fbc_finance_events(financial_state, occurred_at desc);

create table if not exists private.buklod_fbc_provider_usage (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references private.buklod_fbc_sources(source_key),
  metric_key text not null,
  metric_name text not null,
  quantity numeric not null default 0,
  unit text not null,
  allowance numeric,
  current_cost_php numeric,
  projected_quantity numeric,
  projected_cost_php numeric,
  plan_name text,
  provider_status text,
  cycle_start timestamptz,
  cycle_end timestamptz,
  warning_level text not null default 'INFO' check (
    warning_level in ('INFO','WATCH','WARNING','CRITICAL','ACTION_REQUIRED')
  ),
  warning_message text,
  upgrade_recommended boolean not null default false,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists buklod_fbc_provider_usage_source_metric_time_idx
  on private.buklod_fbc_provider_usage(source_key, metric_key, observed_at desc);

create or replace function private.buklod_fbc_warning_level_v1(
  p_quantity numeric,
  p_allowance numeric,
  p_cycle_end timestamptz,
  p_provider_status text,
  p_rules jsonb
) returns jsonb
language plpgsql
stable
set search_path=''
as $$
declare
  v_pct numeric;
  v_watch numeric := coalesce((p_rules->>'watch_percent')::numeric,70);
  v_warning numeric := coalesce((p_rules->>'warning_percent')::numeric,85);
  v_critical numeric := coalesce((p_rules->>'critical_percent')::numeric,95);
  v_renewal_days integer := coalesce((p_rules->>'renewal_warning_days')::integer,14);
  v_level text := 'INFO';
  v_message text := null;
  v_upgrade boolean := false;
begin
  if upper(coalesce(p_provider_status,'')) in (
    'FAILED','SUSPENDED','PAYMENT_FAILED','AUTH_EXPIRED','QUOTA_BLOCKED'
  ) then
    v_level := 'ACTION_REQUIRED';
    v_message := 'Provider requires immediate attention: ' ||
      upper(coalesce(p_provider_status,'UNKNOWN'));
    v_upgrade := upper(coalesce(p_provider_status,'')) = 'QUOTA_BLOCKED';
  elsif p_allowance is not null and p_allowance > 0 then
    v_pct := round((coalesce(p_quantity,0) / p_allowance) * 100,2);
    if v_pct >= 100 then
      v_level := 'ACTION_REQUIRED';
      v_message := 'Usage reached or exceeded plan allowance.';
      v_upgrade := true;
    elsif v_pct >= v_critical then
      v_level := 'CRITICAL';
      v_message := 'Usage is near the plan limit.';
      v_upgrade := true;
    elsif v_pct >= v_warning then
      v_level := 'WARNING';
      v_message := 'Usage is above the warning threshold.';
    elsif v_pct >= v_watch then
      v_level := 'WATCH';
      v_message := 'Usage is approaching the warning threshold.';
    end if;
  end if;

  if v_level='INFO'
     and p_cycle_end is not null
     and p_cycle_end <= now() + make_interval(days => v_renewal_days) then
    v_level := 'WATCH';
    v_message := 'Billing cycle or renewal is approaching.';
  end if;

  return jsonb_build_object(
    'level', v_level,
    'message', v_message,
    'upgrade_recommended', v_upgrade,
    'usage_percent',
    case
      when p_allowance is not null and p_allowance > 0
        then round((coalesce(p_quantity,0) / p_allowance) * 100,2)
      else null
    end
  );
end;
$$;

create or replace function private.buklod_fbc_find_or_create_open_period_v1(
  p_period_key text,
  p_reference_at timestamptz
) returns private.buklod_r38_economic_periods
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row private.buklod_r38_economic_periods%rowtype;
  v_key text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if nullif(trim(coalesce(p_period_key,'')),'') is not null then
    select * into v_row
    from private.buklod_r38_economic_periods
    where period_key = upper(trim(p_period_key));

    if found then
      if v_row.status in ('FINALIZED','PAYOUT_READY','CLOSED') then
        raise exception 'Selected economic period is finalized/closed';
      end if;
      return v_row;
    end if;
  end if;

  select * into v_row
  from private.buklod_r38_economic_periods
  where coalesce(p_reference_at,now()) >= period_start
    and coalesce(p_reference_at,now()) < period_end
    and status not in ('FINALIZED','PAYOUT_READY','CLOSED')
  order by period_start desc
  limit 1;

  if found then
    return v_row;
  end if;

  v_start := date_trunc('month', coalesce(p_reference_at,now()));
  v_end := v_start + interval '1 month';
  v_key := coalesce(
    nullif(upper(trim(coalesce(p_period_key,''))),''),
    to_char(v_start at time zone 'UTC','YYYY-MM')
  );

  if exists (
    select 1
    from private.buklod_r38_economic_periods p
    where tstzrange(p.period_start,p.period_end,'[)') &&
          tstzrange(v_start,v_end,'[)')
      and p.status <> 'CLOSED'
  ) then
    raise exception 'No open economic period available for this date';
  end if;

  insert into private.buklod_r38_economic_periods(
    period_key,period_start,period_end,status,currency,policy_version,notes
  ) values (
    v_key,v_start,v_end,'OPEN','PHP','r38_unified_economy_v1',
    'Auto-created by FBC universal finance monitoring'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.fbc_ingest_provider_finance_event_v1(
  p_source_key text,
  p_event_type text,
  p_amount numeric,
  p_currency text,
  p_normalized_amount_php numeric,
  p_financial_state text,
  p_external_reference text,
  p_idempotency_key text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text := coalesce(auth.role(),'');
  v_actor uuid := auth.uid();
  v_source private.buklod_fbc_sources%rowtype;
  v_existing private.buklod_fbc_finance_events%rowtype;
  v_event private.buklod_fbc_finance_events%rowtype;
  v_period private.buklod_r38_economic_periods%rowtype;
  v_ledger private.buklod_r38_financial_entries%rowtype;
  v_type text := upper(trim(coalesce(p_event_type,'')));
  v_state text := upper(trim(coalesce(p_financial_state,'PROVIDER_REPORTED')));
  v_currency text := upper(trim(coalesce(p_currency,'PHP')));
  v_key text := left(trim(coalesce(p_idempotency_key,'')),180);
  v_direction text;
  v_ledger_state text;
begin
  if not (
    v_role='service_role'
    or (v_actor is not null and public.is_system_admin())
  ) then
    raise exception 'Service role or System Admin required';
  end if;

  if v_key='' then raise exception 'Idempotency key is required'; end if;
  if coalesce(p_amount,0) < 0 then raise exception 'Amount cannot be negative'; end if;
  if v_type not in ('REVENUE','COST','FEE','REFUND','TAX','LIABILITY','ADJUSTMENT') then
    raise exception 'Invalid finance event type';
  end if;
  if v_state not in (
    'ESTIMATED','PROVIDER_REPORTED','RECONCILED',
    'SETTLED','EXCLUDED','NEEDS_FX'
  ) then
    raise exception 'Invalid financial state';
  end if;

  select * into v_source
  from private.buklod_fbc_sources
  where source_key = lower(trim(p_source_key));

  if not found then
    raise exception 'Unknown FBC source';
  end if;

  select * into v_existing
  from private.buklod_fbc_finance_events
  where idempotency_key=v_key;

  if found then
    return jsonb_build_object(
      'idempotent_replay',true,
      'event',to_jsonb(v_existing)
    );
  end if;

  insert into private.buklod_fbc_finance_events(
    source_key,event_type,amount,currency,normalized_amount_php,financial_state,
    external_reference,idempotency_key,occurred_at,created_by,metadata
  ) values (
    v_source.source_key,v_type,round(p_amount,6),v_currency,
    case
      when p_normalized_amount_php is null then null
      else round(p_normalized_amount_php,2)
    end,
    v_state,
    nullif(left(trim(coalesce(p_external_reference,'')),200),''),
    v_key,
    coalesce(p_occurred_at,now()),
    v_actor,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into v_event;

  update private.buklod_fbc_sources
  set last_sync_at=now(), last_error=null, updated_at=now()
  where source_key=v_source.source_key;

  if v_state <> 'EXCLUDED'
     and (v_currency='PHP' or p_normalized_amount_php is not null)
     and coalesce(
       p_normalized_amount_php,
       case when v_currency='PHP' then p_amount else null end
     ) is not null
     and v_type <> 'LIABILITY'
  then
    v_period := private.buklod_fbc_find_or_create_open_period_v1(
      null,
      coalesce(p_occurred_at,now())
    );

    v_direction :=
      case
        when v_type in ('REVENUE','ADJUSTMENT') then 'revenue'
        else 'cost'
      end;

    v_ledger_state :=
      case
        when v_state in ('RECONCILED','SETTLED') then 'RECONCILED'
        else 'ESTIMATED'
      end;

    insert into private.buklod_r38_financial_entries(
      period_id,entry_kind,direction,amount,source_system,external_reference,
      idempotency_key,recognized_at,created_by,metadata,
      reconciliation_state,currency,reconciled_at,reconciled_by
    ) values (
      v_period.id,
      case
        when v_direction='revenue'
          then case when v_type='ADJUSTMENT' then 'ADJUSTMENT' else 'REVENUE' end
        when v_type='TAX' then 'TAX_STATUTORY'
        when v_type='REFUND' then 'REFUND_CHARGEBACK'
        else 'OPERATIONAL_COST'
      end,
      v_direction,
      round(coalesce(
        p_normalized_amount_php,
        case when v_currency='PHP' then p_amount else null end
      ),2),
      left(v_source.source_key,80),
      nullif(left(trim(coalesce(p_external_reference,'')),200),''),
      left('fbc:'||v_key,160),
      coalesce(p_occurred_at,now()),
      v_actor,
      jsonb_build_object(
        'fbc_event_id',v_event.id,
        'source_key',v_source.source_key,
        'original_currency',v_currency
      ) || coalesce(p_metadata,'{}'::jsonb),
      v_ledger_state,
      'PHP',
      case when v_ledger_state='RECONCILED' then now() else null end,
      case when v_ledger_state='RECONCILED' then v_actor else null end
    )
    on conflict (idempotency_key) do nothing
    returning * into v_ledger;

    if v_ledger.id is not null then
      update private.buklod_fbc_finance_events
      set ledger_entry_id=v_ledger.id
      where id=v_event.id;

      perform private.buklod_r38_refresh_period_estimates_v1(v_period.id);
    end if;
  end if;

  return jsonb_build_object(
    'idempotent_replay',false,
    'event',to_jsonb(v_event),
    'ledger_entry_id',v_ledger.id
  );
end;
$$;

create or replace function public.admin_fbc_add_manual_finance_entry_v1(
  p_direction text,
  p_amount_php numeric,
  p_category text,
  p_vendor text,
  p_incurred_at timestamptz,
  p_payment_status text,
  p_payment_method text,
  p_app_key text,
  p_external_reference text,
  p_receipt_reference text,
  p_notes text,
  p_period_key text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_direction text := lower(trim(coalesce(p_direction,'')));
  v_status text := upper(trim(coalesce(p_payment_status,'PAID')));
  v_state text;
  v_type text;
begin
  if v_actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if v_direction not in ('revenue','cost') then
    raise exception 'Direction must be revenue or cost';
  end if;

  if coalesce(p_amount_php,0) <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if nullif(trim(coalesce(p_category,'')),'') is null then
    raise exception 'Category is required';
  end if;

  if nullif(trim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'Idempotency key is required';
  end if;

  v_state :=
    case
      when v_status in ('PAID','RECEIVED','SETTLED','RECONCILED')
        then 'RECONCILED'
      else 'ESTIMATED'
    end;

  v_type :=
    case when v_direction='revenue' then 'REVENUE' else 'COST' end;

  return public.fbc_ingest_provider_finance_event_v1(
    'manual',
    v_type,
    p_amount_php,
    'PHP',
    p_amount_php,
    v_state,
    p_external_reference,
    p_idempotency_key,
    coalesce(p_incurred_at,now()),
    jsonb_build_object(
      'manual',true,
      'category',left(trim(p_category),120),
      'vendor',nullif(left(trim(coalesce(p_vendor,'')),160),''),
      'payment_status',v_status,
      'payment_method',nullif(left(trim(coalesce(p_payment_method,'')),80),''),
      'app_key',nullif(left(trim(coalesce(p_app_key,'')),80),''),
      'receipt_reference',
        nullif(left(trim(coalesce(p_receipt_reference,'')),200),''),
      'notes',nullif(left(trim(coalesce(p_notes,'')),2000),''),
      'requested_period_key',
        nullif(upper(trim(coalesce(p_period_key,''))),'')
    )
  );
end;
$$;

create or replace function public.admin_fbc_record_provider_usage_v1(
  p_source_key text,
  p_metric_key text,
  p_metric_name text,
  p_quantity numeric,
  p_unit text,
  p_allowance numeric,
  p_current_cost_php numeric,
  p_projected_quantity numeric,
  p_projected_cost_php numeric,
  p_plan_name text,
  p_provider_status text,
  p_cycle_start timestamptz,
  p_cycle_end timestamptz,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_source private.buklod_fbc_sources%rowtype;
  v_existing private.buklod_fbc_provider_usage%rowtype;
  v_row private.buklod_fbc_provider_usage%rowtype;
  v_warning jsonb;
  v_key text := left(trim(coalesce(p_idempotency_key,'')),180);
begin
  if v_actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  if v_key='' then
    raise exception 'Idempotency key is required';
  end if;

  if nullif(trim(coalesce(p_metric_key,'')),'') is null then
    raise exception 'Metric key is required';
  end if;

  select * into v_source
  from private.buklod_fbc_sources
  where source_key=lower(trim(p_source_key));

  if not found then
    raise exception 'Unknown FBC source';
  end if;

  select * into v_existing
  from private.buklod_fbc_provider_usage
  where idempotency_key=v_key;

  if found then
    return jsonb_build_object(
      'idempotent_replay',true,
      'usage',to_jsonb(v_existing)
    );
  end if;

  v_warning := private.buklod_fbc_warning_level_v1(
    p_quantity,
    p_allowance,
    p_cycle_end,
    p_provider_status,
    v_source.warning_rules
  );

  insert into private.buklod_fbc_provider_usage(
    source_key,metric_key,metric_name,quantity,unit,allowance,current_cost_php,
    projected_quantity,projected_cost_php,plan_name,provider_status,
    cycle_start,cycle_end,warning_level,warning_message,upgrade_recommended,
    idempotency_key,metadata,observed_at,created_by
  ) values (
    v_source.source_key,
    left(trim(p_metric_key),100),
    left(trim(p_metric_name),160),
    coalesce(p_quantity,0),
    left(trim(coalesce(p_unit,'unit')),50),
    p_allowance,
    p_current_cost_php,
    p_projected_quantity,
    p_projected_cost_php,
    nullif(left(trim(coalesce(p_plan_name,'')),120),''),
    nullif(left(trim(coalesce(p_provider_status,'')),80),''),
    p_cycle_start,
    p_cycle_end,
    v_warning->>'level',
    v_warning->>'message',
    coalesce((v_warning->>'upgrade_recommended')::boolean,false),
    v_key,
    coalesce(p_metadata,'{}'::jsonb),
    now(),
    v_actor
  )
  returning * into v_row;

  update private.buklod_fbc_sources
  set
    billing_plan=coalesce(
      nullif(left(trim(coalesce(p_plan_name,'')),120),''),
      billing_plan
    ),
    provider_state=coalesce(
      nullif(upper(trim(coalesce(p_provider_status,''))),''),
      provider_state
    ),
    last_sync_at=now(),
    last_error=null,
    updated_at=now()
  where source_key=v_source.source_key;

  return jsonb_build_object(
    'idempotent_replay',false,
    'usage',to_jsonb(v_row)
  );
end;
$$;

create or replace function public.admin_fbc_set_source_state_v1(
  p_source_key text,
  p_connection_state text,
  p_provider_state text,
  p_approval_state text,
  p_billing_plan text,
  p_last_error text,
  p_metadata jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_row private.buklod_fbc_sources%rowtype;
begin
  if v_actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  update private.buklod_fbc_sources
  set
    connection_state=coalesce(
      nullif(upper(trim(coalesce(p_connection_state,''))),''),
      connection_state
    ),
    provider_state=coalesce(
      nullif(upper(trim(coalesce(p_provider_state,''))),''),
      provider_state
    ),
    approval_state=coalesce(
      nullif(upper(trim(coalesce(p_approval_state,''))),''),
      approval_state
    ),
    billing_plan=coalesce(
      nullif(trim(coalesce(p_billing_plan,'')),''),
      billing_plan
    ),
    last_error=
      case
        when p_last_error is null then last_error
        else nullif(left(trim(p_last_error),1000),'')
      end,
    metadata=
      case
        when p_metadata is null then metadata
        else metadata || p_metadata
      end,
    updated_at=now()
  where source_key=lower(trim(p_source_key))
  returning * into v_row;

  if v_row.source_key is null then
    raise exception 'Unknown FBC source';
  end if;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.admin_fbc_control_center_v1()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_sources jsonb;
  v_events jsonb;
  v_manual jsonb;
  v_finance jsonb;
  v_required integer;
  v_connected integer;
  v_stale integer;
  v_alerts integer;
begin
  if v_actor is null or not public.is_system_admin() then
    raise exception 'System Admin access required';
  end if;

  select
    count(*) filter (where required_for_complete_finance),
    count(*) filter (
      where required_for_complete_finance
        and connection_state in ('CONNECTED','ACTIVE','PARTIAL')
    ),
    count(*) filter (
      where required_for_complete_finance
        and connection_state in ('CONNECTED','ACTIVE','PARTIAL')
        and (
          last_sync_at is null
          or last_sync_at < now()-interval '36 hours'
        )
    )
  into v_required,v_connected,v_stale
  from private.buklod_fbc_sources;

  select coalesce(jsonb_agg(row_data order by display_name),'[]'::jsonb)
  into v_sources
  from (
    select
      jsonb_build_object(
        'source_key',s.source_key,
        'display_name',s.display_name,
        'source_kind',s.source_kind,
        'finance_role',s.finance_role,
        'connection_state',s.connection_state,
        'provider_state',s.provider_state,
        'approval_state',s.approval_state,
        'billing_plan',s.billing_plan,
        'app_key',s.app_key,
        'provider_name',s.provider_name,
        'required',s.required_for_complete_finance,
        'last_sync_at',s.last_sync_at,
        'last_error',s.last_error,
        'metadata',s.metadata,
        'latest_usage',
          case
            when u.id is null then null
            else jsonb_build_object(
              'metric_key',u.metric_key,
              'metric_name',u.metric_name,
              'quantity',u.quantity,
              'unit',u.unit,
              'allowance',u.allowance,
              'usage_percent',
                case
                  when u.allowance is not null and u.allowance>0
                    then round((u.quantity/u.allowance)*100,2)
                  else null
                end,
              'current_cost_php',u.current_cost_php,
              'projected_quantity',u.projected_quantity,
              'projected_cost_php',u.projected_cost_php,
              'plan_name',u.plan_name,
              'provider_status',u.provider_status,
              'cycle_start',u.cycle_start,
              'cycle_end',u.cycle_end,
              'warning_level',u.warning_level,
              'warning_message',u.warning_message,
              'upgrade_recommended',u.upgrade_recommended,
              'observed_at',u.observed_at
            )
          end,
        'event_summary',
          jsonb_build_object(
            'event_count',coalesce(e.event_count,0),
            'normalized_php_total',coalesce(e.normalized_php_total,0),
            'unreconciled_count',coalesce(e.unreconciled_count,0),
            'latest_event_at',e.latest_event_at,
            'currency_totals',coalesce(e.currency_totals,'{}'::jsonb)
          )
      ) as row_data,
      s.display_name
    from private.buklod_fbc_sources s
    left join lateral (
      select *
      from private.buklod_fbc_provider_usage pu
      where pu.source_key=s.source_key
      order by pu.observed_at desc
      limit 1
    ) u on true
    left join lateral (
      select
        count(*) as event_count,
        coalesce(sum(fe.normalized_amount_php),0) as normalized_php_total,
        count(*) filter (
          where fe.financial_state not in ('RECONCILED','SETTLED','EXCLUDED')
        ) as unreconciled_count,
        max(fe.occurred_at) as latest_event_at,
        (
          select coalesce(
            jsonb_object_agg(c.currency,c.total_amount),
            '{}'::jsonb
          )
          from (
            select currency,round(sum(amount),6) as total_amount
            from private.buklod_fbc_finance_events f2
            where f2.source_key=s.source_key
            group by currency
          ) c
        ) as currency_totals
      from private.buklod_fbc_finance_events fe
      where fe.source_key=s.source_key
    ) e on true
  ) x;

  select coalesce(
    jsonb_agg(to_jsonb(e) order by e.occurred_at desc),
    '[]'::jsonb
  )
  into v_events
  from (
    select
      id,source_key,event_type,amount,currency,normalized_amount_php,
      financial_state,external_reference,occurred_at,ledger_entry_id,
      metadata,created_at
    from private.buklod_fbc_finance_events
    order by occurred_at desc
    limit 100
  ) e;

  select jsonb_build_object(
    'manual_event_count',count(*),
    'manual_cost_php',
      coalesce(sum(normalized_amount_php) filter (
        where event_type in ('COST','FEE','REFUND','TAX')
      ),0),
    'manual_revenue_php',
      coalesce(sum(normalized_amount_php) filter (
        where event_type in ('REVENUE','ADJUSTMENT')
      ),0)
  )
  into v_manual
  from private.buklod_fbc_finance_events
  where source_key='manual';

  select jsonb_build_object(
    'normalized_revenue_php',
      coalesce(sum(normalized_amount_php) filter (
        where event_type in ('REVENUE','ADJUSTMENT')
          and financial_state<>'EXCLUDED'
      ),0),
    'normalized_cost_php',
      coalesce(sum(normalized_amount_php) filter (
        where event_type in ('COST','FEE','REFUND','TAX')
          and financial_state<>'EXCLUDED'
      ),0),
    'unreconciled_events',
      count(*) filter (
        where financial_state not in ('RECONCILED','SETTLED','EXCLUDED')
      ),
    'needs_fx_events',
      count(*) filter (
        where normalized_amount_php is null
          and currency<>'PHP'
          and financial_state<>'EXCLUDED'
      ),
    'settled_events',
      count(*) filter (where financial_state='SETTLED')
  )
  into v_finance
  from private.buklod_fbc_finance_events;

  select count(*)
  into v_alerts
  from private.buklod_fbc_sources s
  left join lateral (
    select warning_level
    from private.buklod_fbc_provider_usage pu
    where pu.source_key=s.source_key
    order by pu.observed_at desc
    limit 1
  ) u on true
  where s.connection_state in (
          'NOT_CONNECTED','DEGRADED','INACTIVE','AUTH_EXPIRED'
        )
     or s.provider_state in (
          'FAILED','SUSPENDED','PAYMENT_FAILED','AUTH_EXPIRED','QUOTA_BLOCKED'
        )
     or s.approval_state in ('PENDING','REJECTED','ACTION_REQUIRED')
     or coalesce(u.warning_level,'INFO') in (
          'WARNING','CRITICAL','ACTION_REQUIRED'
        );

  return jsonb_build_object(
    'generated_at',now(),
    'completeness',jsonb_build_object(
      'required_sources',v_required,
      'connected_or_partial_sources',v_connected,
      'stale_sources',v_stale,
      'attention_sources',v_alerts,
      'complete',
        v_required>0
        and v_connected=v_required
        and v_stale=0
        and v_alerts=0
    ),
    'finance_summary',v_finance,
    'sources',v_sources,
    'recent_finance_events',v_events,
    'manual_summary',v_manual
  );
end;
$$;

insert into private.buklod_fbc_sources(
  source_key,display_name,source_kind,finance_role,
  connection_state,provider_state,required_for_complete_finance,
  app_key,provider_name,billing_plan,approval_state,warning_rules,metadata
) values
  ('manual','Manual Entries','MANUAL','BOTH','CONNECTED','ACTIVE',true,
   null,null,null,'ACTIVE',
   '{"watch_percent":70,"warning_percent":85,"critical_percent":95}'::jsonb,
   '{"purpose":"Expenses/revenue without automated provider feed"}'::jsonb),
  ('buklod_main','BUKLOD Main','APP','BOTH','PARTIAL','ACTIVE',true,
   'main',null,null,'ACTIVE','{}'::jsonb,
   '{"finance_feed":"R38 + FBC universal feed"}'::jsonb),
  ('admob','Google AdMob','REVENUE_SOURCE','REVENUE','PARTIAL','ACTIVE',true,
   'main','Google AdMob',null,'ACTIVE','{}'::jsonb,
   '{"status_note":"Impression-level paid-event feed"}'::jsonb),
  ('adsense','Google AdSense','REVENUE_SOURCE','REVENUE','PARTIAL','PENDING_APPROVAL',true,
   'main','Google AdSense',null,'PENDING','{}'::jsonb,
   '{"status_note":"Web approval pending"}'::jsonb),
  ('sponsor_inventory','BUKLOD Sponsor Inventory','REVENUE_SOURCE','REVENUE','PARTIAL','ACTIVE',false,
   'main','BUKLOD',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('quickcheck','QuickCheck','APP','BOTH','CONNECTED','ACTIVE',true,
   'quickcheck',null,null,'ACTIVE','{}'::jsonb,
   '{"finance_feed":"Dedicated wallet/ledger/payment/payout/ad economy"}'::jsonb),
  ('quiz','BUKLOD Quiz','APP','BOTH','PARTIAL','ACTIVE',true,
   'quiz','Supabase',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('classroom','BUKLOD Classroom / Faculty','APP','BOTH','PARTIAL','ACTIVE',true,
   'faculty','Gemini/Stream/Supabase',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('attendance','BUKLOD Attendance','APP','BOTH','INACTIVE','INACTIVE',true,
   'attendance','Supabase',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('report','BUKLOD Report','APP','BOTH','PARTIAL','INTEGRATION_READY',true,
   'report',null,null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('health','BUKLOD Health Center','APP','BOTH','PARTIAL','INTEGRATION_READY',true,
   'health',null,null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('giving','BUKLOD Giving','APP','NON_OPERATING','PARTIAL','ACTIVE',true,
   'giving','Xendit',null,'ACTIVE','{}'::jsonb,
   '{"classification":"Giving is excluded from operating profit"}'::jsonb),
  ('commercial','BUKLOD Commercial / Market','APP','BOTH','PARTIAL','INTEGRATION_READY',true,
   'business','Xendit',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('family','BUKLOD Family','APP','MONITOR_ONLY','PARTIAL','INTEGRATION_READY',false,
   'family',null,null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('local','BUKLOD Local','APP','MONITOR_ONLY','PARTIAL','INTEGRATION_READY',false,
   'government',null,null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('supabase_main','Supabase - Main','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'main','Supabase',null,'ACTIVE',
   '{"watch_percent":70,"warning_percent":85,"critical_percent":95,"renewal_warning_days":14}'::jsonb,
   '{}'::jsonb),
  ('supabase_quiz','Supabase - Quiz','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'quiz','Supabase',null,'ACTIVE',
   '{"watch_percent":70,"warning_percent":85,"critical_percent":95,"renewal_warning_days":14}'::jsonb,
   '{}'::jsonb),
  ('supabase_attendance','Supabase - Attendance','PROVIDER','COST','INACTIVE','INACTIVE',true,
   'attendance','Supabase',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('vercel','Vercel','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'fbc','Vercel',null,'ACTIVE',
   '{"watch_percent":70,"warning_percent":85,"critical_percent":95,"renewal_warning_days":14}'::jsonb,
   '{}'::jsonb),
  ('expo_eas','Expo / EAS','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'main','Expo',null,'ACTIVE',
   '{"watch_percent":70,"warning_percent":85,"critical_percent":95,"renewal_warning_days":14}'::jsonb,
   '{}'::jsonb),
  ('firebase','Firebase / FCM','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'main','Google Firebase',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('stream','Stream Video / Calls','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'classroom','Stream',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('gemini','Google Gemini AI','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'main','Google Gemini',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('xendit','Xendit Payments','PROVIDER','BOTH','PARTIAL','ACTIVE',true,
   'commercial','Xendit',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('google_play','Google Play','PROVIDER','COST','PARTIAL','ACTIVE',true,
   'main','Google Play',null,'ACTIVE','{}'::jsonb,'{}'::jsonb),
  ('maps','Google Maps Platform','PROVIDER','COST','PARTIAL','ACTIVE',false,
   'main','Google Maps',null,'ACTIVE','{}'::jsonb,'{}'::jsonb)
on conflict (source_key) do update
set
  display_name=excluded.display_name,
  source_kind=excluded.source_kind,
  finance_role=excluded.finance_role,
  required_for_complete_finance=excluded.required_for_complete_finance,
  app_key=excluded.app_key,
  provider_name=excluded.provider_name,
  warning_rules=excluded.warning_rules,
  metadata=private.buklod_fbc_sources.metadata || excluded.metadata,
  updated_at=now();

create or replace function private.buklod_fbc_capture_payment_v1(
  p_source_key text,
  p_event_type text,
  p_amount numeric,
  p_currency text,
  p_external_reference text,
  p_idempotency_key text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_source private.buklod_fbc_sources%rowtype;
  v_event private.buklod_fbc_finance_events%rowtype;
  v_period private.buklod_r38_economic_periods%rowtype;
  v_type text := upper(trim(coalesce(p_event_type,'')));
  v_currency text := upper(trim(coalesce(p_currency,'PHP')));
  v_key text := left(trim(coalesce(p_idempotency_key,'')),180);
  v_direction text;
  v_amount_php numeric;
  v_ledger_id uuid;
begin
  if v_key='' then
    raise exception 'Idempotency key required';
  end if;

  if coalesce(p_amount,0)<=0 then
    return null;
  end if;

  select * into v_source
  from private.buklod_fbc_sources
  where source_key=lower(trim(p_source_key));

  if not found then
    raise exception 'Unknown FBC source';
  end if;

  select * into v_event
  from private.buklod_fbc_finance_events
  where idempotency_key=v_key;

  if found then
    return v_event.id;
  end if;

  v_amount_php :=
    case when v_currency='PHP' then round(p_amount,2) else null end;

  insert into private.buklod_fbc_finance_events(
    source_key,event_type,amount,currency,normalized_amount_php,
    financial_state,external_reference,idempotency_key,occurred_at,metadata
  ) values (
    v_source.source_key,
    v_type,
    round(p_amount,6),
    v_currency,
    v_amount_php,
    case when v_currency='PHP' then 'RECONCILED' else 'NEEDS_FX' end,
    nullif(left(trim(coalesce(p_external_reference,'')),200),''),
    v_key,
    coalesce(p_occurred_at,now()),
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning * into v_event;

  update private.buklod_fbc_sources
  set last_sync_at=now(), last_error=null, updated_at=now()
  where source_key=v_source.source_key;

  if v_amount_php is not null and v_type <> 'LIABILITY' then
    v_period := private.buklod_fbc_find_or_create_open_period_v1(
      null,
      coalesce(p_occurred_at,now())
    );

    v_direction :=
      case
        when v_type in ('REVENUE','ADJUSTMENT') then 'revenue'
        else 'cost'
      end;

    insert into private.buklod_r38_financial_entries(
      period_id,entry_kind,direction,amount,source_system,external_reference,
      idempotency_key,recognized_at,metadata,reconciliation_state,
      currency,reconciled_at
    ) values (
      v_period.id,
      case
        when v_direction='revenue'
          then case when v_type='ADJUSTMENT' then 'ADJUSTMENT' else 'REVENUE' end
        when v_type='TAX' then 'TAX_STATUTORY'
        when v_type='REFUND' then 'REFUND_CHARGEBACK'
        else 'OPERATIONAL_COST'
      end,
      v_direction,
      v_amount_php,
      left(v_source.source_key,80),
      nullif(left(trim(coalesce(p_external_reference,'')),200),''),
      left('fbc:'||v_key,160),
      coalesce(p_occurred_at,now()),
      jsonb_build_object(
        'fbc_event_id',v_event.id,
        'source_key',v_source.source_key
      ) || coalesce(p_metadata,'{}'::jsonb),
      'RECONCILED',
      'PHP',
      now()
    )
    on conflict (idempotency_key) do nothing
    returning id into v_ledger_id;

    if v_ledger_id is not null then
      update private.buklod_fbc_finance_events
      set ledger_entry_id=v_ledger_id
      where id=v_event.id;

      perform private.buklod_r38_refresh_period_estimates_v1(v_period.id);
    end if;
  end if;

  return v_event.id;
end;
$$;

create or replace function private.buklod_fbc_capture_scope_product_payment_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.status,'')) in (
       'approved','paid','verified','completed','settled','succeeded'
     )
     and coalesce(new.amount_php,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.status,'')) is distinct from
          lower(coalesce(new.status,''))
       or coalesce(old.amount_php,0) is distinct from coalesce(new.amount_php,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'commercial','REVENUE',new.amount_php,'PHP',
      coalesce(new.gcash_reference,new.id::text),
      'scope-product-payment:'||new.id::text,
      coalesce(new.reviewed_at,new.updated_at,new.created_at,now()),
      jsonb_build_object(
        'table','buklod_scope_product_payments',
        'scope_id',new.scope_id,
        'product_code',new.product_code,
        'status',new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_scope_product_payment_trg
  on public.buklod_scope_product_payments;

create trigger buklod_fbc_scope_product_payment_trg
after insert or update of status,amount_php
on public.buklod_scope_product_payments
for each row
execute function private.buklod_fbc_capture_scope_product_payment_trg();

create or replace function private.buklod_fbc_capture_subscription_payment_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.status,'')) in (
       'approved','paid','verified','completed','settled','succeeded'
     )
     and coalesce(new.amount_php,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.status,'')) is distinct from
          lower(coalesce(new.status,''))
       or coalesce(old.amount_php,0) is distinct from coalesce(new.amount_php,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'commercial','REVENUE',new.amount_php,'PHP',
      coalesce(new.provider_payment_request_id,new.id::text),
      'subscription-payment:'||new.id::text,
      coalesce(new.paid_at,new.created_at,now()),
      jsonb_build_object(
        'table','buklod_subscription_payments',
        'subscription_id',new.subscription_id,
        'cycle_key',new.cycle_key,
        'status',new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_subscription_payment_trg
  on public.buklod_subscription_payments;

create trigger buklod_fbc_subscription_payment_trg
after insert or update of status,amount_php
on public.buklod_subscription_payments
for each row
execute function private.buklod_fbc_capture_subscription_payment_trg();

create or replace function private.buklod_fbc_capture_billing_transaction_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.status,'')) in (
       'approved','paid','verified','completed','settled','succeeded'
     )
     and coalesce(new.amount,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.status,'')) is distinct from
          lower(coalesce(new.status,''))
       or coalesce(old.amount,0) is distinct from coalesce(new.amount,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'commercial','REVENUE',new.amount,coalesce(new.currency,'PHP'),
      coalesce(new.provider_reference_id,new.provider_event_id,new.id::text),
      'billing-transaction:'||new.id::text,
      coalesce(new.paid_at,new.updated_at,new.created_at,now()),
      jsonb_build_object(
        'table','buklod_billing_transactions',
        'scope_id',new.scope_id,
        'provider',new.provider,
        'payment_kind',new.payment_kind,
        'status',new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_billing_transaction_trg
  on public.buklod_billing_transactions;

create trigger buklod_fbc_billing_transaction_trg
after insert or update of status,amount
on public.buklod_billing_transactions
for each row
execute function private.buklod_fbc_capture_billing_transaction_trg();

create or replace function private.buklod_fbc_capture_paid_ad_campaign_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.payment_status,'')) in (
       'approved','paid','verified','completed','settled','succeeded'
     )
     and coalesce(new.amount_paid,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.payment_status,'')) is distinct from
          lower(coalesce(new.payment_status,''))
       or coalesce(old.amount_paid,0) is distinct from coalesce(new.amount_paid,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'sponsor_inventory','REVENUE',new.amount_paid,coalesce(new.currency,'PHP'),
      coalesce(new.payment_reference,new.id::text),
      'sponsor-campaign:'||new.id::text,
      coalesce(new.approved_at,new.updated_at,new.created_at,now()),
      jsonb_build_object(
        'table','buklod_paid_ad_campaigns',
        'advertiser_name',new.advertiser_name,
        'placement',new.placement,
        'coverage_level',new.coverage_level,
        'payment_status',new.payment_status,
        'campaign_status',new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_paid_ad_campaign_trg
  on public.buklod_paid_ad_campaigns;

create trigger buklod_fbc_paid_ad_campaign_trg
after insert or update of payment_status,amount_paid
on public.buklod_paid_ad_campaigns
for each row
execute function private.buklod_fbc_capture_paid_ad_campaign_trg();

create or replace function private.buklod_fbc_capture_giving_transaction_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.status,'')) in (
       'paid','verified','completed','settled','succeeded'
     )
     and coalesce(new.amount,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.status,'')) is distinct from
          lower(coalesce(new.status,''))
       or coalesce(old.amount,0) is distinct from coalesce(new.amount,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'giving','LIABILITY',new.amount,coalesce(new.currency,'PHP'),
      coalesce(new.provider_reference,new.id::text),
      'giving-transaction:'||new.id::text,
      coalesce(new.paid_at,new.updated_at,new.created_at,now()),
      jsonb_build_object(
        'table','giving_transactions',
        'giving_type',new.giving_type,
        'target_scope_id',new.target_scope_id,
        'provider_name',new.provider_name,
        'status',new.status,
        'classification','NON_OPERATING_GIVING'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_giving_transaction_trg
  on public.giving_transactions;

create trigger buklod_fbc_giving_transaction_trg
after insert or update of status,amount
on public.giving_transactions
for each row
execute function private.buklod_fbc_capture_giving_transaction_trg();

create or replace function private.buklod_fbc_capture_tithe_submission_trg()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if lower(coalesce(new.status,'')) in (
       'verified','paid','approved','completed','settled'
     )
     and coalesce(new.amount,0)>0
     and (
       tg_op='INSERT'
       or lower(coalesce(old.status,'')) is distinct from
          lower(coalesce(new.status,''))
       or coalesce(old.amount,0) is distinct from coalesce(new.amount,0)
     )
  then
    perform private.buklod_fbc_capture_payment_v1(
      'giving','LIABILITY',new.amount,'PHP',
      coalesce(new.reference_number,new.id::text),
      'tithe-submission:'||new.id::text,
      coalesce(new.verified_at,new.updated_at,new.created_at,now()),
      jsonb_build_object(
        'table','tithe_submissions',
        'giving_type',new.giving_type,
        'church_id',new.church_id,
        'status',new.status,
        'classification','NON_OPERATING_GIVING'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists buklod_fbc_tithe_submission_trg
  on public.tithe_submissions;

create trigger buklod_fbc_tithe_submission_trg
after insert or update of status,amount
on public.tithe_submissions
for each row
execute function private.buklod_fbc_capture_tithe_submission_trg();

grant execute on function public.fbc_ingest_provider_finance_event_v1(
  text,text,numeric,text,numeric,text,text,text,timestamptz,jsonb
) to authenticated, service_role;

grant execute on function public.admin_fbc_add_manual_finance_entry_v1(
  text,numeric,text,text,timestamptz,text,text,text,text,text,text,text,text
) to authenticated;

grant execute on function public.admin_fbc_record_provider_usage_v1(
  text,text,text,numeric,text,numeric,numeric,numeric,numeric,
  text,text,timestamptz,timestamptz,text,jsonb
) to authenticated;

grant execute on function public.admin_fbc_set_source_state_v1(
  text,text,text,text,text,text,jsonb
) to authenticated;

grant execute on function public.admin_fbc_control_center_v1()
to authenticated;

-- Idempotent backfill: only already-successful canonical payment/giving rows.
select private.buklod_fbc_capture_payment_v1(
  'commercial','REVENUE',amount_php,'PHP',
  coalesce(gcash_reference,id::text),
  'scope-product-payment:'||id::text,
  coalesce(reviewed_at,updated_at,created_at,now()),
  jsonb_build_object(
    'table','buklod_scope_product_payments',
    'scope_id',scope_id,
    'product_code',product_code,
    'status',status
  )
)
from public.buklod_scope_product_payments
where lower(coalesce(status,'')) in (
  'approved','paid','verified','completed','settled','succeeded'
)
and coalesce(amount_php,0)>0;

select private.buklod_fbc_capture_payment_v1(
  'commercial','REVENUE',amount_php,'PHP',
  coalesce(provider_payment_request_id,id::text),
  'subscription-payment:'||id::text,
  coalesce(paid_at,created_at,now()),
  jsonb_build_object(
    'table','buklod_subscription_payments',
    'subscription_id',subscription_id,
    'cycle_key',cycle_key,
    'status',status
  )
)
from public.buklod_subscription_payments
where lower(coalesce(status,'')) in (
  'approved','paid','verified','completed','settled','succeeded'
)
and coalesce(amount_php,0)>0;

select private.buklod_fbc_capture_payment_v1(
  'commercial','REVENUE',amount,coalesce(currency,'PHP'),
  coalesce(provider_reference_id,provider_event_id,id::text),
  'billing-transaction:'||id::text,
  coalesce(paid_at,updated_at,created_at,now()),
  jsonb_build_object(
    'table','buklod_billing_transactions',
    'scope_id',scope_id,
    'provider',provider,
    'payment_kind',payment_kind,
    'status',status
  )
)
from public.buklod_billing_transactions
where lower(coalesce(status,'')) in (
  'approved','paid','verified','completed','settled','succeeded'
)
and coalesce(amount,0)>0;

select private.buklod_fbc_capture_payment_v1(
  'sponsor_inventory','REVENUE',amount_paid,coalesce(currency,'PHP'),
  coalesce(payment_reference,id::text),
  'sponsor-campaign:'||id::text,
  coalesce(approved_at,updated_at,created_at,now()),
  jsonb_build_object(
    'table','buklod_paid_ad_campaigns',
    'advertiser_name',advertiser_name,
    'placement',placement,
    'payment_status',payment_status,
    'campaign_status',status
  )
)
from public.buklod_paid_ad_campaigns
where lower(coalesce(payment_status,'')) in (
  'approved','paid','verified','completed','settled','succeeded'
)
and coalesce(amount_paid,0)>0;

select private.buklod_fbc_capture_payment_v1(
  'giving','LIABILITY',amount,coalesce(currency,'PHP'),
  coalesce(provider_reference,id::text),
  'giving-transaction:'||id::text,
  coalesce(paid_at,updated_at,created_at,now()),
  jsonb_build_object(
    'table','giving_transactions',
    'giving_type',giving_type,
    'target_scope_id',target_scope_id,
    'provider_name',provider_name,
    'status',status,
    'classification','NON_OPERATING_GIVING'
  )
)
from public.giving_transactions
where lower(coalesce(status,'')) in (
  'paid','verified','completed','settled','succeeded'
)
and coalesce(amount,0)>0;

select private.buklod_fbc_capture_payment_v1(
  'giving','LIABILITY',amount,'PHP',
  coalesce(reference_number,id::text),
  'tithe-submission:'||id::text,
  coalesce(verified_at,updated_at,created_at,now()),
  jsonb_build_object(
    'table','tithe_submissions',
    'giving_type',giving_type,
    'church_id',church_id,
    'status',status,
    'classification','NON_OPERATING_GIVING'
  )
)
from public.tithe_submissions
where lower(coalesce(status,'')) in (
  'verified','paid','approved','completed','settled'
)
and coalesce(amount,0)>0;
