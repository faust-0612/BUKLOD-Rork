-- BUKLOD COMMUNITY MIXED MEDIA R1
-- Backward-compatible: v5 remains unchanged for older app versions.
-- v6 allows up to 10 total media items with at most one Wall video.
begin;

create or replace function public.set_buklod_post_media_v6(p_post_id uuid,p_media jsonb)
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
  v_item jsonb;
  v_path text;
  v_mime text;
  v_size bigint;
  v_provider text;
  v_external_key text;
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
  if jsonb_typeof(v_media) is distinct from 'array' then raise exception 'Media payload must be an array'; end if;

  v_count:=jsonb_array_length(v_media);
  if v_count>10 then raise exception 'You can add up to 10 media items per Wall post.'; end if;

  for v_item in select value from jsonb_array_elements(v_media)
  loop
    v_path:=nullif(trim(v_item->>'media_path'),'');
    v_mime:=lower(coalesce(nullif(trim(v_item->>'media_mime_type'),''),'image/jpeg'));
    v_size:=nullif(nullif(v_item->>'media_size_bytes','')::bigint,0);
    v_provider:=upper(coalesce(nullif(trim(v_item->>'storage_provider'),''),'SUPABASE'));
    v_external_key:=nullif(trim(v_item->>'external_object_key'),'');

    if v_mime not in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm','video/x-m4v') then
      raise exception 'Unsupported community media type: %',v_mime;
    end if;

    if v_mime like 'video/%' then
      v_video_count:=v_video_count+1;
      if v_size is not null and (v_size<1 or v_size>1073741824) then
        raise exception 'Wall video must be 1 GB or smaller';
      end if;
    else
      if v_provider<>'SUPABASE' then raise exception 'External storage is currently video-only'; end if;
      if v_size is not null and (v_size<1 or v_size>5242880) then raise exception 'Each photo must be 5 MB or smaller'; end if;
    end if;

    if v_provider='AWS' then
      if v_external_key is null or v_external_key not like ('wall/'||v_actor::text||'/%') then
        raise exception 'Invalid external video object key';
      end if;
      v_path:='aws:'||v_external_key;
    elsif v_provider='SUPABASE' then
      if v_path is null then raise exception 'Media path is required'; end if;
      if (storage.foldername(v_path))[1] is distinct from v_actor::text then raise exception 'Invalid community media path'; end if;
      v_external_key:=null;
    else
      raise exception 'Unsupported storage provider';
    end if;
  end loop;

  if v_video_count>1 then
    raise exception 'You can add only one video per Wall post.';
  end if;

  delete from public.community_post_media where post_id=p_post_id;

  for v_item in select value from jsonb_array_elements(v_media)
  loop
    v_path:=nullif(trim(v_item->>'media_path'),'');
    v_mime:=lower(coalesce(nullif(trim(v_item->>'media_mime_type'),''),'image/jpeg'));
    v_size:=nullif(nullif(v_item->>'media_size_bytes','')::bigint,0);
    v_provider:=upper(coalesce(nullif(trim(v_item->>'storage_provider'),''),'SUPABASE'));
    v_external_key:=nullif(trim(v_item->>'external_object_key'),'');
    if v_provider='AWS' then v_path:='aws:'||v_external_key; else v_external_key:=null; end if;

    insert into public.community_post_media(
      post_id,media_position,media_path,media_mime_type,media_size_bytes,storage_provider,external_object_key
    ) values(
      p_post_id,v_index::smallint,v_path,v_mime,v_size,v_provider,v_external_key
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

revoke all on function public.set_buklod_post_media_v6(uuid,jsonb) from public;
grant execute on function public.set_buklod_post_media_v6(uuid,jsonb) to authenticated;


comment on function public.set_buklod_post_media_v6(uuid,jsonb) is
'Community Wall mixed-media contract: up to 10 total media items, at most one video; author-only attach semantics preserved.';

commit;
