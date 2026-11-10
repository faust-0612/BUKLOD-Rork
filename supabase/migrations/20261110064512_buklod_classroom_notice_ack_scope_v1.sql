-- Applied to canonical Supabase as migration 20261110064512.
-- Only actively enrolled students can acknowledge a visible notice addressed
-- to them (or to their whole class). No unrelated notice can be acknowledged.
ALTER POLICY notice_ack_insert ON public.buklod_education_notice_acknowledgments
WITH CHECK (
  user_id = (SELECT auth.uid()) AND
  EXISTS (
    SELECT 1 FROM public.buklod_education_notices n
    WHERE n.id=notice_id AND n.requires_ack=true
      AND (n.student_user_id IS NULL OR n.student_user_id=(SELECT auth.uid()))
      AND (n.visible_from IS NULL OR n.visible_from<=now())
      AND (n.expires_at IS NULL OR n.expires_at>now())
      AND EXISTS (
        SELECT 1 FROM public.buklod_education_enrollments e
        WHERE e.classroom_id=n.classroom_id
          AND e.student_user_id=(SELECT auth.uid())
          AND e.status='ACTIVE'
      )
  )
);
