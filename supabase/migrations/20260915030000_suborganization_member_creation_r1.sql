-- BUKLOD Main: Create Sub access for active Organization members.
-- Source-only migration. Do not apply to production without release authorization.
-- Canonical rule: any authenticated ACTIVE member of the root parent Organization
-- may create a structural Sub-organization. No payment/premium gate is involved.

create or replace function public.buklod_can_create_suborganization_v2(
  p_parent_scope_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.buklod_scopes s
      where s.id = p_parent_scope_id
        and s.scope_type = 'ORGANIZATION'
        and s.parent_scope_id is null
        and s.status in ('ACTIVE', 'RESTRICTED')
    )
    and (
      public.buklod_is_system_admin()
      or public.buklod_scope_has_active_membership_v1(
        p_parent_scope_id,
        auth.uid()
      )
    );
$function$;

revoke all on function public.buklod_can_create_suborganization_v2(uuid) from public, anon;
grant execute on function public.buklod_can_create_suborganization_v2(uuid) to authenticated, service_role;

create or replace function public.buklod_list_suborganizations_v2(
  p_parent_scope_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  scope_id uuid,
  name text,
  status text,
  visibility text,
  parent_scope_id uuid,
  description text,
  organization_type text,
  member_count bigint,
  admin_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.buklod_can_create_suborganization_v2(p_parent_scope_id) then
    raise exception 'Active parent Organization membership required';
  end if;

  return query
  select
    s.id,
    s.name::text,
    s.status::text,
    s.visibility::text,
    s.parent_scope_id,
    coalesce(
      nullif(btrim(s.description), ''),
      nullif(btrim(coalesce(s.metadata ->> 'description', '')), '')
    )::text,
    coalesce(s.metadata ->> 'organization_type', 'OTHER')::text,
    (
      select count(*)
      from public.buklod_scope_memberships m
      where m.scope_id = s.id
        and m.membership_status = 'ACTIVE'
    )::bigint,
    (
      select count(*)
      from public.buklod_scope_role_assignments ra
      where ra.scope_id = s.id
        and ra.role_key = 'ORG_ADMIN'
        and ra.status = 'ACTIVE'
    )::bigint,
    s.created_at
  from public.buklod_scopes s
  where s.scope_type = 'ORGANIZATION'
    and s.parent_scope_id = p_parent_scope_id
    and s.status <> 'DELETED'
  order by lower(s.name), s.created_at
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$function$;

revoke all on function public.buklod_list_suborganizations_v2(uuid,integer,integer) from public, anon;
grant execute on function public.buklod_list_suborganizations_v2(uuid,integer,integer) to authenticated, service_role;

create or replace function public.buklod_create_suborganization_v2(
  p_parent_scope_id uuid,
  p_name text,
  p_description text default null,
  p_visibility text default null,
  p_join_policy text default null,
  p_organization_type text default null,
  p_profile jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_parent public.buklod_scopes%rowtype;
  v_child_id uuid;
  v_name text := nullif(btrim(p_name), '');
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_visibility text;
  v_join text;
  v_parent_type text;
  v_child_type text;
  v_slug text;
  v_profile jsonb := coalesce(p_profile, '{}'::jsonb);
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if v_name is null then
    raise exception 'Sub-organization name is required';
  end if;

  select *
    into v_parent
  from public.buklod_scopes s
  where s.id = p_parent_scope_id
    and s.scope_type = 'ORGANIZATION'
    and s.status in ('ACTIVE', 'RESTRICTED');

  if not found then
    raise exception 'Parent Organization not found';
  end if;

  if v_parent.parent_scope_id is not null then
    raise exception 'Only a root Organization can create a direct Sub-organization';
  end if;

  if not public.buklod_can_create_suborganization_v2(p_parent_scope_id) then
    raise exception 'Active parent Organization membership required';
  end if;

  if exists (
    select 1
    from public.buklod_scopes s
    where s.scope_type = 'ORGANIZATION'
      and s.parent_scope_id = p_parent_scope_id
      and lower(btrim(s.name)) = lower(btrim(v_name))
      and s.status <> 'DELETED'
  ) then
    raise exception 'A Sub-organization with this display name already exists under this parent Organization';
  end if;

  v_visibility := upper(
    coalesce(
      nullif(btrim(p_visibility), ''),
      v_parent.visibility::text,
      'PUBLIC'
    )
  );

  if v_visibility not in ('PUBLIC', 'PRIVATE') then
    raise exception 'Invalid visibility';
  end if;

  v_join := upper(
    coalesce(
      nullif(btrim(p_join_policy), ''),
      coalesce(v_parent.metadata ->> 'join_policy', 'APPROVAL_REQUIRED')
    )
  );

  if v_visibility = 'PRIVATE' then
    v_join := 'INVITE_ONLY';
  elsif v_join not in ('OPEN', 'APPROVAL_REQUIRED', 'INVITE_ONLY') then
    raise exception 'Invalid join policy';
  end if;

  v_parent_type := coalesce(
    nullif(btrim(v_parent.metadata ->> 'organization_type'), ''),
    'OTHER'
  );

  v_child_type := upper(
    coalesce(
      nullif(btrim(p_organization_type), ''),
      nullif(btrim(v_profile ->> 'organization_type'), ''),
      v_parent_type
    )
  );

  v_slug := trim(
    both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );

  if v_slug = '' then
    v_slug := 'sub-organization';
  end if;

  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.buklod_scopes (
    scope_type,
    name,
    slug,
    description,
    status,
    visibility,
    parent_scope_id,
    created_by,
    logo_url,
    cover_url,
    metadata
  )
  values (
    'ORGANIZATION',
    v_name,
    v_slug,
    v_description,
    'ACTIVE',
    v_visibility,
    p_parent_scope_id,
    v_actor,
    nullif(btrim(coalesce(v_profile ->> 'logo_url', '')), ''),
    nullif(btrim(coalesce(v_profile ->> 'cover_url', '')), ''),
    coalesce(v_parent.metadata, '{}'::jsonb)
      || v_profile
      || jsonb_build_object(
        'suborganization', true,
        'organization_level', 'SUB_ORGANIZATION',
        'organization_type', v_child_type,
        'join_policy', v_join,
        'parent_organization_id', p_parent_scope_id,
        'created_from', 'BUKLOD_SUBORG_CREATE_V2',
        'inheritance', jsonb_build_object(
          'organization_type', jsonb_build_object(
            'mode',
            case
              when nullif(btrim(p_organization_type), '') is not null
                then 'LOCAL_OVERRIDE'
              else 'INHERITED_DEFAULT'
            end,
            'source_scope_id', p_parent_scope_id
          ),
          'functional_role_templates', jsonb_build_object(
            'mode', 'INHERITED_DEFAULT',
            'source_scope_id', p_parent_scope_id
          ),
          'reports', jsonb_build_object(
            'mode', 'INHERITED_DEFAULT',
            'source_scope_id', p_parent_scope_id
          ),
          'attendance', jsonb_build_object(
            'mode', 'INHERITED_DEFAULT',
            'source_scope_id', p_parent_scope_id
          ),
          'evaluation', jsonb_build_object(
            'mode', 'INHERITED_DEFAULT',
            'source_scope_id', p_parent_scope_id
          )
        )
      )
  )
  returning id into v_child_id;

  -- The creator becomes an active member + ORG_ADMIN of the child so the
  -- new unit can be configured immediately. This does not elevate the actor
  -- on the parent Organization.
  insert into public.buklod_scope_memberships (
    scope_id,
    user_id,
    membership_status,
    membership_source,
    joined_at,
    left_at
  )
  values (
    v_child_id,
    v_actor,
    'ACTIVE',
    'SELF',
    now(),
    null
  )
  on conflict (scope_id, user_id) do update
    set membership_status = 'ACTIVE',
        membership_source = 'SELF',
        left_at = null,
        joined_at = coalesce(
          public.buklod_scope_memberships.joined_at,
          excluded.joined_at
        );

  insert into public.buklod_scope_role_assignments (
    scope_id,
    user_id,
    role_key,
    status,
    assigned_by,
    revoked_at
  )
  values (
    v_child_id,
    v_actor,
    'ORG_ADMIN',
    'ACTIVE',
    v_actor,
    null
  )
  on conflict (scope_id, user_id, role_key) do update
    set status = 'ACTIVE',
        assigned_by = excluded.assigned_by,
        revoked_at = null;

  -- Preserve structural oversight: active parent ORG_ADMINs also receive
  -- child membership + child ORG_ADMIN. Ordinary parent members do not.
  insert into public.buklod_scope_memberships (
    scope_id,
    user_id,
    membership_status,
    membership_source,
    joined_at,
    left_at
  )
  select
    v_child_id,
    ra.user_id,
    'ACTIVE',
    'SYSTEM',
    now(),
    null
  from public.buklod_scope_role_assignments ra
  where ra.scope_id = p_parent_scope_id
    and ra.role_key = 'ORG_ADMIN'
    and ra.status = 'ACTIVE'
  on conflict (scope_id, user_id) do update
    set membership_status = 'ACTIVE',
        left_at = null,
        joined_at = coalesce(
          public.buklod_scope_memberships.joined_at,
          excluded.joined_at
        );

  insert into public.buklod_scope_role_assignments (
    scope_id,
    user_id,
    role_key,
    status,
    assigned_by,
    revoked_at
  )
  select
    v_child_id,
    ra.user_id,
    'ORG_ADMIN',
    'ACTIVE',
    v_actor,
    null
  from public.buklod_scope_role_assignments ra
  where ra.scope_id = p_parent_scope_id
    and ra.role_key = 'ORG_ADMIN'
    and ra.status = 'ACTIVE'
  on conflict (scope_id, user_id, role_key) do update
    set status = 'ACTIVE',
        revoked_at = null,
        assigned_by = excluded.assigned_by;

  if exists (
    select 1
    from pg_proc
    where proname = 'buklod_org_log_v1'
      and pronamespace = 'public'::regnamespace
  ) then
    perform public.buklod_org_log_v1(
      p_parent_scope_id,
      'SUBORGANIZATION_CREATED',
      null,
      null,
      jsonb_build_object(
        'child_scope_id', v_child_id,
        'child_name', v_name,
        'visibility', v_visibility,
        'join_policy', v_join,
        'organization_type', v_child_type,
        'created_by', v_actor,
        'creation_method', 'BUKLOD_SUBORG_CREATE_V2',
        'creator_parent_role', case
          when public.buklod_is_scope_admin(p_parent_scope_id) then 'ORG_ADMIN'
          else 'ACTIVE_MEMBER'
        end
      )
    );
  end if;

  return v_child_id;
end;
$function$;

revoke all on function public.buklod_create_suborganization_v2(uuid,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.buklod_create_suborganization_v2(uuid,text,text,text,text,text,jsonb) to authenticated, service_role;
