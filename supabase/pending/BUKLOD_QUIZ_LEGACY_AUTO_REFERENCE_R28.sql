-- R28: attest unchanged historical question references, only after cross-project
-- parity and creation/update timestamps at or before the original attempt start.
-- No invented answer keys, points, or grades. New/changed historical material is not attested.
CREATE TABLE private.buklod_quiz_legacy_reference_attestation_r28(question_id uuid PRIMARY KEY, reference_hash text NOT NULL CHECK(reference_hash ~ '^[0-9a-f]{64}$'), attested_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.buklod_quiz_legacy_reference_attestation_r28 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.buklod_quiz_legacy_reference_attestation_r28 FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.buklod_quiz_reference_hash_r28(q public.buklod_quiz_questions) RETURNS text LANGUAGE sql STABLE SET search_path='' SET timezone='UTC' AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(q.id,q.exam_id,q.question_type,q.prompt,q.correct_answer,q.explanation,q.rubric,q.created_at,q.updated_at)::text,'UTF8')),'hex');
$$;
REVOKE ALL ON FUNCTION private.buklod_quiz_reference_hash_r28(public.buklod_quiz_questions) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.buklod_quiz_legacy_auto_ref_r28(p_attempt_id uuid,p_question_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
 JOIN public.buklod_quiz_questions q ON q.id=aq.question_id AND q.exam_id=a.exam_id
 JOIN private.buklod_quiz_legacy_reference_attestation_r28 t ON t.question_id=q.id
 WHERE a.id=p_attempt_id AND q.id=p_question_id AND a.status='NEEDS_REVIEW'
 AND q.created_at<=a.started_at AND q.updated_at<=a.started_at
 AND aq.created_at<=coalesce(a.submitted_at,a.expires_at)
 AND t.reference_hash=private.buklod_quiz_reference_hash_r28(q));
