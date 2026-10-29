-- BUKLOD QUIZ K-OF-N: 00 assignment infrastructure (new sessions only)
-- Never assign retroactively to existing attempt rows.
CREATE TABLE IF NOT EXISTS private.buklod_quiz_attempt_questions_r1 (
 attempt_id uuid NOT NULL REFERENCES public.buklod_quiz_attempts(id) ON DELETE CASCADE,
 question_id uuid NOT NULL REFERENCES public.buklod_quiz_questions(id),
 display_order integer NOT NULL CHECK(display_order > 0),
 selected_points numeric NOT NULL CHECK(selected_points > 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(attempt_id, question_id),
 UNIQUE(attempt_id, display_order)
);
CREATE INDEX IF NOT EXISTS buklod_quiz_attempt_questions_r1_question_idx
 ON private.buklod_quiz_attempt_questions_r1(question_id);
REVOKE ALL ON private.buklod_quiz_attempt_questions_r1 FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.buklod_quiz_assign_attempt_questions_r1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE
 s public.buklod_quiz_live_sessions%rowtype;
 v_pool integer;
 v_target integer;
 v_rows integer;
 v_max numeric;
BEGIN
 IF new.live_session_id IS NULL THEN RETURN new; END IF;
 SELECT * INTO s FROM public.buklod_quiz_live_sessions WHERE id=new.live_session_id;
 IF s.id IS NULL OR coalesce(s.settings_snapshot->>'question_selection_mode','') <> 'SNAPSHOT_R1' THEN
   RETURN new;
 END IF;
 SELECT count(*)::integer INTO v_pool FROM public.buklod_quiz_questions
 WHERE exam_id=new.exam_id AND is_active=true;
 v_target:=s.question_count;
 IF v_target IS NULL OR v_target<1 OR v_target>v_pool THEN
   RAISE EXCEPTION 'Configured item count % invalid for bank size %.',v_target,v_pool;
 END IF;
 INSERT INTO private.buklod_quiz_attempt_questions_r1(attempt_id,question_id,display_order,selected_points)
 SELECT new.id, z.id,z.ord,z.points FROM (
   SELECT q.id,q.points,
     row_number() over(order by
       CASE WHEN coalesce(s.randomize_questions,false)
         THEN md5(q.id::text || ':' || new.id::text)
         ELSE lpad(q.sort_order::text,12,'0') END,
       q.id::text)::integer AS ord
   FROM public.buklod_quiz_questions q
   WHERE q.exam_id=new.exam_id AND q.is_active=true
 ) z WHERE z.ord<=v_target;
 GET DIAGNOSTICS v_rows=ROW_COUNT;
 IF v_rows<>v_target THEN RAISE EXCEPTION 'Question assignment incomplete: % of %.',v_rows,v_target; END IF;
 SELECT sum(selected_points) INTO v_max FROM private.buklod_quiz_attempt_questions_r1
 WHERE attempt_id=new.id;
 UPDATE public.buklod_quiz_attempts SET max_score=v_max WHERE id=new.id;
 RETURN new;
END $fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_assign_attempt_questions_r1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS buklod_quiz_assign_attempt_questions_r1 ON public.buklod_quiz_attempts;
CREATE TRIGGER buklod_quiz_assign_attempt_questions_r1
 AFTER INSERT ON public.buklod_quiz_attempts FOR EACH ROW
 EXECUTE FUNCTION private.buklod_quiz_assign_attempt_questions_r1();

CREATE OR REPLACE FUNCTION private.buklod_quiz_attempt_question_allowed_r1(p_attempt_id uuid,p_question_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT CASE WHEN exists(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 v WHERE v.attempt_id=p_attempt_id)
 THEN exists(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 v WHERE v.attempt_id=p_attempt_id AND v.question_id=p_question_id)
 ELSE exists(SELECT 1 FROM public.buklod_quiz_questions q
 JOIN public.buklod_quiz_attempts a ON a.exam_id=q.exam_id
 WHERE a.id=p_attempt_id AND q.id=p_question_id AND q.is_active=true) END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_attempt_question_allowed_r1(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.buklod_quiz_attempt_question_count_r1(p_attempt_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 SELECT CASE WHEN exists(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 v WHERE v.attempt_id=p_attempt_id)
 THEN (SELECT count(*)::integer FROM private.buklod_quiz_attempt_questions_r1 v WHERE v.attempt_id=p_attempt_id)
 ELSE (SELECT count(*)::integer FROM public.buklod_quiz_questions q
 JOIN public.buklod_quiz_attempts a ON a.exam_id=q.exam_id
 WHERE a.id=p_attempt_id AND q.is_active=true) END;
$fn$;
REVOKE ALL ON FUNCTION private.buklod_quiz_attempt_question_count_r1(uuid) FROM PUBLIC,anon,authenticated;
