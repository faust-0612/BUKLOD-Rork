-- Applied to production project yhanxndaqbmuzbdqlblu as 20261108114034.
-- Immutable private media; no existing records changed, scope RLS preserved.
begin;
alter table public.buklod_cluster_home_notices
 add column if not exists media_path text,
 add column if not exists media_mime_type text;
alter table public.buklod_cluster_events
 add column if not exists media_path text,
 add column if not exists media_mime_type text;
alter table public.buklod_cluster_resources
 add column if not exists storage_path text,
 add column if not exists original_name text,
 add column if not exists mime_type text;
alter table public.buklod_scopes
 add column if not exists profile_photo_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('buklod-scope-home-assets','buklod-scope-home-assets',false,104857600,
array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime',
'video/webm','application/pdf','text/plain','text/csv',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do nothing;
create policy "buklod_scope_home_assets_read_v1" on storage.objects
 for select to authenticated using (
 bucket_id='buklod-scope-home-assets'
 and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and (public.buklod_scope_social_can_access(split_part(name,'/',1)::uuid)
   or public.buklod_is_scope_admin(split_part(name,'/',1)::uuid))
);
create policy "buklod_scope_home_assets_admin_insert_v1" on storage.objects
 for insert to authenticated with check (
 bucket_id='buklod-scope-home-assets'
 and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and split_part(name,'/',2) in ('resource','event','notice','profile')
 and split_part(name,'/',3)=(select auth.uid())::text
 and public.buklod_is_scope_admin(split_part(name,'/',1)::uuid)
);
create policy "buklod_scope_home_assets_admin_delete_v1" on storage.objects
 for delete to authenticated using (
 bucket_id='buklod-scope-home-assets'
 and split_part(name,'/',1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and public.buklod_is_scope_admin(split_part(name,'/',1)::uuid)
);
commit;
