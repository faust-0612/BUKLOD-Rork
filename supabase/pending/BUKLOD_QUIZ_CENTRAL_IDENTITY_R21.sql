-- R21 DEV candidate only. MAIN Focus App entitlement remains authoritative.
-- No password/identity copying, no legacy entitlement writes, no public login identifier lookup.
-- Preserve p_user argument name for existing MAIN RPC callers.
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists(select 1 from public.profiles p where p.id=p_user and p.is_active is true)
    and exists (
      select 1
      from public.buklod_user_focus_app_entitlements e
      where e.user_id = p_user
        and lower(e.focus_app_code) = 'faculty'
        and e.status = 'ACTIVE'
        and (e.activated_at is null or e.activated_at<=now())
        and (e.expires_at is null or e.expires_at > now())
    )
    and (
      exists (
        select 1
        from public.buklod_education_classrooms c
        where c.faculty_user_id = p_user
          and upper(coalesce(c.status,'')) = 'ACTIVE'
      )
      or exists (
        select 1
        from public.buklod_focus_app_admins a
        where a.user_id = p_user
          and lower(a.focus_app_code) = 'faculty'
      )
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_is_examiner(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists(select 1 from public.profiles p where p.id=p_user and p.is_active is true)
    and ((p_user=auth.uid() and public.buklod_quiz_is_system_admin())
    or (
      exists (
        select 1
        from public.buklod_quiz_examiner_roles r
        where r.user_id = p_user
          and r.is_active = true
      )
      and public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user)
    ));
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_capabilities_v1()
 RETURNS TABLE(can_conduct boolean, is_system_admin boolean, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_examiner_role boolean := false;
  v_faculty_admin boolean := false;
  v_admin boolean := false;
  v_name text := null;
begin
  if v_uid is null or not exists(select 1 from public.profiles p where p.id=v_uid and p.is_active is true) then
    return query select false, false, null::text;
    return;
  end if;

  select exists(
    select 1
    from public.buklod_quiz_examiner_roles r
    where r.user_id = v_uid
      and r.is_active = true
  ) into v_examiner_role;

  v_faculty_admin := public.buklod_quiz_faculty_focus_admin_eligible_v1(v_uid);
  v_admin := public.buklod_quiz_is_system_admin();

  select coalesce(
    nullif(to_jsonb(p)->>'display_name',''),
    nullif(to_jsonb(p)->>'full_name',''),
    nullif(to_jsonb(p)->>'username','')
  )
  into v_name
  from public.profiles p
  where p.id = v_uid;

  return query
  select public.buklod_quiz_is_examiner(v_uid), v_admin, v_name;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_examiner_access_status_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role boolean := false;
  v_entitlement boolean := false;
  v_class_admin boolean := false;
  v_focus_admin boolean := false;
  v_system boolean := false;
  v_cfg public.buklod_focus_app_subscription_config%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists(
    select 1 from public.buklod_quiz_examiner_roles r
    where r.user_id=v_uid and r.is_active=true
  ) into v_role;

  select exists(
    select 1 from public.buklod_user_focus_app_entitlements e
    where e.user_id=v_uid
      and lower(e.focus_app_code)='faculty'
      and e.status='ACTIVE'
      and (e.activated_at is null or e.activated_at<=now())
      and (e.expires_at is null or e.expires_at>now())
  ) into v_entitlement;

  select exists(
    select 1 from public.buklod_education_classrooms c
    where c.faculty_user_id=v_uid
      and upper(coalesce(c.status,''))='ACTIVE'
  ) into v_class_admin;

  select exists(
    select 1 from public.buklod_focus_app_admins a
    where a.user_id=v_uid and lower(a.focus_app_code)='faculty'
  ) into v_focus_admin;

  v_system := public.buklod_quiz_is_system_admin() and exists(select 1 from public.profiles p where p.id=v_uid and p.is_active is true);

  select * into v_cfg
  from public.buklod_focus_app_subscription_config
  where focus_app_code='faculty'
  limit 1;

  return jsonb_build_object(
    'can_conduct', public.buklod_quiz_is_examiner(v_uid),
    'is_system_admin', v_system,
    'has_examiner_role', v_role,
    'faculty_entitlement_active', v_entitlement,
    'faculty_admin_ready', (v_class_admin or v_focus_admin),
    'owns_active_faculty_classroom', v_class_admin,
    'explicit_focus_app_admin', v_focus_admin,
    'focus_app_code', 'faculty',
    'display_name', coalesce(v_cfg.display_name,'BUKLOD Faculty'),
    'annual_amount_php', v_cfg.annual_amount_php,
    'billing_interval', v_cfg.billing_interval,
    'purchase_route', '/profile/focus-apps',
    'examiner_requires', 'ACTIVE_FACULTY_FOCUS_APP_PLUS_FACULTY_ADMIN',
    'system_admin_emergency_bypass', true
  );
end;
$function$;
CREATE FUNCTION public.buklod_quiz_claim_main_entry_v1(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE ok boolean;
BEGIN
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user_id AND p.is_active IS TRUE)
 OR NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id) THEN RETURN false; END IF;
 SELECT g.allowed INTO ok FROM public.buklod_quiz_entry_claim_r13(p_user_id) g;
 RETURN coalesce(ok,false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_claim_main_entry_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_claim_main_entry_v1(uuid) TO service_role;
-- No replacement for legacy resolve_login_identifier or sync_faculty_entitlement.
-- Direct auth and MAIN Focus App access must be used by the standalone client.
REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_is_examiner(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_is_examiner(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_capabilities_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_capabilities_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_examiner_access_status_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_examiner_access_status_v1() TO authenticated;
