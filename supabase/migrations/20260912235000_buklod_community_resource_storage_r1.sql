-- BUKLOD Community Resource storage allowlist R1
-- Add Resource MIME types to the existing community-media bucket without
-- removing any MIME type already used by the mature Wall/IGPAT media paths.
-- Resource RPC/client validation still enforces the stricter 20 MB file limit.

begin;

update storage.buckets b
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(
    coalesce(b.allowed_mime_types,'{}'::text[]) || array[
      'image/jpeg','image/png','image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain','text/csv'
    ]::text[]
  ) as mime
)
where b.id='community-media';

commit;
