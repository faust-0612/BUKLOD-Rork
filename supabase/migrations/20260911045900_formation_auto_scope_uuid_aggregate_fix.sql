-- Fix PostgreSQL installations where min(uuid) is unavailable.
-- This must run before the daily Formation pipeline repair migration.

create or replace function public.buklod_resolve_auto_submission_scope_v1(
  p_feature_key text,
  p_user_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_scope uuid;
  v_count integer;
begin
  if p_user_id is null then return null; end if;

  if auth.uid() = p_user_id then
    v_scope := public.buklod_get_formation_entry_scope_v1(p_feature_key);
    if v_scope is not null and public.buklod_user_is_active_scope_member(v_scope,p_user_id) then
      return v_scope;
    end if;
  end if;

  select count(distinct s.id), min(s.id::text)::uuid
  into v_count, v_scope
  from public.buklod_scopes s
  join public.buklod_scope_role_assignments ra on ra.scope_id=s.id
  where ra.user_id=p_user_id
    and ra.status='ACTIVE'
    and s.scope_type='CLUSTER'
    and s.status not in ('SUSPENDED','DELETED')
    and public.buklod_user_is_active_scope_member(s.id,p_user_id);

  if v_count=1 then return v_scope; end if;
  return null;
end;
$function$;

revoke all on function public.buklod_resolve_auto_submission_scope_v1(text,uuid) from anon;
grant execute on function public.buklod_resolve_auto_submission_scope_v1(text,uuid) to authenticated;
