-- Non-Show Faith is a personal choice across Public, Org, Sub-org, Church,
-- and Cluster scopes. Preserve existing RPC signature, membership and
-- entitlement rules; remove only the role/scope overrides of the preference.
-- Sourced from live buklod_my_scopes_p0_v2() on 2026-10-28.
CREATE OR REPLACE FUNCTION public.buklod_my_scopes_p0_v2()
 RETURNS TABLE(scope_id uuid, scope_type text, name text, scope_status text, visibility text, geo_level text, membership_status text, role_keys text[], is_admin boolean, member_count bigint, show_faith_content boolean, feature_keys text[], is_active_scope boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_is_system_admin boolean := false;
  v_faith_pref boolean := false;
  v_active_scope_id uuid := null;
begin
  if v_user_id is null then
    return;
  end if;

  v_is_system_admin := public.buklod_is_system_admin();

  select coalesce(p.show_faith_content, false)
    into v_faith_pref
  from public.buklod_user_preferences p
  where p.user_id = v_user_id
  limit 1;

  if not found then
    v_faith_pref := false;
  end if;

  select st.active_scope_id
    into v_active_scope_id
  from public.buklod_user_scope_state st
  where st.user_id = v_user_id
  limit 1;

  return query
  with my_memberships as materialized (
    select m.scope_id, m.membership_status, m.updated_at
    from public.buklod_scope_memberships m
    where m.user_id = v_user_id
  ),
  my_roles as materialized (
    select
      ra.scope_id,
      array_agg(distinct ra.role_key order by ra.role_key) as role_keys,
      bool_or(upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN','CHURCH_ADMIN','ORG_ADMIN')) as has_admin_role
    from public.buklod_scope_role_assignments ra
    where ra.user_id = v_user_id
      and ra.status = 'ACTIVE'
    group by ra.scope_id
  ),
  available as materialized (
    select
      s.id,
      s.scope_type,
      s.name,
      s.status,
      s.visibility,
      s.geo_level,
      s.created_by,
      s.metadata
    from public.buklod_scopes s
    where s.status not in ('SUSPENDED','DELETED')
      and (
        s.scope_type = 'PUBLIC'
        or (s.scope_type = 'SYSTEM' and v_is_system_admin)
        or exists (
          select 1
          from my_memberships m
          where m.scope_id = s.id
            and m.membership_status = 'ACTIVE'
        )
        or s.created_by = v_user_id
      )
  ),
  member_counts as (
    select m.scope_id, count(*)::bigint as member_count
    from public.buklod_scope_memberships m
    join available a on a.id = m.scope_id
    where m.membership_status = 'ACTIVE'
    group by m.scope_id
  ),
  features as (
    select
      e.scope_id,
      array_agg(distinct lower(e.feature_key) order by lower(e.feature_key)) as feature_keys
    from public.buklod_scope_feature_entitlements e
    join available a on a.id = e.scope_id
    where e.enabled = true
    group by e.scope_id
  )
  select
    s.id as scope_id,
    s.scope_type,
    s.name,
    s.status as scope_status,
    s.visibility,
    s.geo_level,
    mm.membership_status,
    coalesce(mr.role_keys, array[]::text[]) as role_keys,
    case
      when s.scope_type = 'LOCAL' then false
      else (v_is_system_admin or coalesce(mr.has_admin_role, false))
    end as is_admin,
    coalesce(mc.member_count, 0)::bigint as member_count,
    v_faith_pref as show_faith_content,
    coalesce(fe.feature_keys, array[]::text[]) as feature_keys,
    case
      when v_active_scope_id is null then s.scope_type = 'PUBLIC'
      else s.id = v_active_scope_id
    end as is_active_scope
  from available s
  left join my_memberships mm on mm.scope_id = s.id
  left join my_roles mr on mr.scope_id = s.id
  left join member_counts mc on mc.scope_id = s.id
  left join features fe on fe.scope_id = s.id
  order by
    case s.scope_type
      when 'PUBLIC' then 0
      when 'LOCAL' then 1
      when 'CLUSTER' then 2
      when 'CHURCH' then 3
      when 'ORGANIZATION' then 4
      when 'SYSTEM' then 5
      else 9
    end,
    case
      when s.scope_type = 'LOCAL' and upper(coalesce(s.geo_level,'')) = 'BARANGAY' then 10
      when s.scope_type = 'LOCAL' and upper(coalesce(s.geo_level,'')) in ('MUNICIPALITY_CITY','MUNICIPALITY','CITY') then 11
      when s.scope_type = 'LOCAL' and upper(coalesce(s.geo_level,'')) = 'PROVINCE' then 12
      when s.scope_type = 'LOCAL' and upper(coalesce(s.geo_level,'')) = 'COUNTRY' then 13
      else 99
    end,
    s.name;
end;
$function$
;

-- Suppress new faith alerts at the shared insert boundary before the existing
-- AFTER INSERT push dispatch runs. No old notification rows are deleted.
create or replace function private.buklod_faith_notification_opt_out_guard_v1()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if lower(new.kind) ~ '^(formation_|devotional_|prayer_|bible_|faith_|daily_bible_)'
     and not exists (
       select 1 from public.buklod_user_preferences p
       where p.user_id = new.user_id and p.show_faith_content is true
     )
  then
    return null;
  end if;
  return new;
end;
$function$;

revoke all on function private.buklod_faith_notification_opt_out_guard_v1()
  from public, anon, authenticated;

create or replace trigger buklod_faith_notification_opt_out_guard_v1
before insert on public.notifications
for each row
execute function private.buklod_faith_notification_opt_out_guard_v1();
