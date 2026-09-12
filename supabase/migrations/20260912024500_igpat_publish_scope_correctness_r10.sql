-- BUKLOD IGPAT R10
-- Correct IGPAT scope metadata and ensure the IGPAT feed contains only
-- canonical short-form IGPAT rows (legacy reel rows remain compatible).

create or replace function public.create_buklod_reel_v1(
  p_audience text,
  p_group_id uuid default null,
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_duration_seconds numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_church uuid;
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select p.church_id
    into actor_church
  from public.profiles p
  where p.id = actor
    and p.is_active = true;

  if not found then
    raise exception 'Active BUKLOD account required';
  end if;

  if p_audience not in ('group', 'local', 'public') then
    raise exception 'Invalid IGPAT audience';
  end if;

  if p_media_path is null or trim(p_media_path) = '' then
    raise exception 'IGPAT video file is required';
  end if;

  if lower(coalesce(p_media_mime_type, '')) not in (
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ) then
    raise exception 'Unsupported IGPAT video format';
  end if;

  if p_duration_seconds is null
     or p_duration_seconds <= 0
     or p_duration_seconds > 60 then
    raise exception 'BUKLOD IGPAT may be up to 60 seconds only';
  end if;

  if coalesce(p_media_size_bytes, 0) > 1073741824 then
    raise exception 'BUKLOD IGPAT videos must be 1 GB or smaller';
  end if;

  if split_part(p_media_path, '/', 1) <> actor::text then
    raise exception 'Invalid IGPAT media owner path';
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'community-media'
      and o.name = p_media_path
  ) then
    raise exception 'Uploaded IGPAT video was not found';
  end if;

  if p_audience = 'group' then
    if p_group_id is null then
      raise exception 'A BUKLOD Cluster is required';
    end if;

    if not exists (
      select 1
      from public.group_members gm
      join public.buklod_groups g
        on g.id = gm.group_id
      where gm.group_id = p_group_id
        and gm.user_id = actor
        and gm.is_active = true
        and g.is_active = true
    ) then
      raise exception 'You are not an active member of this BUKLOD Cluster';
    end if;
  elsif p_audience in ('local', 'public') then
    if actor_church is null then
      raise exception 'A Local Church assignment is required';
    end if;
  end if;

  insert into public.community_posts (
    user_id,
    group_id,
    church_id,
    audience,
    category,
    body,
    media_path,
    media_mime_type,
    media_size_bytes,
    media_duration_seconds,
    is_reel,
    created_at,
    updated_at
  )
  values (
    actor,
    case when p_audience = 'group' then p_group_id else null end,
    case when p_audience = 'local' then actor_church else null end,
    p_audience,
    'encouragement',
    coalesce(nullif(trim(coalesce(p_body, '')), ''), 'Shared a BUKLOD IGPAT.'),
    p_media_path,
    lower(p_media_mime_type),
    p_media_size_bytes,
    p_duration_seconds,
    true,
    now(),
    now()
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.get_buklod_reels_v1(
  p_limit integer default 15
)
returns table(
  id uuid,
  user_id uuid,
  author_name text,
  audience text,
  category text,
  body text,
  created_at timestamptz,
  media_path text,
  media_mime_type text,
  media_size_bytes bigint,
  media_duration_seconds numeric,
  reaction_counts jsonb,
  reaction_count bigint,
  comment_count bigint,
  my_reaction text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  safe_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  return query
  select
    cp.id,
    cp.user_id,
    coalesce(author.full_name, 'BUKLOD Member')::text,
    cp.audience::text,
    cp.category::text,
    cp.body,
    cp.created_at,
    cp.media_path,
    cp.media_mime_type,
    cp.media_size_bytes::bigint,
    cp.media_duration_seconds::numeric,
    coalesce(
      (
        select jsonb_object_agg(z.reaction, z.cnt)
        from (
          select rx.reaction::text as reaction, count(*)::bigint as cnt
          from public.reactions rx
          where rx.post_id = cp.id
          group by rx.reaction
        ) z
      ),
      '{}'::jsonb
    ),
    (
      select count(*)::bigint
      from public.reactions rx
      where rx.post_id = cp.id
    ),
    (
      select count(*)::bigint
      from public.comments cm
      where cm.post_id = cp.id
        and cm.is_hidden = false
    ),
    (
      select rx.reaction::text
      from public.reactions rx
      where rx.post_id = cp.id
        and rx.user_id = actor
      order by rx.created_at desc
      limit 1
    )
  from public.community_posts cp
  join public.profiles author
    on author.id = cp.user_id
  where cp.is_hidden = false
    and cp.deleted_at is null
    and cp.is_reel = true
    and cp.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(cp.id)
  order by cp.created_at desc
  limit safe_limit;
end;
$$;

revoke all on function public.create_buklod_reel_v1(text,uuid,text,text,text,bigint,numeric) from public;
revoke all on function public.create_buklod_reel_v1(text,uuid,text,text,text,bigint,numeric) from anon;
grant execute on function public.create_buklod_reel_v1(text,uuid,text,text,text,bigint,numeric) to authenticated;
grant execute on function public.create_buklod_reel_v1(text,uuid,text,text,text,bigint,numeric) to service_role;

revoke all on function public.get_buklod_reels_v1(integer) from public;
revoke all on function public.get_buklod_reels_v1(integer) from anon;
grant execute on function public.get_buklod_reels_v1(integer) to authenticated;
grant execute on function public.get_buklod_reels_v1(integer) to service_role;
