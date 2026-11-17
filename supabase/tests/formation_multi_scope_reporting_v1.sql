-- Safe, read-only regression proof for Formation report projection.
-- No synthetic awards/submissions; all assertions use live schema/contracts.
begin;
do $test$
declare
  v_example record;
  v_clusters integer;
begin
  if to_regprocedure('public.buklod_formation_reports_member_v1(uuid,uuid)') is null then
    raise exception 'Missing Formation reporting projection helper';
  end if;
  if to_regprocedure('public.buklod_resolve_auto_submission_scope_v1(text,uuid)') is null then
    raise exception 'Missing canonical Formation validation scope resolver';
  end if;
  if has_function_privilege('anon','public.buklod_formation_reports_member_v1(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.buklod_formation_reports_member_v1(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon','public.buklod_resolve_auto_submission_scope_v1(text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.buklod_resolve_auto_submission_scope_v1(text,uuid)','EXECUTE')
  then
    raise exception 'Internal Formation scope helpers exposed to clients';
  end if;
  if public.buklod_formation_reports_member_v1(null::uuid,null::uuid)
    or public.buklod_formation_reports_member_v1('00000000-0000-0000-0000-000000000000'::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
  then
    raise exception 'Null/nonmember scope was allowed';
  end if;

  -- Exercise real multi-membership semantics only when a legitimate fixture
  -- exists in this environment. No hardcoded person or personal data.
  select m.user_id, min(m.scope_id::text)::uuid as cluster_id
  into v_example
  from public.buklod_scope_memberships m
  join public.buklod_scopes s on s.id=m.scope_id
  where m.membership_status='ACTIVE'
    and s.scope_type='CLUSTER'
    and s.status not in ('SUSPENDED','DELETED')
  group by m.user_id
  having count(distinct m.scope_id) >= 2
  order by count(distinct m.scope_id) desc, m.user_id
  limit 1;

  if v_example.user_id is not null then
    select count(distinct m.scope_id) into v_clusters
    from public.buklod_scope_memberships m
    join public.buklod_scopes s on s.id=m.scope_id
    where m.user_id=v_example.user_id
      and m.membership_status='ACTIVE'
      and s.scope_type='CLUSTER'
      and s.status not in ('SUSPENDED','DELETED')
      and public.buklod_formation_reports_member_v1(m.scope_id,v_example.user_id);
    if v_clusters < 2 then
      raise exception 'Multi-Cluster member history not visible in all active Clusters';
    end if;
    if public.buklod_resolve_auto_submission_scope_v1('DAILY_READING',v_example.user_id) is null then
      raise exception 'Multi-Cluster Daily Reading lacks a deterministic processing anchor';
    end if;
  end if;
end
$test$;
rollback;
