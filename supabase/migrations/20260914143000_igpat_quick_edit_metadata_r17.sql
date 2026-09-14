-- BUKLOD IGPAT R17
-- Non-destructive Quick Edit metadata. The original uploaded media remains intact;
-- supported playback edits are persisted separately and enforced by IGPAT clients.

alter table public.community_posts
  add column if not exists igpat_edit_meta jsonb;

comment on column public.community_posts.igpat_edit_meta is
  'BUKLOD IGPAT non-destructive edit metadata. Null for legacy/unmodified posts.';

create or replace function public.create_buklod_reel_v2(
  p_audience text,
  p_group_id uuid default null,
  p_body text default '',
  p_media_path text default null,
  p_media_mime_type text default null,
  p_media_size_bytes bigint default null,
  p_duration_seconds numeric default null,
  p_edit_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_id uuid;
  safe_meta jsonb := coalesce(p_edit_meta, '{}'::jsonb);
  trim_start numeric;
  trim_end numeric;
  speed_value numeric;
  rotation_value integer;
  cover_value numeric;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(safe_meta) <> 'object' then
    raise exception 'Invalid IGPAT edit metadata';
  end if;

  trim_start := greatest(0, coalesce(nullif(safe_meta->>'trim_start_seconds', '')::numeric, 0));
  trim_end := least(
    coalesce(p_duration_seconds, 0),
    coalesce(nullif(safe_meta->>'trim_end_seconds', '')::numeric, p_duration_seconds)
  );
  speed_value := coalesce(nullif(safe_meta->>'speed', '')::numeric, 1);
  rotation_value := coalesce(nullif(safe_meta->>'rotation', '')::integer, 0);
  cover_value := coalesce(nullif(safe_meta->>'cover_seconds', '')::numeric, trim_start);

  if p_duration_seconds is null or p_duration_seconds <= 0 or p_duration_seconds > 60 then
    raise exception 'BUKLOD IGPAT may be up to 60 seconds only';
  end if;

  if trim_end <= trim_start or trim_end - trim_start < 1 then
    raise exception 'IGPAT trim must keep at least 1 second';
  end if;

  if trim_start < 0 or trim_end > p_duration_seconds then
    raise exception 'IGPAT trim is outside the source video';
  end if;

  if speed_value not in (0.5, 0.75, 1, 1.25, 1.5, 2) then
    raise exception 'Unsupported IGPAT playback speed';
  end if;

  if rotation_value not in (0, 90, 180, 270) then
    raise exception 'Unsupported IGPAT rotation';
  end if;

  if coalesce(safe_meta->>'content_fit', 'contain') not in ('contain', 'cover') then
    raise exception 'Unsupported IGPAT framing mode';
  end if;

  if length(coalesce(safe_meta->>'text_overlay', '')) > 160 then
    raise exception 'IGPAT text overlay is too long';
  end if;

  if cover_value < trim_start or cover_value > trim_end then
    raise exception 'IGPAT cover frame must be inside the trimmed video';
  end if;

  new_id := public.create_buklod_reel_v1(
    p_audience,
    p_group_id,
    p_body,
    p_media_path,
    p_media_mime_type,
    p_media_size_bytes,
    p_duration_seconds
  );

  update public.community_posts
  set igpat_edit_meta = jsonb_build_object(
    'version', 1,
    'trim_start_seconds', trim_start,
    'trim_end_seconds', trim_end,
    'speed', speed_value,
    'muted', coalesce((safe_meta->>'muted')::boolean, false),
    'text_overlay', left(coalesce(safe_meta->>'text_overlay', ''), 160),
    'content_fit', coalesce(safe_meta->>'content_fit', 'contain'),
    'rotation', rotation_value,
    'cover_seconds', cover_value
  )
  where id = new_id
    and user_id = actor;

  return new_id;
end;
$$;

create or replace function public.get_buklod_igpat_feed_v3(
  p_mode text default 'for-you',
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
  my_reaction text,
  igpat_edit_meta jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    feed.id,
    feed.user_id,
    feed.author_name,
    feed.audience,
    feed.category,
    feed.body,
    feed.created_at,
    feed.media_path,
    feed.media_mime_type,
    feed.media_size_bytes,
    feed.media_duration_seconds,
    feed.reaction_counts,
    feed.reaction_count,
    feed.comment_count,
    feed.my_reaction,
    cp.igpat_edit_meta
  from public.get_buklod_igpat_feed_v2(p_mode, p_limit) feed
  join public.community_posts cp on cp.id = feed.id;
$$;

create or replace function public.get_buklod_igpat_edit_v1(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'IGPAT is unavailable for this account';
  end if;

  select cp.igpat_edit_meta
    into result
  from public.community_posts cp
  where cp.id = p_post_id
    and cp.is_reel = true
    and cp.deleted_at is null
    and cp.is_hidden = false;

  return result;
end;
$$;

revoke all on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) from public;
revoke all on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) from anon;
grant execute on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) to authenticated;
grant execute on function public.create_buklod_reel_v2(text,uuid,text,text,text,bigint,numeric,jsonb) to service_role;

revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from public;
revoke all on function public.get_buklod_igpat_feed_v3(text,integer) from anon;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to authenticated;
grant execute on function public.get_buklod_igpat_feed_v3(text,integer) to service_role;

revoke all on function public.get_buklod_igpat_edit_v1(uuid) from public;
revoke all on function public.get_buklod_igpat_edit_v1(uuid) from anon;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to authenticated;
grant execute on function public.get_buklod_igpat_edit_v1(uuid) to service_role;
