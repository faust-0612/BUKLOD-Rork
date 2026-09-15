-- BUKLOD CITY WEB R1
-- Real institution coordinates reuse buklod_scopes latitude/longitude.
-- This migration adds only City map activity records, privacy-safe presence,
-- and security-definer RPCs that preserve existing scope authority.

create table if not exists public.buklod_city_map_items (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid null references public.buklod_scopes(id) on delete cascade,
  item_type text not null check (item_type in ('EVENT','SERVICE','BAYANIHAN')),
  title text not null check (char_length(btrim(title)) between 2 and 140),
  description text null,
  address_label text null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  starts_at timestamptz null,
  ends_at timestamptz null,
  status text not null default 'ACTIVE' check (status in ('DRAFT','ACTIVE','CANCELLED','ENDED')),
  visibility text not null default 'SCOPE' check (visibility in ('PUBLIC','SCOPE')),
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists buklod_city_map_items_scope_idx
  on public.buklod_city_map_items(scope_id, status, starts_at);
create index if not exists buklod_city_map_items_type_idx
  on public.buklod_city_map_items(item_type, status);

alter table public.buklod_city_map_items enable row level security;

drop policy if exists buklod_city_map_items_read on public.buklod_city_map_items;
create policy buklod_city_map_items_read
  on public.buklod_city_map_items
  for select
  using (
    created_by = (select auth.uid())
    or public.buklod_is_system_admin()
    or (
      status = 'ACTIVE'
      and visibility = 'PUBLIC'
    )
    or (
      scope_id is not null
      and public.buklod_can_view_scope(scope_id)
    )
  );

drop policy if exists buklod_city_map_items_insert on public.buklod_city_map_items;
create policy buklod_city_map_items_insert
  on public.buklod_city_map_items
  for insert
  with check (
    created_by = (select auth.uid())
    and scope_id is not null
    and (
      public.buklod_is_system_admin()
      or public.buklod_is_scope_admin(scope_id)
    )
  );

drop policy if exists buklod_city_map_items_update on public.buklod_city_map_items;
create policy buklod_city_map_items_update
  on public.buklod_city_map_items
  for update
  using (
    public.buklod_is_system_admin()
    or (scope_id is not null and public.buklod_is_scope_admin(scope_id))
  )
  with check (
    public.buklod_is_system_admin()
    or (scope_id is not null and public.buklod_is_scope_admin(scope_id))
  );

drop policy if exists buklod_city_map_items_delete on public.buklod_city_map_items;
create policy buklod_city_map_items_delete
  on public.buklod_city_map_items
  for delete
  using (
    public.buklod_is_system_admin()
    or (scope_id is not null and public.buklod_is_scope_admin(scope_id))
  );

grant select, insert, update, delete on public.buklod_city_map_items to authenticated;

create table if not exists public.buklod_city_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  scope_id uuid null references public.buklod_scopes(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  precision_mode text not null default 'APPROXIMATE' check (precision_mode in ('APPROXIMATE','EXACT')),
  audience text not null default 'FRIENDS' check (audience in ('FAMILY','FRIENDS','MY_CHURCH','MY_ORGANIZATION','EVENT_GROUP')),
  audience_user_ids uuid[] not null default '{}'::uuid[],
  enabled boolean not null default true,
  expires_at timestamptz null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.buklod_city_presence enable row level security;
revoke all on public.buklod_city_presence from anon, authenticated;

drop function if exists public.buklod_city_can_view_presence_v1(uuid, uuid, text, uuid[]);
create function public.buklod_city_can_view_presence_v1(
  p_owner_id uuid,
  p_scope_id uuid,
  p_audience text,
  p_audience_user_ids uuid[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when p_owner_id = (select auth.uid()) then true
    when p_audience = 'FAMILY' then exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on theirs.household_id = mine.household_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_owner_id
    )
    when p_audience = 'FRIENDS' then
      exists (
        select 1 from public.buklod_user_follows a
        where a.follower_id = (select auth.uid())
          and a.followed_user_id = p_owner_id
      )
      and exists (
        select 1 from public.buklod_user_follows b
        where b.follower_id = p_owner_id
          and b.followed_user_id = (select auth.uid())
      )
    when p_audience in ('MY_CHURCH','MY_ORGANIZATION') and p_scope_id is not null then
      exists (
        select 1
        from public.buklod_scope_memberships viewer
        where viewer.scope_id = p_scope_id
          and viewer.user_id = (select auth.uid())
          and viewer.membership_status = 'ACTIVE'
      )
      and exists (
        select 1
        from public.buklod_scope_memberships owner_membership
        where owner_membership.scope_id = p_scope_id
          and owner_membership.user_id = p_owner_id
          and owner_membership.membership_status = 'ACTIVE'
      )
    when p_audience = 'EVENT_GROUP' then
      (select auth.uid()) = any(coalesce(p_audience_user_ids, '{}'::uuid[]))
    else false
  end;
$$;

revoke all on function public.buklod_city_can_view_presence_v1(uuid, uuid, text, uuid[]) from public;
grant execute on function public.buklod_city_can_view_presence_v1(uuid, uuid, text, uuid[]) to authenticated;

drop function if exists public.buklod_city_set_presence_v1(double precision, double precision, text, text, uuid, integer, uuid[]);
create function public.buklod_city_set_presence_v1(
  p_latitude double precision,
  p_longitude double precision,
  p_precision_mode text default 'APPROXIMATE',
  p_audience text default 'FRIENDS',
  p_scope_id uuid default null,
  p_duration_minutes integer default 60,
  p_audience_user_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates';
  end if;
  if p_precision_mode not in ('APPROXIMATE','EXACT') then
    raise exception 'Invalid precision mode';
  end if;
  if p_audience not in ('FAMILY','FRIENDS','MY_CHURCH','MY_ORGANIZATION','EVENT_GROUP') then
    raise exception 'Invalid audience';
  end if;

  if p_audience in ('MY_CHURCH','MY_ORGANIZATION') then
    if p_scope_id is null or not exists (
      select 1 from public.buklod_scope_memberships m
      join public.buklod_scopes s on s.id = m.scope_id
      where m.scope_id = p_scope_id
        and m.user_id = v_uid
        and m.membership_status = 'ACTIVE'
        and (
          (p_audience = 'MY_CHURCH' and (
            s.scope_type = 'CHURCH'
            or upper(coalesce(s.metadata->>'organization_type','')) in ('CHURCH','MZB_MINISTRY')
          ))
          or (p_audience = 'MY_ORGANIZATION' and s.scope_type = 'ORGANIZATION')
        )
    ) then
      raise exception 'Selected audience scope is not available to this user';
    end if;
  end if;

  if p_audience = 'EVENT_GROUP' and cardinality(coalesce(p_audience_user_ids, '{}'::uuid[])) = 0 then
    raise exception 'Event group requires explicit recipients';
  end if;

  if p_duration_minutes is null or p_duration_minutes <= 0 then
    v_expires := null; -- explicit "until turned off"
  else
    v_expires := now() + make_interval(mins => least(p_duration_minutes, 1440));
  end if;

  insert into public.buklod_city_presence (
    user_id, scope_id, latitude, longitude, precision_mode, audience,
    audience_user_ids, enabled, expires_at, updated_at
  ) values (
    v_uid, p_scope_id, p_latitude, p_longitude, p_precision_mode, p_audience,
    coalesce(p_audience_user_ids, '{}'::uuid[]), true, v_expires, now()
  )
  on conflict (user_id) do update set
    scope_id = excluded.scope_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    precision_mode = excluded.precision_mode,
    audience = excluded.audience,
    audience_user_ids = excluded.audience_user_ids,
    enabled = true,
    expires_at = excluded.expires_at,
    updated_at = now();
end;
$$;

revoke all on function public.buklod_city_set_presence_v1(double precision, double precision, text, text, uuid, integer, uuid[]) from public;
grant execute on function public.buklod_city_set_presence_v1(double precision, double precision, text, text, uuid, integer, uuid[]) to authenticated;

drop function if exists public.buklod_city_stop_presence_v1();
create function public.buklod_city_stop_presence_v1()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.buklod_city_presence
  set enabled = false, updated_at = now()
  where user_id = (select auth.uid());
$$;
revoke all on function public.buklod_city_stop_presence_v1() from public;
grant execute on function public.buklod_city_stop_presence_v1() to authenticated;

drop function if exists public.buklod_city_set_scope_location_v1(uuid, double precision, double precision, text, text);
create function public.buklod_city_set_scope_location_v1(
  p_scope_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_safe_location_label text,
  p_city_category text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope public.buklod_scopes%rowtype;
  v_category text := lower(nullif(btrim(coalesce(p_city_category,'')),''));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_latitude is null or p_latitude < -90 or p_latitude > 90
     or p_longitude is null or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates';
  end if;

  select * into v_scope from public.buklod_scopes where id = p_scope_id;
  if not found then raise exception 'Scope not found'; end if;

  if not public.buklod_is_system_admin() and not public.buklod_is_scope_admin(p_scope_id) then
    raise exception 'Scope admin permission required';
  end if;
  if v_scope.scope_type not in ('ORGANIZATION','CHURCH','CLUSTER') and not public.buklod_is_system_admin() then
    raise exception 'This scope type cannot publish an institution location';
  end if;
  if v_category is not null and v_category not in ('faith','school','market','business','organization','government','community') then
    raise exception 'Invalid City category';
  end if;
  if v_category = 'government' and not public.buklod_is_system_admin() then
    raise exception 'Government categorization requires system verification';
  end if;

  update public.buklod_scopes
  set latitude = p_latitude,
      longitude = p_longitude,
      safe_location_label = nullif(btrim(coalesce(p_safe_location_label,'')),''),
      map_location_updated_at = now(),
      map_location_updated_by = (select auth.uid()),
      metadata = case
        when v_category is null then metadata
        else jsonb_set(coalesce(metadata,'{}'::jsonb), '{city_category}', to_jsonb(v_category), true)
      end,
      updated_at = now()
  where id = p_scope_id;
end;
$$;
revoke all on function public.buklod_city_set_scope_location_v1(uuid, double precision, double precision, text, text) from public;
grant execute on function public.buklod_city_set_scope_location_v1(uuid, double precision, double precision, text, text) to authenticated;

drop function if exists public.buklod_city_map_snapshot_v1();
create function public.buklod_city_map_snapshot_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with visible_scopes as (
  select
    s.id,
    s.scope_type,
    s.name,
    s.visibility,
    s.status,
    s.latitude,
    s.longitude,
    s.safe_location_label,
    s.geo_barangay,
    s.geo_city_municipality,
    s.geo_province,
    s.logo_url,
    s.metadata,
    public.buklod_is_scope_admin(s.id) as can_manage,
    exists (
      select 1 from public.buklod_scope_memberships m
      where m.scope_id = s.id
        and m.user_id = (select auth.uid())
        and m.membership_status = 'ACTIVE'
    ) as is_member
  from public.buklod_scopes s
  where s.latitude is not null
    and s.longitude is not null
    and s.status in ('ACTIVE','RESTRICTED')
    and public.buklod_can_view_scope(s.id)
), institutions as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'scopeId', id,
    'kind', 'INSTITUTION',
    'category', coalesce(
      nullif(lower(metadata->>'city_category'),''),
      case
        when upper(coalesce(metadata->>'organization_type','')) in ('CHURCH','MZB_MINISTRY') or scope_type = 'CHURCH' then 'faith'
        when upper(coalesce(metadata->>'organization_type','')) = 'SCHOOL' then 'school'
        when upper(coalesce(metadata->>'organization_type','')) in ('MARKET','PALENGKE') then 'market'
        when upper(coalesce(metadata->>'organization_type','')) = 'BUSINESS' then 'business'
        when upper(coalesce(metadata->>'organization_type','')) in ('GOVERNMENT','LGU','BARANGAY') then 'government'
        else 'organization'
      end
    ),
    'title', name,
    'subtitle', safe_location_label,
    'latitude', latitude,
    'longitude', longitude,
    'verified', coalesce((metadata->>'city_verified')::boolean, false),
    'canManage', can_manage,
    'isMember', is_member,
    'scopeType', scope_type,
    'logoUrl', logo_url,
    'locality', coalesce(geo_barangay, geo_city_municipality, geo_province)
  ) order by name), '[]'::jsonb) as data
  from visible_scopes
), items as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'scopeId', i.scope_id,
    'kind', i.item_type,
    'category', lower(i.item_type),
    'title', i.title,
    'subtitle', i.address_label,
    'description', i.description,
    'latitude', i.latitude,
    'longitude', i.longitude,
    'verified', i.verified,
    'startsAt', i.starts_at,
    'endsAt', i.ends_at,
    'status', i.status,
    'metadata', i.metadata
  ) order by coalesce(i.starts_at, i.created_at) desc), '[]'::jsonb) as data
  from public.buklod_city_map_items i
  where i.status = 'ACTIVE'
    and (
      i.visibility = 'PUBLIC'
      or i.created_by = (select auth.uid())
      or public.buklod_is_system_admin()
      or (i.scope_id is not null and public.buklod_can_view_scope(i.scope_id))
    )
    and (i.ends_at is null or i.ends_at >= now() - interval '12 hours')
), people as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.user_id,
    'kind', 'PERSON',
    'category', 'people',
    'title', coalesce(nullif(pr.full_name,''), 'BUKLOD member'),
    'subtitle', case when p.precision_mode = 'EXACT' then 'Shared exact location' else 'Shared approximate area' end,
    'latitude', case when p.precision_mode = 'EXACT' then p.latitude else round(p.latitude::numeric, 2)::double precision end,
    'longitude', case when p.precision_mode = 'EXACT' then p.longitude else round(p.longitude::numeric, 2)::double precision end,
    'precisionMode', p.precision_mode,
    'audience', p.audience,
    'expiresAt', p.expires_at,
    'isMe', p.user_id = (select auth.uid())
  )), '[]'::jsonb) as data
  from public.buklod_city_presence p
  left join public.profiles pr on pr.id = p.user_id
  where p.enabled = true
    and (p.expires_at is null or p.expires_at > now())
    and public.buklod_city_can_view_presence_v1(p.user_id, p.scope_id, p.audience, p.audience_user_ids)
)
select jsonb_build_object(
  'institutions', (select data from institutions),
  'items', (select data from items),
  'people', (select data from people),
  'generatedAt', now()
);
$$;
revoke all on function public.buklod_city_map_snapshot_v1() from public;
grant execute on function public.buklod_city_map_snapshot_v1() to authenticated;

comment on table public.buklod_city_map_items is 'BUKLOD City locality map events, services, and Bayanihan records. Institution coordinates remain canonical on buklod_scopes.';
comment on table public.buklod_city_presence is 'Privacy-sensitive City presence. Direct reads are revoked; coordinates are exposed only through the masking RPC.';
