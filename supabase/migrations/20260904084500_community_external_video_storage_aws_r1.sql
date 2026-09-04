-- BUKLOD Community external Wall video storage R1
-- Large Wall videos may live in private AWS S3 while Supabase remains the
-- canonical auth/database and access-control authority.

begin;

alter table public.community_post_media
  add column if not exists storage_provider text not null default 'SUPABASE',
  add column if not exists external_object_key text;

alter table public.community_post_media
  drop constraint if exists community_post_media_storage_provider_check;
alter table public.community_post_media
  add constraint community_post_media_storage_provider_check
  check (storage_provider in ('SUPABASE','AWS'));

alter table public.community_post_media
  drop constraint if exists community_post_media_external_provider_shape_check;
alter table public.community_post_media
  add constraint community_post_media_external_provider_shape_check
  check (
    (storage_provider='SUPABASE' and external_object_key is null)
    or
    (storage_provider='AWS' and external_object_key is not null and media_mime_type like 'video/%')
  );

create index if not exists community_post_media_external_key_idx
  on public.community_post_media(external_object_key)
  where external_object_key is not null;

create or replace function public.set_buklod_post_media_v5(p_post_id uuid,p_media jsonb)
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
  if v_count>10 then raise exception 'You can add up to 10 photos per post, or one video.'; end if;

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

  if v_video_count>1 or (v_video_count=1 and v_count<>1) then
    raise exception 'Choose either photos or one video for this Wall post.';
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

revoke all on function public.set_buklod_post_media_v5(uuid,jsonb) from public;
grant execute on function public.set_buklod_post_media_v5(uuid,jsonb) to authenticated;

create or replace function public.get_buklod_post_media_v2(p_post_ids uuid[])
returns table(post_id uuid,media_position smallint,media_path text,media_mime_type text,media_size_bytes bigint,storage_provider text,external_object_key text,reaction_counts jsonb,my_reaction text)
language sql
stable
security definer
set search_path=''
as $function$
  select m.post_id,m.media_position,m.media_path,m.media_mime_type,m.media_size_bytes,
         m.storage_provider,m.external_object_key,
         coalesce((select jsonb_object_agg(g.reaction,g.total) from (
           select r.reaction,count(*)::bigint total
           from public.community_photo_reactions r
           where r.post_id=m.post_id and r.media_position=m.media_position
           group by r.reaction
         ) g),'{}'::jsonb),
         (select mine.reaction from public.community_photo_reactions mine
          where mine.post_id=m.post_id and mine.media_position=m.media_position
            and mine.user_id=(select auth.uid()) limit 1)
  from public.community_post_media m
  where m.post_id=any(coalesce(p_post_ids,'{}'::uuid[]))
    and public.can_view_community_post_v2(m.post_id)
  union all
  select cp.id,0::smallint,cp.media_path,cp.media_mime_type,cp.media_size_bytes,
         'SUPABASE'::text,null::text,'{}'::jsonb,null::text
  from public.community_posts cp
  where cp.id=any(coalesce(p_post_ids,'{}'::uuid[]))
    and cp.media_path is not null
    and cp.media_mime_type in ('image/jpeg','image/png','image/webp')
    and public.can_view_community_post_v2(cp.id)
    and not exists(select 1 from public.community_post_media m where m.post_id=cp.id)
  order by 1,2;
$function$;

revoke all on function public.get_buklod_post_media_v2(uuid[]) from public;
grant execute on function public.get_buklod_post_media_v2(uuid[]) to authenticated;

create or replace function public.buklod_community_external_media_authorize_v1(p_post_id uuid,p_object_key text)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.community_post_media m
    where m.post_id=p_post_id
      and m.storage_provider='AWS'
      and m.external_object_key=p_object_key
      and public.can_view_community_post_v2(m.post_id)
  );
$function$;

revoke all on function public.buklod_community_external_media_authorize_v1(uuid,text) from public;
grant execute on function public.buklod_community_external_media_authorize_v1(uuid,text) to authenticated;

commit;
