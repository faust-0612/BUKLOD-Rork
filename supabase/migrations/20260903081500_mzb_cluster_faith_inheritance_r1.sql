-- BUKLOD MZB Cluster Faith Inheritance R1
-- MZB's free Formation / Daily Reading / Devotion entitlement is an
-- Organization policy and must follow every Cluster under MZB.

create or replace function public.buklod_scope_faith_access_status_v1(p_scope_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_scope public.buklod_scopes%rowtype;
  v_cluster uuid;
  v_cluster_name text;
  v_cluster_role text;
  v_org uuid;
  v_org_name text;
  v_has_cluster boolean := false;
  v_premium boolean := false;
  v_ccp boolean := false;
  v_disc boolean := false;
  v_ment boolean := false;
  v_pending_premium uuid;
  v_pending_ccp uuid;
  v_pending_disc uuid;
  v_pending_ment uuid;
  v_mzb boolean := false;
  v_join text := 'NONE';
begin
  select * into v_scope
  from public.buklod_scopes
  where id = p_scope_id;

  if not found then
    raise exception 'Scope not found';
  end if;

  v_org := case
    when v_scope.scope_type = 'ORGANIZATION' then v_scope.id
    else coalesce(
      v_scope.organization_id,
      public.buklod_resolve_cluster_organization_id(v_scope.id)
    )
  end;

  select name into v_org_name
  from public.buklod_scopes
  where id = v_org;

  -- Critical R1 fix: a Cluster inherits MZB status from its parent Organization.
  v_mzb := (
    lower(coalesce(v_scope.metadata->>'is_mzb', 'false')) in ('true', '1', 'yes', 'on')
    or lower(coalesce(v_scope.metadata->>'organization_code', '')) = 'mzb'
    or lower(coalesce(v_scope.slug, '')) = 'mzb-ministry-inc'
    or exists (
      select 1
      from public.buklod_scopes o
      where o.id = v_org
        and (
          lower(coalesce(o.metadata->>'is_mzb', 'false')) in ('true', '1', 'yes', 'on')
          or lower(coalesce(o.metadata->>'organization_code', '')) = 'mzb'
          or lower(coalesce(o.slug, '')) = 'mzb-ministry-inc'
        )
    )
  );

  if v_scope.scope_type = 'CLUSTER'
     and public.buklod_user_is_active_scope_member(v_scope.id, v_user)
     and public.buklod_scope_is_active_lifecycle(v_scope.id) then
    v_cluster := v_scope.id;
  else
    select s.id
    into v_cluster
    from public.buklod_scope_memberships m
    join public.buklod_scopes s
      on s.id = m.scope_id
     and s.scope_type = 'CLUSTER'
    where m.user_id = v_user
      and coalesce(m.membership_status::text, '') = 'ACTIVE'
      and public.buklod_scope_is_active_lifecycle(s.id)
      and (
        v_org is null
        or coalesce(s.organization_id, s.parent_scope_id) = v_org
      )
    order by m.joined_at desc nulls last
    limit 1;
  end if;

  if v_cluster is not null then
    v_has_cluster := true;

    select name into v_cluster_name
    from public.buklod_scopes
    where id = v_cluster;

    select upper(ra.role_key)
    into v_cluster_role
    from public.buklod_scope_role_assignments ra
    where ra.scope_id = v_cluster
      and ra.user_id = v_user
      and ra.status = 'ACTIVE'
    order by case upper(ra.role_key)
      when 'CLUSTER_HEAD' then 1
      when 'CLUSTER_ADMIN' then 2
      when 'ADMIN' then 3
      when 'PASTOR' then 4
      when 'MENTOR' then 5
      when 'MEMBER' then 9
      else 10
    end
    limit 1;

    v_join := 'ACTIVE';

    v_premium := v_mzb
      or public.buklod_scope_has_product_v1(v_cluster, 'cluster_premium');
    v_ccp := v_mzb
      or public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_ccp');
    v_disc := v_mzb
      or public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_discipleship');
    v_ment := v_mzb
      or public.buklod_scope_has_product_v1(v_cluster, 'cluster_lessons_mentoring');

    select id into v_pending_premium
    from public.buklod_scope_product_payments
    where scope_id = v_cluster
      and product_code = 'cluster_premium'
      and status = 'pending_admin'
    order by created_at desc
    limit 1;

    select id into v_pending_ccp
    from public.buklod_scope_product_payments
    where scope_id = v_cluster
      and product_code = 'cluster_lessons_ccp'
      and status = 'pending_admin'
    order by created_at desc
    limit 1;

    select id into v_pending_disc
    from public.buklod_scope_product_payments
    where scope_id = v_cluster
      and product_code = 'cluster_lessons_discipleship'
      and status = 'pending_admin'
    order by created_at desc
    limit 1;

    select id into v_pending_ment
    from public.buklod_scope_product_payments
    where scope_id = v_cluster
      and product_code = 'cluster_lessons_mentoring'
      and status = 'pending_admin'
    order by created_at desc
    limit 1;
  else
    if exists (
      select 1
      from public.buklod_scope_memberships m
      join public.buklod_scopes s
        on s.id = m.scope_id
       and s.scope_type = 'CLUSTER'
      where m.user_id = v_user
        and coalesce(m.membership_status::text, '') in ('PENDING', 'INVITED')
        and (
          v_org is null
          or coalesce(s.organization_id, s.parent_scope_id) = v_org
        )
    ) then
      v_join := 'PENDING';
    end if;
  end if;

  return jsonb_build_object(
    'scope_id', p_scope_id,
    'gcash_number', '09811646218',
    'is_mzb_scope_exempt', v_mzb,
    'is_mzb_user_exempt', v_mzb,
    'has_active_cluster', v_has_cluster,
    'cluster_id', v_cluster,
    'cluster_name', v_cluster_name,
    'cluster_role', v_cluster_role,
    'organization_id', v_org,
    'organization_name', v_org_name,
    'join_status', v_join,
    'daily_reading', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_has_cluster and v_premium,
      'pending_request_id', v_pending_premium
    ),
    'devotion_word', jsonb_build_object(
      'price_php', 49,
      'unlocked', v_has_cluster and v_premium,
      'pending_request_id', v_pending_premium
    ),
    'lesson_stages', jsonb_build_array(
      jsonb_build_object('stage_code', 101, 'title', 'CCP 101', 'price_php', 49, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 102, 'title', 'CCP 102', 'price_php', 49, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 103, 'title', 'CCP 103', 'price_php', 49, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', v_pending_ccp),
      jsonb_build_object('stage_code', 104, 'title', 'Discipleship 104', 'price_php', 59, 'scope_unlocked', v_has_cluster and v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 105, 'title', 'Discipleship 105', 'price_php', 59, 'scope_unlocked', v_has_cluster and v_disc, 'pending_request_id', v_pending_disc),
      jsonb_build_object('stage_code', 106, 'title', 'Mentoring 106', 'price_php', 69, 'scope_unlocked', v_has_cluster and v_ment, 'pending_request_id', v_pending_ment),
      jsonb_build_object('stage_code', 107, 'title', 'Mentoring 107', 'price_php', 69, 'scope_unlocked', v_has_cluster and v_ment, 'pending_request_id', v_pending_ment)
    )
  );
end;
$function$;
