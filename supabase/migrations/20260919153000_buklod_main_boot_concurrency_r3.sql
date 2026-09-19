-- BUKLOD MAIN BOOT CONCURRENCY R3
-- 2026-09-19
-- Live hotfix captured after observing repeated startup latency under activity load.
-- Goals:
--   * Remove nested system-admin function overhead from runtime bootstrap.
--   * Resolve feature flags set-wise.
--   * Make runtime config a single-pass server operation.
--   * Preserve existing authorization semantics and response shape.

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  with actor as (
    select auth.uid() as user_id
  )
  select coalesce(
    (
      select
        a.user_id is not null
        and exists (
          select 1
          from public.profiles p
          where p.id = a.user_id
            and p.is_active = true
        )
        and (
          exists (
            select 1
            from public.buklod_foundation_protected_principals pp
            where pp.principal_key = 'OFFICIAL_SYSTEM_ADMIN'
              and pp.user_id = a.user_id
              and pp.protected = true
          )
          or exists (
            select 1
            from auth.users u
            where u.id = a.user_id
              and lower(coalesce(u.email, '')) = 'efmagaj@gmail.com'
          )
          or exists (
            select 1
            from public.user_roles ur
            where ur.user_id = a.user_id
              and ur.role = 'system_admin'
              and ur.is_active = true
          )
          or (
            not exists (
              select 1
              from public.user_roles ur0
              where ur0.user_id = a.user_id
                and ur0.role = 'system_admin'
            )
            and exists (
              select 1
              from public.profiles p0
              where p0.id = a.user_id
                and p0.is_active = true
                and p0.role::text = 'system_admin'
            )
          )
        )
      from actor a
    ),
    false
  );
$function$;

create or replace function public.effective_feature_flags()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with actor as (
    select auth.uid() as user_id
  ),
  context as (
    select
      (select p.church_id
       from public.profiles p, actor a
       where p.id = a.user_id
       limit 1) as church_id,
      (select gm.group_id
       from public.group_members gm, actor a
       where gm.user_id = a.user_id
         and gm.is_active = true
       order by gm.joined_at desc
       limit 1) as group_id
  ),
  keys as (
    select distinct ff.feature_key
    from public.feature_flags ff
  ),
  resolved as (
    select
      k.feature_key,
      coalesce(
        (
          select ff.enabled
          from public.feature_flags ff
          cross join context c
          where ff.feature_key = k.feature_key
            and (
              (ff.scope = 'group' and c.group_id is not null and ff.group_id = c.group_id)
              or
              (ff.scope = 'church' and c.church_id is not null and ff.church_id = c.church_id)
              or
              ff.scope = 'system'
            )
          order by
            case ff.scope
              when 'group' then 3
              when 'church' then 2
              else 1
            end desc
          limit 1
        ),
        true
      ) as enabled
    from keys k
  )
  select coalesce(
    jsonb_object_agg(r.feature_key, r.enabled order by r.feature_key),
    '{}'::jsonb
  )
  from resolved r;
$function$;

create or replace function public.get_client_runtime_config(
  p_environment text,
  p_app_version text
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with actor as (
    select auth.uid() as user_id
  ),
  cfg as (
    select x.*
    from (
      select c.*, 0 as ord
      from public.app_runtime_config c
      where c.environment = p_environment

      union all

      select c.*, 1 as ord
      from public.app_runtime_config c
      where c.environment = 'production'
        and not exists (
          select 1
          from public.app_runtime_config c2
          where c2.environment = p_environment
        )
    ) x
    order by x.ord
    limit 1
  ),
  actor_profile as (
    select
      p.id,
      p.church_id,
      p.role::text as profile_role,
      p.is_active
    from public.profiles p
    join actor a on a.user_id = p.id
    limit 1
  ),
  admin_state as (
    select
      coalesce(
        ap.id is not null
        and ap.is_active = true
        and (
          exists (
            select 1
            from public.buklod_foundation_protected_principals pp
            where pp.principal_key = 'OFFICIAL_SYSTEM_ADMIN'
              and pp.user_id = ap.id
              and pp.protected = true
          )
          or exists (
            select 1
            from auth.users u
            where u.id = ap.id
              and lower(coalesce(u.email, '')) = 'efmagaj@gmail.com'
          )
          or exists (
            select 1
            from public.user_roles ur
            where ur.user_id = ap.id
              and ur.role = 'system_admin'
              and ur.is_active = true
          )
          or (
            not exists (
              select 1
              from public.user_roles ur0
              where ur0.user_id = ap.id
                and ur0.role = 'system_admin'
            )
            and ap.profile_role = 'system_admin'
          )
        ),
        false
      ) as admin_bypass
    from actor_profile ap
    union all
    select false
    where not exists (select 1 from actor_profile)
    limit 1
  ),
  actor_context as (
    select
      ap.church_id,
      (
        select gm.group_id
        from public.group_members gm
        where gm.user_id = ap.id
          and gm.is_active = true
        order by gm.joined_at desc
        limit 1
      ) as group_id
    from actor_profile ap
    union all
    select null::uuid, null::uuid
    where not exists (select 1 from actor_profile)
    limit 1
  ),
  feature_keys as (
    select distinct ff.feature_key
    from public.feature_flags ff
  ),
  feature_values as (
    select
      k.feature_key,
      coalesce(
        (
          select ff.enabled
          from public.feature_flags ff
          cross join actor_context ac
          where ff.feature_key = k.feature_key
            and (
              (ff.scope = 'group' and ac.group_id is not null and ff.group_id = ac.group_id)
              or
              (ff.scope = 'church' and ac.church_id is not null and ff.church_id = ac.church_id)
              or
              ff.scope = 'system'
            )
          order by
            case ff.scope
              when 'group' then 3
              when 'church' then 2
              else 1
            end desc
          limit 1
        ),
        true
      ) as enabled
    from feature_keys k
  ),
  feature_json as (
    select coalesce(
      jsonb_object_agg(fv.feature_key, fv.enabled order by fv.feature_key),
      '{}'::jsonb
    ) as features
    from feature_values fv
  ),
  pilot_state as (
    select
      case
        when not c.pilot_access_required then true
        when a.admin_bypass then true
        else exists (
          select 1
          from public.pilot_participants pp
          join public.pilot_cohorts pc on pc.id = pp.cohort_id
          join actor act on act.user_id = pp.user_id
          where pp.status = 'active'
            and pc.is_active = true
            and (pc.starts_at is null or pc.starts_at <= now())
            and (pc.ends_at is null or pc.ends_at >= now())
        )
      end as pilot_ok
    from cfg c
    cross join admin_state a
  )
  select jsonb_build_object(
    'environment', c.environment,
    'maintenance_mode', c.maintenance_mode and not a.admin_bypass,
    'maintenance_message', c.maintenance_message,
    'minimum_supported_version', c.minimum_supported_version,
    'recommended_version', c.recommended_version,
    'update_required',
      public.semver_lt(coalesce(p_app_version,'0.0.0'), c.minimum_supported_version)
      and not a.admin_bypass,
    'update_recommended',
      public.semver_lt(coalesce(p_app_version,'0.0.0'), c.recommended_version),
    'update_message', c.update_message,
    'pilot_access_required', c.pilot_access_required,
    'pilot_access_granted', p.pilot_ok or a.admin_bypass,
    'admin_bypass', a.admin_bypass,
    'release_title', c.release_title,
    'release_notes', c.release_notes,
    'features', f.features
  )
  from cfg c
  cross join admin_state a
  cross join pilot_state p
  cross join feature_json f;
$function$;
