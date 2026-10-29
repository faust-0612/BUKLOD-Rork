-- Defense-in-depth: all existing insert and update paths reject unassigned question IDs.
-- Legacy attempts without snapshot are unchanged.
CREATE OR REPLACE FUNCTION private.buklod_quiz_validate_response_assignment_r1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
 IF EXISTS (
   SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 t WHERE t.attempt_id=new.attempt_id
 ) AND NOT EXISTS (
   SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 t
   WHERE t.attempt_id=new.attempt_id AND t.question_id=new.question_id
 ) THEN
   RAISE EXCEPTION 'This question is not assigned to the current attempt.';
 END IF;
 RETURN new;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_validate_response_assignment_r1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS buklod_quiz_validate_response_assignment_r1 ON public.buklod_quiz_responses;
CREATE TRIGGER buklod_quiz_validate_response_assignment_r1
 BEFORE INSERT OR UPDATE OF attempt_id,question_id,answer ON public.buklod_quiz_responses
 FOR EACH ROW EXECUTE FUNCTION private.buklod_quiz_validate_response_assignment_r1();
