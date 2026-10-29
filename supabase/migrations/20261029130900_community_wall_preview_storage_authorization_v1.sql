-- BUKLOD Community Wall preview RLS v1
-- Only the holder of an original's existing view permission may read its
-- deterministic small preview from the same PRIVATE community-media bucket.
-- No RLS weakening for originals, public URLs, or admin privileges.
-- The -p1 marker is assigned only after the preview upload has succeeded.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'buklod_community_wall_private_preview_select_v1'
  ) then
    create policy buklod_community_wall_private_preview_select_v1
      on storage.objects for select to authenticated
      using (
        bucket_id = 'community-media'
        and name ~ '(^|/)post-[^/]+-p1-preview\.jpg$'
        and public.can_view_buklod_community_media_path_v1(
          regexp_replace(name, '-p1-preview\.jpg$', '-p1.jpg')
        )
      );
  end if;
end
$policy$;