$$;
REVOKE ALL ON FUNCTION private.buklod_quiz_legacy_auto_ref_r28(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
-- R27: faculty-confirmed original-reference AI suggestions and atomic historical bulk approval.
-- Automatically usable only when exact source-attested reference is unchanged.
CREATE OR REPLACE FUNCTION public.buklod_quiz_historical_class_review_v2(p_exam_id uuid,p_section_id uuid)
RETURNS TABLE(attempt_id uuid,response_id uuid,display_name text,question_id uuid,assigned_order integer,assigned_points numeric,current_bank_prompt text,answer_text text,manual_eligible boolean,reason text,recorded_total numeric,recorded_max numeric,reference jsonb,reference_digest text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
 WITH rows AS MATERIALIZED (
  SELECT x.*, CASE WHEN x.manual_eligible AND x.assigned_points IS NOT NULL AND x.assigned_points>=0
   AND x.assigned_points::text NOT IN ('NaN','Infinity','-Infinity')
   AND upper(q.question_type) IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
   AND nullif(btrim(q.prompt),'') IS NOT NULL
   AND (coalesce(nullif(btrim(q.correct_answer#>>'{}'),''),'null') NOT IN ('null','{}','[]')
    OR nullif(btrim(q.explanation),'') IS NOT NULL
    OR coalesce(nullif(btrim(q.rubric::text),''),'null') NOT IN ('null','{}','[]','""'))
   THEN jsonb_build_object('response_id',x.response_id,'question_type',q.question_type,'question',q.prompt,'max_points',x.assigned_points,
    'student_answer',x.answer_text,'correct_answer',q.correct_answer#>>'{}','explanation',q.explanation,'rubric',q.rubric::text)
   ELSE NULL END AS ref
  FROM public.buklod_quiz_historical_class_review_v1(p_exam_id,p_section_id) x
  LEFT JOIN public.buklod_quiz_questions q ON q.id=x.question_id AND q.exam_id=p_exam_id
 ), captured AS (
  SELECT x.*,CASE WHEN x.ref IS NOT NULL THEN encode(sha256(convert_to(jsonb_build_array(x.attempt_id,x.question_id,x.ref)::text,'UTF8')),'hex') END AS capture
  FROM rows x
 ), digests AS (
  SELECT x.attempt_id,CASE WHEN count(*)=count(x.capture) THEN encode(sha256(convert_to(string_agg(x.capture,'' ORDER BY x.response_id),'UTF8')),'hex') END AS digest
  FROM captured x GROUP BY x.attempt_id
 )
 SELECT x.attempt_id,x.response_id,x.display_name,x.question_id,x.assigned_order,x.assigned_points,x.current_bank_prompt,x.answer_text,x.manual_eligible,x.reason,x.recorded_total,x.recorded_max,
 CASE WHEN x.ref IS NOT NULL THEN x.ref||jsonb_build_object('capture_digest',x.capture,'auto_verified',private.buklod_quiz_legacy_auto_ref_r28(x.attempt_id,x.question_id)) END,d.digest
 FROM captured x JOIN digests d ON d.attempt_id=x.attempt_id ORDER BY x.attempt_id,x.assigned_order NULLS LAST,x.response_id;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_class_review_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_class_review_v2(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.buklod_quiz_historical_ai_payload_v1(p_attempt_id uuid,p_reference_digest text,p_reference_confirmed boolean)
RETURNS TABLE(response_id uuid,question_type text,question text,max_points numeric,student_answer text,correct_answer text,explanation text,rubric text,capture_digest text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL OR public.buklod_quiz_is_examiner(actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Examiner required' USING ERRCODE='42501'; END IF;
 IF p_reference_digest IS NULL OR p_reference_digest !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Original reference digest required'; END IF;
 SELECT t.* INTO a FROM public.buklod_quiz_attempts t JOIN public.buklod_quiz_exams e ON e.id=t.exam_id WHERE t.id=p_attempt_id AND t.status='NEEDS_REVIEW' AND e.owner_user_id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending attempt unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 IF p_reference_confirmed IS DISTINCT FROM true AND EXISTS(SELECT 1 FROM public.buklod_quiz_historical_class_review_v2(a.exam_id,a.section_id) x WHERE x.attempt_id=a.id AND (x.reference->>'auto_verified')::boolean IS DISTINCT FROM true) THEN RAISE EXCEPTION 'Confirm the exact original grading reference before AI checking'; END IF;
 RETURN QUERY SELECT x.response_id,x.reference->>'question_type',x.reference->>'question',x.assigned_points,x.answer_text,x.reference->>'correct_answer',x.reference->>'explanation',x.reference->>'rubric',x.reference->>'capture_digest'
 FROM public.buklod_quiz_historical_class_review_v2(a.exam_id,a.section_id) x
 WHERE x.attempt_id=a.id AND x.manual_eligible AND x.reference_digest=p_reference_digest AND x.reference IS NOT NULL ORDER BY x.assigned_order,x.response_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original reference missing, changed, or incomplete. Refresh and verify the original evidence.'; END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean) TO authenticated;

-- Independently verified both project reference aggregates on 2026-11-28.
SET LOCAL timezone='UTC';
CREATE TEMP TABLE r28_attest_target ON COMMIT DROP AS SELECT DISTINCT q.id FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=r.question_id JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id WHERE a.status='NEEDS_REVIEW' AND r.needs_review AND r.manual_score IS NULL;
DO $guard$ BEGIN
 IF (SELECT count(*) FROM r28_attest_target)<>52 THEN RAISE EXCEPTION 'Legacy reference population changed'; END IF;
 PERFORM 1 FROM public.buklod_quiz_questions q JOIN r28_attest_target t ON t.id=q.id ORDER BY q.id FOR SHARE OF q;
 IF (SELECT md5(string_agg(md5(jsonb_build_array(q.id,q.exam_id,q.question_type,q.prompt,q.correct_answer,q.explanation,q.rubric,q.created_at,q.updated_at)::text),'' ORDER BY q.id)) FROM public.buklod_quiz_questions q JOIN r28_attest_target t ON t.id=q.id) IS DISTINCT FROM '0ee11db4eb348db792eb9293c6177780' THEN RAISE EXCEPTION 'Source reference hash changed'; END IF;
END $guard$;
INSERT INTO private.buklod_quiz_legacy_reference_attestation_r28(question_id,reference_hash)
SELECT q.id,private.buklod_quiz_reference_hash_r28(q) FROM public.buklod_quiz_questions q JOIN r28_attest_target t ON t.id=q.id;

DO $qa$ DECLARE c record; g record; n int:=0; total int:=0; tested boolean; BEGIN
 FOR c IN SELECT DISTINCT a.exam_id,a.section_id,e.owner_user_id FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id WHERE a.status='NEEDS_REVIEW' LOOP
 PERFORM set_config('request.jwt.claim.sub',c.owner_user_id::text,true);
 tested:=false;
 FOR g IN SELECT x.attempt_id,max(x.reference_digest) digest,count(*) items,bool_and(coalesce((x.reference->>'auto_verified')::boolean,false)) verified FROM public.buklod_quiz_historical_class_review_v2(c.exam_id,c.section_id) x GROUP BY x.attempt_id LOOP
 IF g.verified THEN
 IF g.digest IS NULL THEN RAISE EXCEPTION 'Auto reference missing digest'; END IF;
 IF NOT tested THEN
 IF (SELECT count(*) FROM public.buklod_quiz_historical_ai_payload_v1(g.attempt_id,g.digest,false))<>g.items THEN RAISE EXCEPTION 'Auto payload incomplete'; END IF;
 tested:=true;
 END IF;
 n:=n+1;total:=total+g.items;
 END IF;
 END LOOP;
 END LOOP;
 IF n<>39 OR total<>320 THEN RAISE EXCEPTION 'Auto reference population mismatch: % / %',n,total; END IF;
 IF has_function_privilege('anon','public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean)','EXECUTE') OR has_table_privilege('authenticated','private.buklod_quiz_legacy_reference_attestation_r28','SELECT') THEN RAISE EXCEPTION 'Privilege regression'; END IF;
END $qa$;
