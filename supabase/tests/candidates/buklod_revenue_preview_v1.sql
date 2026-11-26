-- DEV candidate only: read-only arithmetic; no cash ledger writes.
-- Apply through a reviewed migration after staging database tests.
create or replace function private.buklod_revenue_preview_pools_v1(p_gross_minor bigint)
returns jsonb language plpgsql immutable security invoker set search_path to '' as $$
declare
  q bigint;
  c bigint;
begin
  if p_gross_minor is null or p_gross_minor < 0 then
    raise exception 'Nonnegative official revenue required';
  end if;
  q := floor(p_gross_minor::numeric * 3000 / 10000)::bigint;
  c := floor(p_gross_minor::numeric * 150 / 10000)::bigint;
  return jsonb_build_object('gross_minor',p_gross_minor,
    'qmp_pool_minor',q,'cluster_pool_minor',c,
    'retained_before_other_costs_minor',p_gross_minor-q-c,
    'withdrawable',false);
end;
$$;
revoke all on function private.buklod_revenue_preview_pools_v1(bigint) from public,anon,authenticated;
grant execute on function private.buklod_revenue_preview_pools_v1(bigint) to service_role;

-- Read-only current month preview, with scope attribution at qualified event time.
-- An unmatched or ambiguous designation is excluded from cluster weights.
create or replace function public.get_buklod_cluster_revenue_preview_v1(p_scope_id uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  actor uuid := auth.uid();
  period text := to_char(now() at time zone 'Asia/Manila','YYYY-MM');
  snapshot private.buklod_community_admob_estimate_snapshots%rowtype;
  cp private.buklod_community_settlement_periods%rowtype;
  total_qmp bigint;
  scope_qmp bigint;
  pool bigint;
  share bigint;
begin
  if actor is null or p_scope_id is null or not public.buklod_scope_can_access_v1(p_scope_id,actor) then
    raise exception 'Active scope membership required';
  end if;
  if not exists(select 1 from public.buklod_scopes s where s.id=p_scope_id and s.scope_type='CLUSTER' and s.status='ACTIVE') then
    raise exception 'Active cluster required';
  end if;
  select * into snapshot from private.buklod_community_admob_estimate_snapshots s where s.period_key=period;
  select * into cp from private.buklod_community_settlement_periods s where s.period_key=period;
  if snapshot.period_key is null or snapshot.source_mode <> 'OFFICIAL_ADMOB_API' or snapshot.observed_at < now()-interval '3 hours' or cp.id is null or cp.status <> 'OPEN' then
    return jsonb_build_object('status','UNAVAILABLE','period_key',period,'estimated_cluster_minor',null,'withdrawable',false);
  end if;
  total_qmp := private.buklod_pf_total_monthly_qmp_v1(cp.starts_at,cp.ends_at);
  -- Use account-level qualified QMP cap to ensure event weighting cannot exceed the canonical denominator.
  with eligible as (
    select a.user_id,l.person_id,a.qualified_qmp
    from private.buklod_community_qmp_accounts a
    join private.buklod_pf_user_links l on l.user_id=a.user_id
    join private.buklod_pf_persons p on p.person_id=l.person_id
    join public.profiles pr on pr.id=p.current_user_id
    where a.settlement_period_id=cp.id and a.qualified_qmp>0
      and p.risk_status='CLEAR' and pr.is_active=true and pr.user_deactivated_at is null
      and not private.buklod_is_platform_official_v1(a.user_id)
  ), weighted as (
    select a.user_id, a.qualified_qmp,
      coalesce(sum(e.total_qmp) filter (where d.matches=1 and d.scope_id=p_scope_id),0) as scoped,
      coalesce(sum(e.total_qmp),0) as all_events
    from eligible a
    join private.buklod_community_qmp_events e on e.user_id=a.user_id and e.settlement_period_id=cp.id and e.state='QUALIFIED' and e.total_qmp>0
    left join lateral (
      select count(*) as matches, (array_agg(x.scope_id order by x.scope_id))[1] as scope_id
      from private.buklod_pf_community_designations x
      where x.person_id=a.person_id and x.effective_from<=e.created_at and (x.effective_to is null or x.effective_to>e.created_at)
    ) d on true
    group by a.user_id,a.qualified_qmp
  )
  select coalesce(sum(floor(least(qualified_qmp,all_events)::numeric * scoped / nullif(all_events,0))),0)::bigint into scope_qmp from weighted;
  if scope_qmp>total_qmp then raise exception 'Cluster QMP does not reconcile'; end if;
  pool := (private.buklod_revenue_preview_pools_v1(snapshot.amount_minor)->>'cluster_pool_minor')::bigint;
  share := case when total_qmp>0 then floor(pool::numeric*scope_qmp/total_qmp)::bigint else 0 end;
  return jsonb_build_object('status','PRELIMINARY_ONLY','period_key',period,'estimated_cluster_minor',share,'observed_at',snapshot.observed_at,'withdrawable',false);
end;
$$;
revoke all on function public.get_buklod_cluster_revenue_preview_v1(uuid) from public,anon;
grant execute on function public.get_buklod_cluster_revenue_preview_v1(uuid) to authenticated;

-- Arithmetic smoke checks (execute on staging only).
do $$
begin
  if private.buklod_revenue_preview_pools_v1(6205) <> jsonb_build_object('gross_minor',6205,'qmp_pool_minor',1861,'cluster_pool_minor',93,'retained_before_other_costs_minor',4251,'withdrawable',false) then
    raise exception 'Revenue allocation mismatch';
  end if;
  if (private.buklod_revenue_preview_pools_v1(0)->>'cluster_pool_minor')::bigint <> 0 then
    raise exception 'Zero revenue mismatch';
  end if;
end;
$$;
