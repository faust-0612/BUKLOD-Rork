-- Applied to canonical Supabase as migration 20261110064054.
-- Reject cross-class, locked, deleted, or mismatched threaded comments
-- without modifying any preexisting Classroom comments or posts.
CREATE OR REPLACE FUNCTION private.buklod_classroom_validate_comment_scope_v1()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.buklod_education_classroom_posts p
    WHERE p.id=NEW.post_id AND p.classroom_id=NEW.classroom_id
      AND p.deleted_at IS NULL AND p.is_locked=false
  ) THEN
    RAISE EXCEPTION 'Cannot comment on an unavailable, locked, or different classroom post'
      USING ERRCODE='23514';
  END IF;
  IF NEW.parent_comment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.buklod_education_classroom_comments parent
    WHERE parent.id=NEW.parent_comment_id AND parent.classroom_id=NEW.classroom_id
      AND parent.post_id=NEW.post_id AND parent.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Parent comment is not in the same classroom thread'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_buklod_classroom_comment_scope_guard_v1
  ON public.buklod_education_classroom_comments;
CREATE TRIGGER trg_buklod_classroom_comment_scope_guard_v1
BEFORE INSERT OR UPDATE OF classroom_id, post_id, parent_comment_id
ON public.buklod_education_classroom_comments
FOR EACH ROW EXECUTE FUNCTION private.buklod_classroom_validate_comment_scope_v1();
REVOKE ALL ON FUNCTION private.buklod_classroom_validate_comment_scope_v1() FROM PUBLIC, anon, authenticated;
