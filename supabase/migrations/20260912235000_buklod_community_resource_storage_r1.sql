-- BUKLOD Community Resource storage allowlist R1
-- Extends the existing community-media bucket contract without reducing the
-- current 1 GiB ceiling used by legacy Wall video storage. Resource-level RPC
-- and client validation still enforce the stricter 20 MB file limit.

begin;

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/quicktime','video/webm','video/x-m4v',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','text/csv'
]::text[]
where id='community-media';

commit;
