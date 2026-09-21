-- BUKLOD Organization generic institutional branding.
-- One shared public branding bucket. Exact-scope Organization admins alone may write.
-- No per-institution bucket/schema/code fork.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'organization-branding',
  'organization-branding',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists buklod_org_branding_insert on storage.objects;
create policy buklod_org_branding_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'organization-branding'
  and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
  and public.buklod_is_scope_admin(
    split_part(name,'/',1)::uuid
  )
);

drop policy if exists buklod_org_branding_update on storage.objects;
create policy buklod_org_branding_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'organization-branding'
  and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
  and public.buklod_is_scope_admin(
    split_part(name,'/',1)::uuid
  )
)
with check (
  bucket_id = 'organization-branding'
  and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
  and public.buklod_is_scope_admin(
    split_part(name,'/',1)::uuid
  )
);

drop policy if exists buklod_org_branding_delete on storage.objects;
create policy buklod_org_branding_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'organization-branding'
  and split_part(name,'/',1) ~ '^[0-9a-fA-F-]{36}$'
  and public.buklod_is_scope_admin(
    split_part(name,'/',1)::uuid
  )
);
