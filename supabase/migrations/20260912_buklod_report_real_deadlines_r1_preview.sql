-- Read-only preview used by admins before publishing a real deadline.

create or replace function public.buklod_report_deadline_preview_v1(
  p_definition_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_definition public.buklod_report_definitions%rowtype;
  v_scope public.buklod_scopes%rowtype;
  v_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if p_definition_id is null then
    raise exception 'Report definition is required';
  end if;

  select * into v_definition
  from public.buklod_report_definitions d
  where d.id = p_definition_id;

  if not found then
    raise exception 'Report definition not found';
  end if;

  perform public.buklod_report_assert_definition_admin_v1(v_definition.scope_id);

  select * into v_scope
  from public.buklod_scopes s
  where s.id = v_definition.scope_id
    and upper(s.scope_type::text) in ('ORGANIZATION', 'CLUSTER')
    and coalesce(s.status::text, 'ACTIVE') not in ('DELETED', 'ARCHIVED');

  if not found then
    raise exception 'Organization or Cluster scope not found';
  end if;

  select count(distinct m.user_id)::integer into v_count
  from public.buklod_scope_memberships m
  where m.scope_id = v_definition.scope_id
    and m.membership_status = 'ACTIVE'
    and m.user_id is not null
    and m.left_at is null;

  return jsonb_build_object(
    'ok', true,
    'scope_id', v_definition.scope_id,
    'scope_name', v_scope.name,
    'scope_type', upper(v_scope.scope_type::text),
    'report_definition_id', v_definition.id,
    'report_title', v_definition.title,
    'eligible_member_count', v_count,
    'audience_mode', 'ALL_ACTIVE_SCOPE_MEMBERS',
    'membership_snapshot_on_publish', true
  );
end;
$function$;

grant execute on function public.buklod_report_deadline_preview_v1(uuid) to authenticated;
