-- BUKLOD scope snapshot performance v1
-- Preserve buklod_my_scopes() output contract while replacing per-row lateral
-- member/feature scans with grouped passes over only the actor's available scopes.

create or replace function public.buklod_my_scopes()
returns table(
  scope_id uuid,
  scope_type text,
  name text,
  scope_status text,
  visibility text,
  geo_level text,
  membership_status text,
  role_keys text[],
  is_admin boolean,
  member_count bigint,
  show_faith_content boolean,
  feature_keys text[],
  is_active_scope boolean
)
language sql
stable
security definer
set search_path = ''
as $$
with actor as (
  select
    (select auth.uid()) as user_id,
    public.buklod_is_system_admin() as is_system_admin,
    coalesce((
      select p.show_faith_content
      from public.buklod_user_preferences p
      where p.user_id = (select auth.uid())
      limit 1
    ), false) as faith_pref
),
state as (
  select st.active_scope_id
  from public.buklod_user_scope_state st
  join actor a on a.user_id = st.user_id
  limit 1
),
my_memberships as (
  select m.scope_id, m.membership_status, m.updated_at
  from public.buklod_scope_memberships m
  join actor a on a.user_id = m.user_id
),
my_roles as (
  select
    ra.scope_id,
    array_agg(distinct ra.role_key order by ra.role_key) as role_keys,
    bool_or(upper(ra.role_key) in ('ADMIN','CLUSTER_ADMIN','CHURCH_ADMIN','ORG_ADMIN')) as has_admin_role
  from public.buklod_scope_role_assignments ra
  join actor a on a.user_id = ra.user_id
  where ra.status = 'ACTIVE'
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
  cross join actor a
  where a.user_id is not null
    and s.status not in ('SUSPENDED','DELETED')
    and (
      s.scope_type = 'PUBLIC'
      or (s.scope_type = 'SYSTEM' and a.is_system_admin)
      or exists (
        select 1
        from my_memberships m
        where m.scope_id = s.id
          and m.membership_status = 'ACTIVE'
      )
      or s.created_by = a.user_id
    )
),
member_counts as (
  select
    m.scope_id,
    count(*)::bigint as member_count
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
    else (a.is_system_admin or coalesce(mr.has_admin_role, false))
  end as is_admin,
  coalesce(mc.member_count, 0)::bigint as member_count,
  case
    when s.scope_type = 'CHURCH' then true
    when s.scope_type = 'CLUSTER'
      and (a.is_system_admin or coalesce(mr.has_admin_role, false)) then true
    when s.scope_type = 'ORGANIZATION'
      and lower(coalesce(s.metadata ->> 'faith_content_mandatory','false')) in ('true','1','yes','on') then true
    else a.faith_pref
  end as show_faith_content,
  coalesce(fe.feature_keys, array[]::text[]) as feature_keys,
  case
    when st.active_scope_id is null then s.scope_type = 'PUBLIC'
    else s.id = st.active_scope_id
  end as is_active_scope
from available s
cross join actor a
left join state st on true
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
$$;
