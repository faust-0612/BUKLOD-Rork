-- Prevent authenticated members from reading future Word entries through direct Data API or deep links.
-- Preserve current published historical/undated entries, global admin preview and all writes.
ALTER POLICY "Published devotionals are readable"
ON public.devotionals
TO authenticated
USING (
  (is_published = true AND (
    publish_date IS NULL OR publish_date <= (timezone('Asia/Manila', now()))::date
  ))
  OR public.is_system_admin()
);
