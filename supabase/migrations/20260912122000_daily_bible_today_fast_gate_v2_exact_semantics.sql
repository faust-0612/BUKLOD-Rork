-- Daily Bible Home gate performance v2
-- Preserve the two legacy membership-status semantics exactly while still
-- resolving lifecycle status only once per candidate Cluster.

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
  has_required_cluster boolean := false;
  product_cluster_ids uuid[];
  has_premium boolean := false;
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
    select
      coalesce(
        bool_or(
          c.membership_status = 'ACTIVE'
          and c.lifecycle_active
        ),
        false
      ),
      array_agg(c.scope_id)
        filter (
          where upper(c.membership_status) = 'ACTIVE'
            and c.lifecycle_active
        )
    into has_required_cluster, product_cluster_ids
    from candidates c;

    if not has_required_cluster then
      raise exception 'Join a Cluster before using Daily Bible Reading, Daily Devotion, or BUKLOD Lessons. Organization membership alone is not enough.';
    end if;

    select exists (
      select 1
      from unnest(coalesce(product_cluster_ids, array[]::uuid[])) as c(scope_id)
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
