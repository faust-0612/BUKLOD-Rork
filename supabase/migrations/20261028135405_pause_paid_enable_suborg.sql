-- Pause unapproved paid offerings; preserve historical data and entitlements.
-- The backend is authoritative even for older mobile builds.

update public.buklod_commercial_products
   set is_active = false
 where is_active = true
   and amount_php > 0;

update public.buklod_subscription_plans set is_active = false where is_active = true;
update public.buklod_paid_features set is_active = false where is_active = true;

revoke execute on function public.buklod_submit_scope_product_payment_v1(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.buklod_submit_faith_payment_v1(uuid,text,text,integer,text) from public, anon, authenticated;
revoke execute on function public.buklod_focus_app_submit_payment_v1(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.buklod_submit_personal_focus_app_payment_v1(text,text) from public, anon, authenticated;
revoke execute on function public.buklod_submit_personal_focus_app_payment_v2(text,text,text) from public, anon, authenticated;

-- Subscription is not a prerequisite for root Organization child creation.
-- Existing admin permissions and child-scope audit/ownership are preserved.
CREATE OR REPLACE FUNCTION public.buklod_create_suborganization_v1(p_parent_scope_id uuid, p_name text, p_description text DEFAULT NULL::text, p_visibility text DEFAULT NULL::text, p_join_policy text DEFAULT NULL::text, p_organization_type text DEFAULT NULL::text, p_profile jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

    -- An active member may create a child scope but receives no parent admin role.
    if not (
        public.buklod_is_system_admin()
        or public.buklod_is_scope_admin(p_parent_scope_id)
        or exists (
            select 1 from public.buklod_scope_memberships m
            where m.scope_id = p_parent_scope_id
              and m.user_id = v_actor
              and m.membership_status = 'ACTIVE'
              and m.left_at is null
        )
    ) then
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
              'created_from', 'BUKLOD_SUBORG_CREATE_V1',
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
                  'reports', jsonb_build_object('mode', 'INHERITED_DEFAULT', 'source_scope_id', p_parent_scope_id),
                  'attendance', jsonb_build_object('mode', 'INHERITED_DEFAULT', 'source_scope_id', p_parent_scope_id),
                  'evaluation', jsonb_build_object('mode', 'INHERITED_DEFAULT', 'source_scope_id', p_parent_scope_id)
              )
          )
    )
    returning id into v_child_id;

    -- Creator: active member + ORG_ADMIN on child.
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
            joined_at = coalesce(public.buklod_scope_memberships.joined_at, excluded.joined_at);

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

    -- Structural rule: parent ORG_ADMINs receive child admin (not all parent members).
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
            joined_at = coalesce(public.buklod_scope_memberships.joined_at, excluded.joined_at);

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
                'creation_method', 'BUKLOD_SUBORG_CREATE_V1'
            )
        );
    end if;

    return v_child_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.buklod_list_suborganizations_v1(p_parent_scope_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(scope_id uuid, name text, status text, visibility text, parent_scope_id uuid, description text, organization_type text, member_count bigint, admin_count bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    -- Listing exact children is allowed for active parent members.
    if not (
        public.buklod_is_system_admin()
        or public.buklod_is_scope_admin(p_parent_scope_id)
        or exists (
            select 1 from public.buklod_scope_memberships m
            where m.scope_id = p_parent_scope_id
              and m.user_id = auth.uid()
              and m.membership_status = 'ACTIVE'
              and m.left_at is null
        )
    ) then
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

revoke execute on function public.buklod_create_suborganization_v1(uuid,text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.buklod_create_suborganization_v1(uuid,text,text,text,text,text,jsonb) to authenticated;
revoke execute on function public.buklod_list_suborganizations_v1(uuid,integer,integer) from public, anon;
grant execute on function public.buklod_list_suborganizations_v1(uuid,integer,integer) to authenticated;
