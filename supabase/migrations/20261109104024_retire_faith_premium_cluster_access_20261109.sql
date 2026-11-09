-- Retired Faith Premium gates (2026-11-09): Daily Reading + Word + Lessons 101-107.
-- Preserve authenticated active Cluster membership, RLS, stage prerequisites and existing RPC contracts.
-- No membership, entitlement, payment, reward or personal data rows are altered.

CREATE OR REPLACE FUNCTION public.get_automatic_bible_today()
 RETURNS TABLE(reading_date date, plan_day_number integer, plan_week_number integer, cycle_number integer, chapters_today integer, start_absolute_chapter integer, end_absolute_chapter integer, start_book_no integer, start_book_name text, start_chapter integer, end_book_no integer, end_book_name text, end_chapter integer, bible_reference text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  is_admin boolean := false;
  has_required_cluster boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  is_admin := public.buklod_is_system_admin();

  if not is_admin then
    with candidates as materialized (
      select
        m.scope_id,
        coalesce(m.membership_status::text, '') as membership_status,
        public.buklod_scope_is_active_lifecycle(s.id) as lifecycle_active
      from public.buklod_scope_memberships m
      join public.buklod_scopes s
        on s.id = m.scope_id
       and s.scope_type = 'CLUSTER'
      where m.user_id = actor
    )
    select coalesce(bool_or(c.membership_status = 'ACTIVE' and c.lifecycle_active), false)
      into has_required_cluster
    from candidates c;

    if not has_required_cluster then
      raise exception 'Join a Cluster before using Daily Bible Reading, Daily Devotion, or BUKLOD Lessons. Organization membership alone is not enough.';
    end if;

    -- Premium is retired. Active Cluster membership remains required.

  end if;

  return query
  select *
  from public.get_automatic_bible_reading(
    (now() at time zone 'Asia/Manila')::date
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buklod_daily_bible_submission_requires_cluster_premium_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.buklod_is_system_admin() and new.user_id = auth.uid() then
    return new;
  end if;

  if not public.buklod_has_active_cluster_membership_v1(new.user_id) then
    raise exception 'An active Cluster membership is required for Daily Bible Reading';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buklod_scope_faith_access_status_v1(p_scope_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  select * into v_scope from public.buklod_scopes where id = p_scope_id;
  if not found then
    raise exception 'Scope not found';
  end if;

  v_org := case
    when v_scope.scope_type = 'ORGANIZATION' then v_scope.id
    else coalesce(v_scope.organization_id, public.buklod_resolve_cluster_organization_id(v_scope.id))
  end;

  select name into v_org_name from public.buklod_scopes where id = v_org;

  /* MZB entitlement must inherit from the parent Organization down to its Clusters. */
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
      and (v_org is null or coalesce(s.organization_id, s.parent_scope_id) = v_org)
    order by m.joined_at desc nulls last
    limit 1;
  end if;

  if v_cluster is not null then
    v_has_cluster := true;
    select name into v_cluster_name from public.buklod_scopes where id = v_cluster;
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

    v_premium := true;
    v_ccp := true;
    v_disc := true;
    v_ment := true;

    -- Retired purchase gates: do not query payment requests for faith access.
  else
    if exists (
      select 1
      from public.buklod_scope_memberships m
      join public.buklod_scopes s on s.id = m.scope_id and s.scope_type = 'CLUSTER'
      where m.user_id = v_user
        and coalesce(m.membership_status::text, '') in ('PENDING', 'INVITED')
        and (v_org is null or coalesce(s.organization_id, s.parent_scope_id) = v_org)
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
      'price_php', 0,
      'unlocked', v_has_cluster and v_premium,
      'pending_request_id', null
    ),
    'devotion_word', jsonb_build_object(
      'price_php', 0,
      'unlocked', v_has_cluster and v_premium,
      'pending_request_id', null
    ),
    'lesson_stages', jsonb_build_array(
      jsonb_build_object('stage_code', 101, 'title', 'CCP 101', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', null),
      jsonb_build_object('stage_code', 102, 'title', 'CCP 102', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', null),
      jsonb_build_object('stage_code', 103, 'title', 'CCP 103', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_ccp, 'pending_request_id', null),
      jsonb_build_object('stage_code', 104, 'title', 'Discipleship 104', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_disc, 'pending_request_id', null),
      jsonb_build_object('stage_code', 105, 'title', 'Discipleship 105', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_disc, 'pending_request_id', null),
      jsonb_build_object('stage_code', 106, 'title', 'Mentoring 106', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_ment, 'pending_request_id', null),
      jsonb_build_object('stage_code', 107, 'title', 'Mentoring 107', 'price_php', 0, 'scope_unlocked', v_has_cluster and v_ment, 'pending_request_id', null)
    )
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.buklod_scope_lesson_stage_unlocked_v1(p_scope_id uuid, p_stage_code integer)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_scope_id is null or p_stage_code is null or p_stage_code not between 101 and 107 then
    return false;
  end if;
  -- Purchases retired; this is a scope availability check, NOT a member-access grant.
  return exists (
    select 1 from public.buklod_scopes s
    where s.id = p_scope_id
      and s.scope_type = 'CLUSTER'
      and public.buklod_scope_is_active_lifecycle(s.id)
  );
end;
$function$;

COMMENT ON FUNCTION public.buklod_daily_bible_submission_requires_cluster_premium_v1()
IS 'Compatibility trigger: active Cluster membership required; paid Premium retired Nov 2026.';

COMMENT ON FUNCTION public.buklod_scope_faith_access_status_v1(uuid)
IS 'No paid entitlement for Daily Reading, Word or formation stages 101-107. Active Cluster membership still required.';
