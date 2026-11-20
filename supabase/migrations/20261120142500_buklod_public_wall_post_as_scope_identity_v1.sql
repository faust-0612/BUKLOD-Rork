-- BUKLOD | Public Wall "Post as scope" (opt-in, never syndicate private Scope Wall posts).
-- Every post is a canonical public post owned by its real member. Only identity is attributed.
-- The PRIVATE/INVITE_ONLY Scope Wall post feed and its existing RPC remain unchanged.

create table if not exists public.buklod_public_wall_scope_identity (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  scope_id uuid references public.buklod_scopes(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  hide_author_name boolean not null default false,
  scope_name_at_post text not null,
  scope_type_at_post text not null,
  scope_logo_url_at_post text,
  scope_geo_level_at_post text,
  parent_scope_id_at_post uuid,
  safe_location_label_at_post text,
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

  insert into public.buklod_public_wall_scope_identity (
    post_id, scope_id, author_id, hide_author_name,
    scope_name_at_post, scope_type_at_post, scope_logo_url_at_post,
    scope_geo_level_at_post, parent_scope_id_at_post, safe_location_label_at_post
  )
  select created_post_id, s.id, actor, public.buklod_is_scope_admin(s.id),
         s.name, s.scope_type, s.logo_url, s.geo_level, s.parent_scope_id, s.safe_location_label
  from public.buklod_scopes s where s.id=p_scope_id;

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
  select a.post_id, a.scope_id,
         coalesce(s.name, a.scope_name_at_post)::text,
         coalesce(s.scope_type, a.scope_type_at_post)::text,
         coalesce(s.logo_url, a.scope_logo_url_at_post)::text,
         coalesce(s.geo_level, a.scope_geo_level_at_post)::text,
         coalesce(s.parent_scope_id, a.parent_scope_id_at_post),
         coalesce(s.safe_location_label, a.safe_location_label_at_post)::text,
         a.hide_author_name
  from public.buklod_public_wall_scope_identity a
  join public.community_posts p on p.id = a.post_id and p.user_id = a.author_id
  left join public.buklod_scopes s on s.id = a.scope_id
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

-- Additive Public Wall feed version: author identity arrives with the first paint.
-- The existing v7 feed remains the authority for access control, location filters,
-- ranking, pagination and private/anonymous-content protections.
create or replace function public.get_buklod_public_community_feed_v8_page(
  p_location_scope_id uuid default null,
  p_mode text default 'for_you',
  p_limit integer default 40,
  p_offset integer default 0
) returns table (
  id uuid,
  user_id uuid,
  author_name text,
  group_id uuid,
  church_id uuid,
  audience text,
  body text,
  category text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  reaction_counts jsonb,
  total_reactions bigint,
  comment_count bigint,
  mentions jsonb,
  score_total numeric,
  score_recency numeric,
  score_scope_relevance numeric,
  score_interaction_affinity numeric,
  score_content_preference numeric,
  score_engagement numeric,
  score_priority numeric,
  is_following_author boolean,
  shares_active_scope boolean,
  public_scope_identity jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select r.*,
    case when a.post_id is null then null::jsonb else jsonb_build_object(
      'post_id', a.post_id,
      'scope_id', a.scope_id,
      'scope_name', coalesce(s.name,a.scope_name_at_post),
      'scope_type', coalesce(s.scope_type,a.scope_type_at_post),
      'scope_logo_url', coalesce(s.logo_url,a.scope_logo_url_at_post),
      'scope_geo_level', coalesce(s.geo_level,a.scope_geo_level_at_post),
      'parent_scope_id', coalesce(s.parent_scope_id,a.parent_scope_id_at_post),
      'safe_location_label', coalesce(s.safe_location_label,a.safe_location_label_at_post),
      'hide_author_name', a.hide_author_name
    ) end as public_scope_identity
  from public.get_buklod_public_community_feed_v7_page(
    p_location_scope_id,p_mode,p_limit,p_offset
  ) r
  left join public.buklod_public_wall_scope_identity a on a.post_id=r.id
  left join public.buklod_scopes s on s.id=a.scope_id;
$$;

revoke all on function public.get_buklod_public_community_feed_v8_page(
  uuid,text,integer,integer
) from public,anon;
grant execute on function public.get_buklod_public_community_feed_v8_page(
  uuid,text,integer,integer
) to authenticated;
