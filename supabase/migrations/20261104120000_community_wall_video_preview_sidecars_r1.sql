-- Durable, private first-frame posters for public and exact-scope Community Wall videos.
-- Original video objects, upload limits, AWS routing and feed visibility remain unchanged.

create table if not exists public.community_wall_video_previews (
  post_id uuid not null,
  media_position smallint not null,
  preview_path text not null,
  preview_bytes integer not null check (preview_bytes between 1 and 125000),
  created_at timestamptz not null default now(),
  constraint community_wall_video_previews_pkey primary key (post_id, media_position),
  constraint community_wall_video_previews_path_key unique (preview_path),
  constraint community_wall_video_previews_media_fkey
    foreign key (post_id, media_position)
    references public.community_post_media(post_id, media_position)
    on delete cascade
);

alter table public.community_wall_video_previews enable row level security;
revoke all on public.community_wall_video_previews from public, anon, authenticated;
grant select on public.community_wall_video_previews to authenticated;

drop policy if exists buklod_wall_video_preview_visible on public.community_wall_video_previews;
create policy buklod_wall_video_preview_visible
  on public.community_wall_video_previews
  for select to authenticated
  using (public.can_view_community_post_v2(post_id));

-- The preview file is in the existing private community-media bucket.
-- It is readable only when the associated post is visible to this caller.
drop policy if exists buklod_wall_video_preview_object_read on storage.objects;
create policy buklod_wall_video_preview_object_read
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-media'
    and exists (
      select 1
      from public.community_wall_video_previews vp
      join public.community_post_media m
        on m.post_id = vp.post_id
       and m.media_position = vp.media_position
      where vp.preview_path = objects.name
        and m.media_mime_type like 'video/%'
        and public.can_view_community_post_v2(vp.post_id)
    )
  );

-- Referenced preview objects cannot be deleted by the ordinary owner-delete
-- policy. Once the media row is deleted, the FK cascades and cleanup is allowed.
create or replace function private.buklod_community_video_preview_referenced_v1(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.community_wall_video_previews vp
    where vp.preview_path = p_path
  );
