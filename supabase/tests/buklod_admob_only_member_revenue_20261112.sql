-- Run AFTER both official identity + AdMob-only migrations, rollback-only.
-- Verify sponsor/revenue partition and cash eligibility without paying users.
begin;
do $test$
declare
  v_uid uuid;
  v_report jsonb;
  v_r38 private.buklod_r38_economic_periods%rowtype;
  v_before bigint;
  v_after bigint;
  v_open_qmp bigint;
begin
  select user_id into v_uid from private.buklod_official_identity_snapshot_v1
    where principal_key='OFFICIAL_SYSTEM_ADMIN';
  if v_uid is null then raise exception 'Official identity migration not applied'; end if;
  if not private.buklod_is_verified_admob_source_v1('OFFICIAL_ADMOB_API')
    or not private.buklod_is_verified_admob_source_v1('admob_verified')
    or private.buklod_is_verified_admob_source_v1('sponsor_inventory')
    or private.buklod_is_verified_admob_source_v1('manual_admin')
  then raise exception 'AdMob source categorization failed'; end if;

  select * into v_r38 from private.buklod_r38_economic_periods
    where period_key='2026-11';
  if v_r38.id is null then raise exception 'November source period missing'; end if;

  if not exists(select 1 from private.buklod_r38_financial_entries
      where period_id=v_r38.id and direction='revenue'
        and reconciliation_state='RECONCILED'
        and not private.buklod_is_verified_admob_source_v1(source_system))
  then raise exception 'Expected independent other-app sponsorship audit source'; end if;

  if v_r38.estimated_distributable_base <> 0 or v_r38.estimated_bayanihan_pool <> 0
  then raise exception 'Sponsor receipts leaked into old R38 user pool preview'; end if;

  -- Direct SQL and old clients must not insert non-AdMob cash-eligible revenue.
  select count(*) into v_before from private.buklod_pf_financial_entries;
  begin
    insert into private.buklod_pf_financial_entries(
      period_key,entry_type,direction,amount_centavos,reconciliation_state,
      source_system,external_reference,idempotency_key,recorded_by
    ) values (
      '2026-11','UNATTRIBUTED_ELIGIBLE_REVENUE','CREDIT',99900,'RECONCILED',
      'sponsor_inventory','sponsor-not-admob','admob-only-sponsor-reject',v_uid
    );
    raise exception 'Sponsor as user cash was not rejected';
  exception when check_violation then null;
  end;
  select count(*) into v_after from private.buklod_pf_financial_entries;
  if v_before<>v_after then raise exception 'Rejected sponsor was written to Finance';end if;

  perform set_config('request.jwt.claim.sub',v_uid::text,true);
  v_report:=public.admin_get_buklod_canonical_economy_snapshot_v1('2026-11');
  if v_report->'revenue_sources'->>'member_distribution_source'<>'RECONCILED_ADMOB_ONLY'
     or v_report->'revenue_sources'->>'other_app_excluded_from_user_pool'<>'true'
     or (v_report->'revenue_sources'->>'other_app_reconciled_revenue_php')::numeric <= 0
     or (v_report->'revenue_sources'->>'admob_reconciled_finance_journal_php')::numeric <> 0
     or (v_report->'revenue_sources'->>'admob_finalized_provider_value_php')::numeric <> 0
  then raise exception 'Canonical revenue source separation failed: %',v_report->'revenue_sources';end if;
  if (v_report->'admob_provisional'->>'amount_minor')::integer <= 0
     or v_report->'finance'->'settlement' <> 'null'::jsonb then
    raise exception 'Provider estimate falsely treated as finalized user cash';
  end if;

  -- A preexisting QMP on the protected official account is historical only;
  -- it must not enter eligibility denominator or current readiness.
  select coalesce(sum(a.qualified_qmp),0)::bigint into v_open_qmp
    from private.buklod_community_qmp_accounts a
    join private.buklod_community_settlement_periods cp
      on cp.id=a.settlement_period_id
    where cp.period_key='2026-11'
      and not private.buklod_is_platform_official_v1(a.user_id);
  if coalesce((v_report->'qmp'->>'qualified_monthly_qmp')::bigint,-1) <> v_open_qmp
  then raise exception 'Official QMP not excluded from the current month';end if;
end $test$;
rollback;
