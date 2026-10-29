-- Expand from post-prefixed JPGs to *all referenced* private Wall JPEG paths.
-- Still no public objects, original moves, deletes or unlisted thumbnail guesses.
drop policy if exists buklod_wall_legacy_preview_object_read on storage.objects;
create policy buklod_wall_legacy_preview_object_read on storage.objects
for select to authenticated using(
 bucket_id='community-media'
 and name ~ '(^|/)[^/]+-legacy-preview\.jpg$'
 and exists (
   select 1 from public.community_wall_legacy_previews i
   where i.preview_path=objects.name
     and public.buklod_storage_object_select_allowed_v1('community-media',i.original_path)
 )
);
insert into private.buklod_legacy_preview_queue(original_path,original_bytes)
select src.path,max(src.sz)::bigint from (
 select m.media_path as path,m.media_size_bytes as sz from public.community_post_media m
 join public.community_posts cp on cp.id=m.post_id
 where m.media_mime_type='image/jpeg' and cp.deleted_at is null and cp.is_hidden=false
 union all
 select cp.media_path,cp.media_size_bytes from public.community_posts cp
 where cp.media_mime_type='image/jpeg' and cp.deleted_at is null and cp.is_hidden=false
) src
where src.path ~ '^[^?#]+/[^/]+\.jpg$'
 and src.path not like '%://%'
 and src.path not like '%..%'
 and src.path !~ '-(p1|p1-preview|legacy-preview)\.jpg$'
 and src.sz between 20000 and 4000000
 and exists (select 1 from storage.objects o where o.bucket_id='community-media' and o.name=src.path)
group by src.path
on conflict(original_path) do nothing;
