-- BUKLOD Formation feedback stale scope-column repair R1
-- Removes invalid buklod_scopes.show_faith_content references while preserving
-- scope existence, membership, and exact-scope admin authorization.

create or replace function public.upsert_buklod_scope_faith_monitoring_feedback_v1(
  p_scope_id uuid,
  p_target_user_id uuid default null::uuid,
  p_headline text default null::text,
  p_message text default ''::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_headline text := nullif(trim(coalesce(p_headline, '')), '');
  v_message text := trim(coalesce(p_message, ''));
  v_row public.buklod_scope_faith_monitoring_feedback_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_is_exact_scope_admin_v1(p_scope_id) then
    raise exception 'Exact-scope admin access required';
  end if;

  perform 1
  from public.buklod_scopes s
  where s.id = p_scope_id
    and coalesce(s.status::text, 'ACTIVE') <> 'DELETED';

  if not found then
    raise exception 'Scope not found';
  end if;

  if p_target_user_id is not null then
    if not exists (
      select 1
      from public.buklod_scope_memberships m
      where m.scope_id = p_scope_id
        and m.user_id = p_target_user_id
        and m.membership_status = 'ACTIVE'
    ) then
      raise exception 'Selected member is not active in this scope';
    end if;
  end if;

  if p_target_user_id is null then
    insert into public.buklod_scope_faith_monitoring_feedback_items (
      scope_id,target_user_id,headline,message,updated_by,updated_at
    )
    values (
      p_scope_id,null,v_headline,v_message,auth.uid(),now()
    )
    on conflict (scope_id)
      where target_user_id is null
    do update set
      headline=excluded.headline,
      message=excluded.message,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
    returning * into v_row;
  else
    insert into public.buklod_scope_faith_monitoring_feedback_items (
      scope_id,target_user_id,headline,message,updated_by,updated_at
    )
    values (
      p_scope_id,p_target_user_id,v_headline,v_message,auth.uid(),now()
    )
    on conflict (scope_id,target_user_id)
      where target_user_id is not null
    do update set
      headline=excluded.headline,
      message=excluded.message,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'id',v_row.id,
    'scope_id',v_row.scope_id,
    'target_user_id',v_row.target_user_id,
    'headline',v_row.headline,
    'message',coalesce(v_row.message,''),
    'updated_at',v_row.updated_at,
    'updated_by',v_row.updated_by
  );
end;
$function$;

create or replace function public.buklod_scope_faith_monitoring_feedback_admin_list_v1(
  p_scope_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_is_exact_scope_admin_v1(p_scope_id) then
    raise exception 'Exact-scope admin access required';
  end if;

  perform 1
  from public.buklod_scopes s
  where s.id=p_scope_id
    and coalesce(s.status::text,'ACTIVE') <> 'DELETED';

  if not found then
    raise exception 'Scope not found';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',f.id,
          'scope_id',f.scope_id,
          'target_user_id',f.target_user_id,
          'target_name',coalesce(p.full_name,p.username,'Member'),
          'headline',f.headline,
          'message',coalesce(f.message,''),
          'updated_at',f.updated_at,
          'updated_by',f.updated_by
        )
        order by f.updated_at desc
      )
      from public.buklod_scope_faith_monitoring_feedback_items f
      left join public.profiles p on p.id=f.target_user_id
      where f.scope_id=p_scope_id
    ),
    '[]'::jsonb
  );
end;
$function$;

create or replace function public.buklod_scope_faith_monitoring_feedback_for_member_v1(
  p_scope_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_general jsonb := null;
  v_personal jsonb := null;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_scope_can_access_v1(p_scope_id) then
    raise exception 'Active membership required for this scope';
  end if;

  perform 1
  from public.buklod_scopes s
  where s.id=p_scope_id
    and coalesce(s.status::text,'ACTIVE') <> 'DELETED';

  if not found then
    raise exception 'Scope not found';
  end if;

  select jsonb_build_object(
    'id',f.id,
    'scope_id',f.scope_id,
    'target_user_id',f.target_user_id,
    'headline',f.headline,
    'message',coalesce(f.message,''),
    'updated_at',f.updated_at,
    'updated_by',f.updated_by
  )
  into v_general
  from public.buklod_scope_faith_monitoring_feedback_items f
  where f.scope_id=p_scope_id
    and f.target_user_id is null
    and (
      coalesce(nullif(trim(f.headline),''),'') <> ''
      or coalesce(nullif(trim(f.message),''),'') <> ''
    )
  limit 1;

  select jsonb_build_object(
    'id',f.id,
    'scope_id',f.scope_id,
    'target_user_id',f.target_user_id,
    'headline',f.headline,
    'message',coalesce(f.message,''),
    'updated_at',f.updated_at,
    'updated_by',f.updated_by
  )
  into v_personal
  from public.buklod_scope_faith_monitoring_feedback_items f
  where f.scope_id=p_scope_id
    and f.target_user_id=auth.uid()
    and (
      coalesce(nullif(trim(f.headline),''),'') <> ''
      or coalesce(nullif(trim(f.message),''),'') <> ''
    )
  limit 1;

  return jsonb_build_object(
    'scope_id',p_scope_id,
    'general',v_general,
    'personal',v_personal
  );
end;
$function$;

revoke all on function public.upsert_buklod_scope_faith_monitoring_feedback_v1(uuid,uuid,text,text) from public,anon;
revoke all on function public.buklod_scope_faith_monitoring_feedback_admin_list_v1(uuid) from public,anon;
revoke all on function public.buklod_scope_faith_monitoring_feedback_for_member_v1(uuid) from public,anon;

grant execute on function public.upsert_buklod_scope_faith_monitoring_feedback_v1(uuid,uuid,text,text) to authenticated,service_role;
grant execute on function public.buklod_scope_faith_monitoring_feedback_admin_list_v1(uuid) to authenticated,service_role;
grant execute on function public.buklod_scope_faith_monitoring_feedback_for_member_v1(uuid) to authenticated,service_role;

notify pgrst,'reload schema';
