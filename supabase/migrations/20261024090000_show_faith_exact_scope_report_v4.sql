-- Show Faith report privacy: exact scope leadership only.
-- Keep v1-v3 callable internally by their SECURITY DEFINER owner, not directly by clients.
create or replace function public.buklod_scope_faith_monitoring_summary_v4(p_scope_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null or p_scope_id is null then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.buklod_scopes s
    where s.id = p_scope_id
      and s.scope_type in ('CLUSTER', 'ORGANIZATION')
      and s.status not in ('SUSPENDED', 'DELETED')
  ) or not (
    public.buklod_is_exact_scope_admin_v1(p_scope_id, auth.uid())
    or (
      exists (
        select 1 from public.buklod_scopes s
        where s.id = p_scope_id and s.scope_type = 'CLUSTER'
      )
      and public.buklod_is_cluster_approver(p_scope_id, auth.uid())
    )
  ) then
    raise exception 'Not authorized to view this scope report' using errcode = '42501';
  end if;

  return public.buklod_scope_faith_monitoring_summary_v3(p_scope_id);
end;
$function$;

revoke all on function public.buklod_scope_faith_monitoring_summary_v1(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v2(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v3(uuid) from public, anon, authenticated;
revoke all on function public.buklod_scope_faith_monitoring_summary_v4(uuid) from public, anon;
grant execute on function public.buklod_scope_faith_monitoring_summary_v4(uuid) to authenticated, service_role;
