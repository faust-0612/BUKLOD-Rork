-- BUKLOD Classroom R4: align the legacy faculty-material bucket with the
-- Classroom 1 GB object policy. This changes only the bucket's per-object
-- size ceiling; it does not alter RLS, ownership, visibility, or existing data.
update storage.buckets
set file_size_limit = 1073741824
where id = 'buklod-education-materials'
  and coalesce(file_size_limit, 0) < 1073741824;
