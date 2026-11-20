-- BUKLOD | Public Wall "Post as scope" (opt-in, never syndicate private Scope Wall posts).
-- Every post is a canonical public post owned by its real member. Only identity is attributed.
-- The PRIVATE/INVITE_ONLY Scope Wall post feed and its existing RPC remain unchanged.

create table if not exists public.buklod_public_wall_scope_identity (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  scope_id uuid not null references public.buklod_scopes(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  hide_author_name boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists buklod_public_wall_scope_identity_scope_idx
  on public.buklod_public_wall_scope_identity (scope_id, created_at desc);

alter table public.buklod_public_wall_scope_identity enable row level security;
-- No client-facing SELECT/INSERT/UPDATE/DELETE policies. Read only through a visibility-checked RPC.
revoke all on table public.buklod_public_wall_scope_identity from public, anon, authenticated;

create or replace function public.create_buklod_public_wall_scope_post_v1(
  p_scope_id uuid,
  p_category text default 'reflection',
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_mentioned_user_ids uuid[] default '{}'::uuid[],
  p_media_duration_seconds numeric default null,
  p_is_reel boolean default false
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  created_post_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  -- Actual active member of the exact selected scope, never a spoofed free-text label.
  if p_scope_id is null or not exists (
    select 1
    from public.buklod_scopes s
    join public.buklod_scope_memberships m on m.scope_id = s.id
    join public.profiles p on p.id = m.user_id
    where s.id = p_scope_id
      and s.scope_type in ('CLUSTER', 'ORGANIZATION', 'LOCAL')
      and s.status = 'ACTIVE'
      and m.user_id = actor
      and m.membership_status = 'ACTIVE'
      and p.is_active = true
  ) then
    raise exception 'An active membership in the selected Cluster, Organization or Location is required';
  end if;

  -- The existing public-post RPC owns media checks, policy checks, mention validation,
  -- moderation hooks and notifications; do not bypass them.
  created_post_id := public.create_buklod_community_post_v3(
    'public', null, p_category, p_body, p_media_path, p_media_mime_type,
    p_media_size_bytes, p_mentioned_user_ids, p_media_duration_seconds, p_is_reel
  );

  insert into public.buklod_public_wall_scope_identity (post_id, scope_id, author_id, hide_author_name)
  values (created_post_id, p_scope_id, actor, public.buklod_is_scope_admin(p_scope_id));

  return created_post_id;
end;
$$;

create or replace function public.get_buklod_public_wall_scope_identities_v1(
  p_post_ids uuid[]
) returns table (
  post_id uuid,
  scope_id uuid,
  scope_name text,
  scope_type text,
  scope_logo_url text,
  scope_geo_level text,
  parent_scope_id uuid,
  safe_location_label text,
  hide_author_name boolean
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.is_active = true
     ) then
    return;
  end if;

  return query
  select a.post_id, a.scope_id, s.name::text, s.scope_type::text,
         s.logo_url::text, s.geo_level::text, s.parent_scope_id, s.safe_location_label::text, a.hide_author_name
  from public.buklod_public_wall_scope_identity a
  join public.community_posts p on p.id = a.post_id and p.user_id = a.author_id
  join public.buklod_scopes s on s.id = a.scope_id
  where a.post_id = any(coalesce(p_post_ids[1:100], array[]::uuid[]))
    and p.audience = 'public' and p.scope_id is null
    and p.deleted_at is null and p.is_hidden = false
    and public.can_view_community_post_v2(p.id);
end;
$$;

revoke all on function public.create_buklod_public_wall_scope_post_v1(
  uuid,text,text,text,text,bigint,uuid[],numeric,boolean
) from public, anon;
revoke all on function public.get_buklod_public_wall_scope_identities_v1(uuid[]) from public, anon;
grant execute on function public.create_buklod_public_wall_scope_post_v1(
  uuid,text,text,text,text,bigint,uuid[],numeric,boolean
) to authenticated;
grant execute on function public.get_buklod_public_wall_scope_identities_v1(uuid[]) to authenticated;
