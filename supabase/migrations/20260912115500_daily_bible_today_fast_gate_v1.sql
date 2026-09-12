-- Daily Bible Home gate performance v1
-- Preserves the existing get_automatic_bible_today() signature, errors,
-- system-admin bypass, cluster lifecycle requirement, and Cluster Premium/MZB exemption rules.

create or replace function public.get_automatic_bible_today()
returns table(
  reading_date date,
  plan_day_number integer,
  plan_week_number integer,
  cycle_number integer,
  chapters_today integer,
  start_absolute_chapter integer,
  end_absolute_chapter integer,
  start_book_no integer,
  start_book_name text,
  start_chapter integer,
  end_book_no integer,
  end_book_name text,
  end_chapter integer,
  bible_reference text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  is_admin boolean := false;
  active_cluster_ids uuid[];
  has_premium boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  -- Existing behavior: system admins bypass Cluster membership/product gates.
  -- Compute it once instead of repeating the role lookup in nested helpers.
  is_admin := public.buklod_is_system_admin();

  if not is_admin then
    -- Resolve active Cluster membership/lifecycle once and reuse the result.
    select array_agg(candidate.scope_id order by candidate.joined_at desc nulls last)
      into active_cluster_ids
    from (
      select m.scope_id, m.joined_at
      from public.buklod_scope_memberships m
      join public.buklod_scopes s
        on s.id = m.scope_id
       and s.scope_type = 'CLUSTER'
      where m.user_id = actor
        and upper(coalesce(m.membership_status::text, '')) = 'ACTIVE'
        and public.buklod_scope_is_active_lifecycle(s.id)
    ) candidate;

    if active_cluster_ids is null or cardinality(active_cluster_ids) = 0 then
      raise exception 'Join a Cluster before using Daily Bible Reading, Daily Devotion, or BUKLOD Lessons. Organization membership alone is not enough.';
    end if;

    -- Keep the same cross-Cluster entitlement semantics as
    -- buklod_user_has_active_cluster_product_v1. Check direct entitlement first;
    -- only evaluate the recursive MZB exemption path when entitlement is absent.
    select exists (
      select 1
      from unnest(active_cluster_ids) as c(scope_id)
      where case
        when exists (
          select 1
          from public.buklod_scope_product_entitlements e
          where e.scope_id = c.scope_id
            and lower(e.product_code) = 'cluster_premium'
            and upper(coalesce(e.status::text, '')) = 'ACTIVE'
            and (e.expires_at is null or e.expires_at >= now())
        ) then true
        else public.buklod_scope_is_mzb_exempt_v1(c.scope_id)
      end
    ) into has_premium;

    if not has_premium then
      raise exception 'Cluster Premium is required for Daily Bible Reading';
    end if;
  end if;

  return query
  select *
  from public.get_automatic_bible_reading(
    (now() at time zone 'Asia/Manila')::date
  );
end;
$$;
