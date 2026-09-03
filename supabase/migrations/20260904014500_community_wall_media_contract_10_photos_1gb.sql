-- BUKLOD Community / Wall media contract
-- Canonical: up to 10 photos OR one GIF OR one video.
-- Wall video: <= 1 GiB and <= 30 minutes (duration is enforced by app policy).
-- Reels remain <= 60 seconds in app policy.

begin;

update storage.buckets
set file_size_limit = 1073741824,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/quicktime','video/webm','video/x-m4v'
    ]::text[]
where id='community-media';

alter table public.community_post_media
  drop constraint if exists community_post_media_media_position_check,
  drop constraint if exists community_post_media_media_mime_type_check,
  drop constraint if exists community_post_media_media_size_bytes_check;

alter table public.community_post_media
  add constraint community_post_media_media_position_check
    check (media_position >= 0 and media_position <= 9),
  add constraint community_post_media_media_mime_type_check
    check (
      media_mime_type is null or media_mime_type in (
        'image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/quicktime','video/webm','video/x-m4v'
      )
    ),
  add constraint community_post_media_media_size_bytes_check
    check (
      media_size_bytes is null or
      (media_size_bytes >= 1 and media_size_bytes <= 1073741824)
    );

create or replace function public.set_buklod_post_media_v4(
  p_post_id uuid,
  p_media jsonb
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_media jsonb := coalesce(p_media,'[]'::jsonb);
  v_count integer;
  v_video_count integer := 0;
  v_gif_count integer := 0;
  v_item jsonb;
  v_path text;
  v_mime text;
  v_size bigint;
  v_index integer := 0;
  v_first_path text := null;
  v_first_mime text := null;
  v_first_size bigint := null;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  select p.user_id into v_owner
  from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null;

  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor then raise exception 'Only the post author may attach media'; end if;
  if jsonb_typeof(v_media) is distinct from 'array' then
    raise exception 'Media payload must be an array';
  end if;

  v_count:=jsonb_array_length(v_media);
  if v_count>10 then
    raise exception 'You can add up to 10 photos per post, or one video.';
  end if;

  -- Validate all rows before replacing existing media.
  for v_item in select value from jsonb_array_elements(v_media)
  loop
    v_path:=nullif(trim(v_item->>'media_path'),'');
    v_mime:=lower(coalesce(nullif(trim(v_item->>'media_mime_type'),''),'image/jpeg'));
    v_size:=nullif(nullif(v_item->>'media_size_bytes','')::bigint,0);

    if v_path is null then raise exception 'Media path is required'; end if;
    if (storage.foldername(v_path))[1] is distinct from v_actor::text then
      raise exception 'Invalid community media path';
    end if;
    if v_mime not in (
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/quicktime','video/webm','video/x-m4v'
    ) then
      raise exception 'Unsupported community media type: %',v_mime;
    end if;

    if v_mime like 'video/%' then
      v_video_count:=v_video_count+1;
      if v_size is not null and (v_size<1 or v_size>1073741824) then
        raise exception 'Wall video must be 1 GB or smaller';
      end if;
    elsif v_mime='image/gif' then
      v_gif_count:=v_gif_count+1;
      if v_size is not null and (v_size<1 or v_size>26214400) then
        raise exception 'GIF must be 25 MB or smaller';
      end if;
    else
      if v_size is not null and (v_size<1 or v_size>5242880) then
        raise exception 'Each photo must be 5 MB or smaller';
      end if;
    end if;
  end loop;

  if v_video_count>1 or (v_video_count=1 and v_count<>1) then
    raise exception 'Choose either photos/GIF or one video for this Wall post.';
  end if;
  if v_gif_count>1 or (v_gif_count=1 and v_count<>1) then
    raise exception 'Choose either a GIF, photos, or one video for this Wall post.';
  end if;

  delete from public.community_post_media where post_id=p_post_id;

  for v_item in select value from jsonb_array_elements(v_media)
  loop
    v_path:=nullif(trim(v_item->>'media_path'),'');
    v_mime:=lower(coalesce(nullif(trim(v_item->>'media_mime_type'),''),'image/jpeg'));
    v_size:=nullif(nullif(v_item->>'media_size_bytes','')::bigint,0);

    insert into public.community_post_media(
      post_id,media_position,media_path,media_mime_type,media_size_bytes
    ) values(
      p_post_id,v_index::smallint,v_path,v_mime,v_size
    );

    if v_index=0 then
      v_first_path:=v_path;
      v_first_mime:=v_mime;
      v_first_size:=v_size;
    end if;
    v_index:=v_index+1;
  end loop;

  update public.community_posts
  set media_path=v_first_path,
      media_mime_type=v_first_mime,
      media_size_bytes=v_first_size,
      updated_at=now()
  where id=p_post_id;

  return v_index;
end
$function$;

revoke all on function public.set_buklod_post_media_v4(uuid,jsonb) from public;
grant execute on function public.set_buklod_post_media_v4(uuid,jsonb) to authenticated;

create or replace function public.set_buklod_post_media_v3(
  p_post_id uuid,
  p_media jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.set_buklod_post_media_v4(p_post_id,p_media);
end
$function$;

revoke all on function public.set_buklod_post_media_v3(uuid,jsonb) from public;
grant execute on function public.set_buklod_post_media_v3(uuid,jsonb) to authenticated;

commit;