$function$;
revoke all on function private.buklod_community_video_preview_referenced_v1(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.buklod_community_video_preview_referenced_v1(text) to authenticated;

drop policy if exists buklod_wall_video_preview_delete_guard on storage.objects;
create policy buklod_wall_video_preview_delete_guard
  on storage.objects
  as restrictive
  for delete to authenticated
  using (
    bucket_id <> 'community-media'
    or not private.buklod_community_video_preview_referenced_v1(name)
  );

-- The earlier v5 RPC restricted scope-prefixed Supabase media to images.
-- Wall composers already upload scope-prefixed videos into this private bucket;
-- allow the same supported video MIME types when the scope membership check and
-- exact object-exists check both pass. AWS external-video validation is unchanged.
CREATE OR REPLACE FUNCTION public.set_buklod_post_media_v5(p_post_id uuid, p_media jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_scope_id uuid;
  v_media jsonb := coalesce(p_media,'[]'::jsonb);
  v_count integer;
  v_video_count integer := 0;
  v_photo_count integer := 0;
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

  select p.user_id, p.scope_id into v_owner, v_scope_id
  from public.community_posts p
  where p.id=p_post_id and p.deleted_at is null;

  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner<>v_actor then raise exception 'Only the post author may attach media'; end if;
  if jsonb_typeof(v_media) is distinct from 'array' then raise exception 'Media payload must be an array'; end if;

  v_count:=jsonb_array_length(v_media);
  if v_count>11 then raise exception 'You can add 1 video and up to 10 photos.'; end if;

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
      v_photo_count:=v_photo_count+1;
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
      if (storage.foldername(v_path))[1] is distinct from v_actor::text then
        if v_scope_id is null
           or split_part(v_path, '/', 1) <> 'scope'
           or split_part(v_path, '/', 2) <> v_scope_id::text
           or split_part(v_path, '/', 3) <> v_actor::text
           or split_part(v_path, '/', 4) = ''
           or v_mime not in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v')
           or not public.buklod_scope_social_can_access(v_scope_id)
           or not exists (
             select 1 from storage.objects o
             where o.bucket_id = 'community-media' and o.name = v_path
           )
        then
          raise exception 'Invalid community media path';
        end if;
      end if;
      v_external_key:=null;
    else
      raise exception 'Unsupported storage provider';
    end if;
  end loop;

  if v_video_count>1 then
    raise exception 'Only one video can be added.';
  end if;

  if v_photo_count>10 then
    raise exception 'You can add up to 10 photos.';
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
$function$


-- New attachment RPC: v5 remains the canonical media validator/writer. This
-- wrapper strips optional poster fields before calling v5, then validates and
-- attaches the private poster in the same database transaction.
create or replace function public.set_buklod_post_media_v6(p_post_id uuid, p_media jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_clean jsonb;
  v_count integer;
  v_item jsonb;
  v_position smallint;
  v_preview_path text;
  v_preview_bytes integer;
  v_mime text;
  v_provider text;
  v_external_key text;
  v_original_path text;
  v_metadata jsonb;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner
  from public.community_posts p
  where p.id = p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then
    raise exception 'Only the post author may attach media';
  end if;
  if jsonb_typeof(coalesce(p_media, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Media payload must be an array';
  end if;

  select coalesce(
    jsonb_agg(value - 'preview_path' - 'preview_bytes' order by ordinality),
    '[]'::jsonb
  ) into v_clean
  from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality;

  v_count := public.set_buklod_post_media_v5(p_post_id, v_clean);

  for v_item, v_position in
    select value, (ordinality - 1)::smallint
    from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) with ordinality
  loop
    v_preview_path := nullif(trim(v_item->>'preview_path'), '');
    if v_preview_path is null then continue; end if;

    v_preview_bytes := nullif(v_item->>'preview_bytes', '')::integer;
    v_mime := lower(coalesce(nullif(trim(v_item->>'media_mime_type'), ''), ''));
    v_provider := upper(coalesce(nullif(trim(v_item->>'storage_provider'), ''), 'SUPABASE'));
    v_external_key := nullif(trim(v_item->>'external_object_key'), '');
    v_original_path := case
      when v_provider = 'AWS' then 'aws:' || coalesce(v_external_key, '')
      else nullif(trim(v_item->>'media_path'), '')
    end;

    if v_mime not like 'video/%' then
      raise exception 'Only video media can have a video poster';
    end if;
    if v_preview_bytes is null or v_preview_bytes < 1 or v_preview_bytes > 125000 then
      raise exception 'Video poster must be 125 KB or smaller';
    end if;
    if v_preview_path !~ ('^' || v_actor::text || '/wall-previews/[A-Za-z0-9._-]+[.]jpg$')
       or position('..' in v_preview_path) > 0 then
      raise exception 'Invalid video poster path';
    end if;
    select o.metadata into v_metadata
    from storage.objects o
    where o.bucket_id = 'community-media' and o.name = v_preview_path;
    if not found
       or lower(coalesce(v_metadata->>'mimetype', '')) <> 'image/jpeg'
       or case
            when coalesce(v_metadata->>'size', '') ~ '^[0-9]+$'
              then (v_metadata->>'size')::bigint
            else 0
          end <> v_preview_bytes then
      raise exception 'Video poster object is missing or invalid';
    end if;
    if v_original_path is null then
      raise exception 'Original video media path is required';
    end if;

    insert into public.community_wall_video_previews (
      post_id, media_position, preview_path, preview_bytes
    ) values (
      p_post_id, v_position, v_preview_path, v_preview_bytes
    )
    on conflict (post_id, media_position) do update
      set preview_path = excluded.preview_path,
          preview_bytes = excluded.preview_bytes,
          created_at = now();
  end loop;

  return v_count;
end;
$function$;
revoke all on function public.set_buklod_post_media_v6(uuid, jsonb) from public, anon;
grant execute on function public.set_buklod_post_media_v6(uuid, jsonb) to authenticated, service_role;

-- A viewer may lazily backfill a poster for an older video after watching it.
-- The RPC binds the upload to an actually visible video row and is idempotent.
create or replace function public.register_buklod_video_preview_v1(
  p_post_id uuid,
  p_media_position smallint,
  p_preview_path text,
  p_preview_bytes integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_existing text;
  v_metadata jsonb;
  v_mime text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select m.media_mime_type into v_mime
  from public.community_post_media m
  where m.post_id = p_post_id
    and m.media_position = p_media_position
    and m.media_mime_type like 'video/%'
    and public.can_view_community_post_v2(m.post_id);
  if not found then raise exception 'Video is unavailable'; end if;

  select vp.preview_path into v_existing
  from public.community_wall_video_previews vp
  where vp.post_id = p_post_id and vp.media_position = p_media_position;
  if v_existing is not null then return v_existing; end if;

  if p_media_position < 0 or p_media_position > 10
     or p_preview_bytes is null or p_preview_bytes < 1 or p_preview_bytes > 125000
     or p_preview_path !~ ('^' || v_actor::text || '/wall-previews/[A-Za-z0-9._-]+[.]jpg$')
     or position('..' in p_preview_path) > 0 then
    raise exception 'Invalid video poster metadata';
  end if;

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'community-media' and o.name = p_preview_path;
  if not found
     or lower(coalesce(v_metadata->>'mimetype', '')) <> 'image/jpeg'
     or case
          when coalesce(v_metadata->>'size', '') ~ '^[0-9]+$'
            then (v_metadata->>'size')::bigint
          else 0
        end <> p_preview_bytes then
    raise exception 'Video poster object is missing or invalid';
  end if;

  insert into public.community_wall_video_previews (
    post_id, media_position, preview_path, preview_bytes
  ) values (
    p_post_id, p_media_position, p_preview_path, p_preview_bytes
  )
  on conflict (post_id, media_position) do nothing;

  select vp.preview_path into v_existing
  from public.community_wall_video_previews vp
  where vp.post_id = p_post_id and vp.media_position = p_media_position;
  return v_existing;
end;
$function$;
revoke all on function public.register_buklod_video_preview_v1(uuid, smallint, text, integer) from public, anon;
grant execute on function public.register_buklod_video_preview_v1(uuid, smallint, text, integer) to authenticated;

-- New media RPC returns both the old photo sidecars and durable video posters.
CREATE OR REPLACE FUNCTION public.get_buklod_post_media_v4(p_post_ids uuid[])
 RETURNS TABLE(post_id uuid, media_position smallint, media_path text, media_mime_type text, media_size_bytes bigint, storage_provider text, external_object_key text, reaction_counts jsonb, my_reaction text, preview_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select m.post_id,m.media_position,m.media_path,m.media_mime_type,m.media_size_bytes,
 m.storage_provider,m.external_object_key,
 coalesce((select jsonb_object_agg(g.reaction,g.total) from (
  select r.reaction,count(*)::bigint total from public.community_photo_reactions r
  where r.post_id=m.post_id and r.media_position=m.media_position group by r.reaction) g),'{}'::jsonb),
 (select mine.reaction from public.community_photo_reactions mine
  where mine.post_id=m.post_id and mine.media_position=m.media_position
  and mine.user_id=(select auth.uid()) limit 1),coalesce(vp.preview_path,i.preview_path)
 from public.community_post_media m
 left join public.community_wall_video_previews vp on vp.post_id=m.post_id and vp.media_position=m.media_position
 left join public.community_wall_legacy_previews i on i.original_path=m.media_path
 where m.post_id=any(coalesce(p_post_ids,'{}'::uuid[])) and public.can_view_community_post_v2(m.post_id)
 union all
 select cp.id,0::smallint,cp.media_path,cp.media_mime_type,cp.media_size_bytes,
 'SUPABASE'::text,null::text,'{}'::jsonb,null::text,i.preview_path
 from public.community_posts cp
 left join public.community_wall_legacy_previews i on i.original_path=cp.media_path
 where cp.id=any(coalesce(p_post_ids,'{}'::uuid[])) and cp.media_path is not null
 and cp.media_mime_type in ('image/jpeg','image/png','image/webp')
 and public.can_view_community_post_v2(cp.id)
 and not exists(select 1 from public.community_post_media m where m.post_id=cp.id)
 order by 1,2;
$function$

revoke all on function public.get_buklod_post_media_v4(uuid[]) from public, anon;
grant execute on function public.get_buklod_post_media_v4(uuid[]) to authenticated, service_role;
