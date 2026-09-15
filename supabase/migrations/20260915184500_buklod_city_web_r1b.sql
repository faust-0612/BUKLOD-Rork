-- BUKLOD CITY WEB R1B
-- Complete My Places semantics for events/services/Bayanihan and harden
-- verification parsing. Replaces snapshot function only.

create or replace function public.buklod_city_map_snapshot_v1()
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
      select 1
      from public.buklod_scope_memberships m
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
    'verified', lower(coalesce(metadata->>'city_verified','false')) in ('true','1','yes'),
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
    'metadata', i.metadata,
    'locality', coalesce(s.geo_barangay, s.geo_city_municipality, s.geo_province),
    'isMember', coalesce(vs.is_member, false),
    'canManage', coalesce(vs.can_manage, false)
  ) order by coalesce(i.starts_at, i.created_at) desc), '[]'::jsonb) as data
  from public.buklod_city_map_items i
  left join public.buklod_scopes s on s.id = i.scope_id
  left join visible_scopes vs on vs.id = i.scope_id
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
