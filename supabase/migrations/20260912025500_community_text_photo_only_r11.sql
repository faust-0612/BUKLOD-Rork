-- BUKLOD Community R11
-- Community is text/photo social posting. BUKLOD IGPAT is the sole video
-- publishing surface. GIF/video creation through legacy Community RPCs is
-- blocked server-side while existing historical media remains readable.

create or replace function public.create_buklod_community_post_v2(
  p_audience text,
  p_group_id uuid default null,
  p_category text default 'reflection',
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null
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
  v_mime text := lower(coalesce(p_media_mime_type, ''));
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
    raise exception 'Choose GROUP, LOCAL, or PUBLIC';
  end if;

  if p_category not in (
    'reflection', 'testimony', 'encouragement',
    'prayer_update', 'discussion', 'announcement'
  ) then
    raise exception 'Invalid post category';
  end if;

  if trim(coalesce(p_body, '')) = '' and p_media_path is null then
    raise exception 'Write a post or attach a photo';
  end if;

  if v_mime like 'video/%' or v_mime = 'image/gif' then
    raise exception 'Community accepts text and photos only. Use BUKLOD IGPAT for video.';
  end if;

  if p_media_path is not null then
    if (storage.foldername(p_media_path))[1] is distinct from actor::text then
      raise exception 'Invalid community media path';
    end if;

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'community-media'
        and o.name = p_media_path
    ) then
      raise exception 'Uploaded community photo was not found';
    end if;
  end if;

  if v_mime like 'image/%'
     and coalesce(p_media_size_bytes, 0) > 10485760 then
    raise exception 'Images must be 10 MB or smaller';
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
  elsif p_audience = 'local' then
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
    media_size_bytes
  )
  values (
    actor,
    case when p_audience = 'group' then p_group_id else null end,
    case when p_audience = 'local' then actor_church else null end,
    p_audience,
    p_category,
    coalesce(nullif(trim(coalesce(p_body, '')), ''), 'Shared a photo.'),
    p_media_path,
    p_media_mime_type,
    p_media_size_bytes
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.create_buklod_community_post_v2(
  p_audience text,
  p_group_id uuid default null,
  p_category text default 'reflection',
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_media_duration_seconds numeric default null,
  p_is_reel boolean default false
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
  v_mime text := lower(coalesce(p_media_mime_type, ''));
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
    raise exception 'Choose GROUP, LOCAL, or PUBLIC';
  end if;

  if p_category not in (
    'reflection', 'testimony', 'encouragement',
    'prayer_update', 'discussion', 'announcement'
  ) then
    raise exception 'Invalid post category';
  end if;

  if trim(coalesce(p_body, '')) = '' and p_media_path is null then
    raise exception 'Write a post or attach a photo';
  end if;

  if coalesce(p_is_reel, false)
     or v_mime like 'video/%'
     or v_mime = 'image/gif' then
    raise exception 'Community accepts text and photos only. Use BUKLOD IGPAT for video.';
  end if;

  if p_media_path is not null then
    if (storage.foldername(p_media_path))[1] is distinct from actor::text then
      raise exception 'Invalid community media path';
    end if;

    if not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'community-media'
        and o.name = p_media_path
    ) then
      raise exception 'Uploaded community photo was not found';
    end if;
  end if;

  if v_mime like 'image/%'
     and coalesce(p_media_size_bytes, 0) > 10485760 then
    raise exception 'Images must be 10 MB or smaller';
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
  elsif p_audience = 'local' then
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
    is_reel
  )
  values (
    actor,
    case when p_audience = 'group' then p_group_id else null end,
    case when p_audience = 'local' then actor_church else null end,
    p_audience,
    p_category,
    coalesce(nullif(trim(coalesce(p_body, '')), ''), 'Shared a photo.'),
    p_media_path,
    p_media_mime_type,
    p_media_size_bytes,
    null,
    false
  )
  returning id into new_id;

  return new_id;
end;
$$;
