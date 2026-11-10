-- Photo-scoped comments reuse the canonical comments table, moderation, replies,
-- comment reactions and community audience RLS. Old clients remain readable.
-- Apply this additive schema migration before publishing the matching OTA.
alter table public.comments
  add column if not exists media_position smallint;

create index if not exists comments_photo_scoped_visible_idx
  on public.comments (post_id, media_position, created_at)
  where media_position is not null and is_hidden = false;

-- Restore canonical media rows for old single-photo posts: without these
-- rows the pre-existing per-photo reaction RPC cannot operate. The operation
-- is idempotent and copies only existing image metadata, never media bytes.
insert into public.community_post_media(
  post_id, media_position, media_path, media_mime_type, media_size_bytes
)
select cp.id, 0::smallint, cp.media_path, cp.media_mime_type, cp.media_size_bytes
from public.community_posts cp
where cp.media_path is not null
  and cp.media_mime_type like 'image/%'
  and cp.is_hidden = false
  and cp.deleted_at is null
  and not exists (
    select 1 from public.community_post_media m where m.post_id = cp.id
  )
on conflict (post_id, media_position) do nothing;

-- A photo may be represented by community_post_media, or by the legacy
-- single-photo community_posts media_path fallback.
create or replace function public.get_buklod_photo_comments_v1(
  p_post_id uuid,
  p_media_position smallint
)
returns table(
  id uuid,
  user_id uuid,
  commenter_name text,
  body text,
  created_at timestamptz,
  parent_id uuid,
  parent_commenter_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
     or not public.can_view_community_post_v2(p_post_id)
  then
    raise exception 'Post is not visible to your account';
  end if;

  if p_media_position is null or p_media_position < 0 then
    raise exception 'Invalid photo position';
  end if;

  return query
    select c.id, c.user_id,
           coalesce(p.full_name, 'BUKLOD Member')::text,
           c.body, c.created_at, c.parent_id,
           case when c.parent_id is null then null
                else coalesce(parent_profile.full_name, 'BUKLOD Member')::text
           end
    from public.comments c
    join public.profiles p on p.id = c.user_id
    left join public.comments parent on parent.id = c.parent_id
    left join public.profiles parent_profile on parent_profile.id = parent.user_id
    where c.post_id = p_post_id
      and c.media_position = p_media_position
      and c.is_hidden = false
      and c.deleted_at is null
    order by c.created_at asc;
end;
$function$;

create or replace function public.get_buklod_photo_comment_counts_v1(
  p_post_id uuid
)
returns table(media_position smallint, comment_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null
     or not public.can_view_community_post_v2(p_post_id)
  then
    raise exception 'Post is not visible to your account';
  end if;

  return query
    select c.media_position, count(*)::bigint
    from public.comments c
    where c.post_id = p_post_id
      and c.media_position is not null
      and c.is_hidden = false
      and c.deleted_at is null
    group by c.media_position;
end;
$function$;

create or replace function public.add_buklod_photo_comment_v1(
  p_post_id uuid,
  p_media_position smallint,
  p_body text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_body text := trim(coalesce(p_body, ''));
  new_id uuid;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if not public.can_view_community_post_v2(p_post_id) then
    raise exception 'Post is not visible to your account';
  end if;

  if p_media_position is null or p_media_position < 0 then
    raise exception 'Invalid photo position';
  end if;

  if length(clean_body) not between 1 and 2000 then
    raise exception 'Comment must be 1 to 2000 characters';
  end if;

  if not exists (
      select 1 from public.community_post_media m
      where m.post_id = p_post_id
        and m.media_position = p_media_position
        and m.media_mime_type like 'image/%'
    ) and not (
      p_media_position = 0 and exists (
        select 1 from public.community_posts cp
        where cp.id = p_post_id
          and cp.media_path is not null
          and cp.media_mime_type like 'image/%'
          and not exists (
            select 1 from public.community_post_media m where m.post_id = p_post_id
          )
      )
    )
  then
    raise exception 'Photo is unavailable';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.comments parent
    where parent.id = p_parent_id
      and parent.post_id = p_post_id
      and parent.media_position = p_media_position
      and parent.is_hidden = false
      and parent.deleted_at is null
  ) then
    raise exception 'Reply target is not available on this photo';
  end if;

  insert into public.comments(post_id,user_id,body,parent_id,media_position)
  values(p_post_id,actor,clean_body,p_parent_id,p_media_position)
  returning id into new_id;
  return new_id;
end;
$function$;

revoke all on function public.get_buklod_photo_comments_v1(uuid, smallint) from public, anon;
revoke all on function public.get_buklod_photo_comment_counts_v1(uuid) from public, anon;
revoke all on function public.add_buklod_photo_comment_v1(uuid, smallint, text, uuid) from public, anon;
grant execute on function public.get_buklod_photo_comments_v1(uuid, smallint) to authenticated;
grant execute on function public.get_buklod_photo_comment_counts_v1(uuid) to authenticated;
grant execute on function public.add_buklod_photo_comment_v1(uuid, smallint, text, uuid) to authenticated;
