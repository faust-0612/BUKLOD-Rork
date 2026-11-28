-- Quiz R29: bounded recovery of CHN MIDTERM / General legacy evidence.
-- Source: Dedicated and MAIN read-only SHA256 reconciliation on 2026-11-28.
-- This is RECONSTRUCTED evidence, not an original frozen snapshot.
-- Original display sequence is unavailable; canonical bank sort order is used.
-- Run as one transaction; do not apply if either source or MAIN has drifted.
-- Never update attempts, scores, answers, releases, or unrelated exams.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '45s';
SET LOCAL TIME ZONE 'UTC';

CREATE TABLE private.buklod_quiz_recovered_assignment_r29 (
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  reference_hash text NOT NULL CHECK(reference_hash ~ '^[0-9a-f]{64}$'),
  response_hash text NOT NULL CHECK(response_hash ~ '^[0-9a-f]{64}$'),
  points numeric NOT NULL CHECK(points>=0 AND points::text NOT IN ('NaN','Infinity','-Infinity')),
  canonical_order integer NOT NULL CHECK(canonical_order>0),
  recovered_at timestamptz NOT NULL,
  evidence_kind text NOT NULL DEFAULT 'DEDICATED_LEGACY_BANK_AND_RESPONSE_MATCH',
  PRIMARY KEY(attempt_id,question_id),
  FOREIGN KEY(attempt_id,question_id) REFERENCES public.buklod_quiz_attempt_questions(attempt_id,question_id) ON DELETE CASCADE
);
ALTER TABLE private.buklod_quiz_recovered_assignment_r29 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.buklod_quiz_recovered_assignment_r29 FROM PUBLIC, anon, authenticated;

DO $recovery$
DECLARE a record; n int; k int:=0; total numeric; bank_digest text; response_digest text;
        active_count int; distinct_order int; invalid_count int; pending_count int; pending_total int:=0;
        obj numeric; man numeric; deduction numeric; stamp timestamptz:=clock_timestamp();
        expected text[]:=ARRAY[
          '748f183cec05b78eac453153ae36eb4e292a62a773c6e96cf4d2ed2cc55073d2',
          '373413007b76a84f5da7c4c59f266189a282fee8badc8f8a977e307da24730a9',
          'f71a4e3394cc5544ad0487999adce664befc060a18386412e5a64df4c8760573',
          'd5ec6142c49ed446b933fb7dfc6e534a2e5adc3fa1218feb3d2512b2336f8a58',
          'fb140718b6de8ce818afd6f65fa26c248b3a72187fdf1612b51d8f71b6fd72aa'
        ];
        seen text[]:=ARRAY[]::text[];
BEGIN
  IF (SELECT count(DISTINCT e.id) FROM public.buklod_quiz_exams e JOIN public.buklod_quiz_sections s ON s.exam_id=e.id
      WHERE upper(trim(e.title))='CHN MIDTERM' AND lower(trim(s.name))='general')<>1 THEN
    RAISE EXCEPTION 'Ambiguous recovery scope'; END IF;
  FOR a IN SELECT t.* FROM public.buklod_quiz_attempts t
    JOIN public.buklod_quiz_exams e ON e.id=t.exam_id
    JOIN public.buklod_quiz_sections s ON s.id=t.section_id AND s.exam_id=e.id
    WHERE upper(trim(e.title))='CHN MIDTERM' AND lower(trim(s.name))='general'
      AND t.status='NEEDS_REVIEW' ORDER BY t.id FOR UPDATE OF t
  LOOP
    k:=k+1;
    IF a.max_score IS DISTINCT FROM 54 OR a.submitted_at IS NULL OR a.released_at IS NOT NULL
       OR a.live_session_id IS NULL
       OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions l WHERE l.id=a.live_session_id
          AND l.exam_id=a.exam_id AND l.section_id=a.section_id AND l.question_count=50 AND l.total_score_target=54)
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id)
       OR EXISTS(SELECT 1 FROM public.buklod_quiz_live_question_snapshots x WHERE x.session_id=a.live_session_id)
    THEN RAISE EXCEPTION 'Attempt evidence or lifecycle drift'; END IF;
    PERFORM 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id ORDER BY r.id FOR SHARE;
    PERFORM 1 FROM public.buklod_quiz_questions q WHERE q.exam_id=a.exam_id ORDER BY q.id FOR SHARE;
    SELECT count(*),count(DISTINCT sort_order) INTO active_count,distinct_order
      FROM public.buklod_quiz_questions q WHERE q.exam_id=a.exam_id AND q.is_active;
    IF active_count<>50 OR distinct_order<>50 THEN RAISE EXCEPTION 'Bank membership drift'; END IF;
    SELECT count(*),sum(q.points),
      count(*) FILTER(WHERE r.student_user_id IS DISTINCT FROM a.student_user_id OR q.id IS NULL
        OR NOT q.is_active OR q.created_at>a.started_at OR q.updated_at>a.started_at OR q.points IS NULL
        OR q.points<0 OR q.points::text IN ('NaN','Infinity','-Infinity') OR q.sort_order IS NULL
        OR coalesce(r.objective_score,0)<0 OR coalesce(r.objective_score,0)>q.points
        OR coalesce(r.manual_score,0)<0 OR coalesce(r.manual_score,0)>q.points
        OR (r.needs_review AND r.manual_score IS NULL AND (
          coalesce(r.objective_score,0)<>0 OR q.question_type NOT IN ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
          OR nullif(btrim(q.prompt),'') IS NULL
          OR (coalesce(q.correct_answer::text,'null') IN ('null','""','{}','[]')
            AND coalesce(btrim(q.explanation),'')='' AND coalesce(q.rubric::text,'null') IN ('null','{}','[]','""'))))),
      count(*) FILTER(WHERE r.needs_review AND r.manual_score IS NULL),
      coalesce(sum(CASE WHEN r.manual_score IS NULL THEN coalesce(r.objective_score,0) ELSE 0 END),0),
      coalesce(sum(r.manual_score),0),
      encode(sha256(convert_to(string_agg(jsonb_build_array(q.id,q.question_type,q.prompt,q.correct_answer,q.explanation,q.rubric,q.points,q.sort_order,q.created_at,q.updated_at)::text,'' ORDER BY q.id),'UTF8')),'hex'),
      encode(sha256(convert_to(string_agg(jsonb_build_array(r.id,r.question_id,r.answer,r.objective_score,r.manual_score,r.needs_review)::text,'' ORDER BY r.id),'UTF8')),'hex')
    INTO n,total,invalid_count,pending_count,obj,man,bank_digest,response_digest
    FROM public.buklod_quiz_responses r LEFT JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
    WHERE r.attempt_id=a.id;
    SELECT coalesce(sum(d.deduction_points),0) INTO deduction FROM public.buklod_quiz_integrity_deductions d WHERE d.attempt_id=a.id;
    IF n<>50 OR total IS DISTINCT FROM a.max_score OR invalid_count<>0 OR pending_count<1
       OR obj IS DISTINCT FROM a.objective_score OR man IS DISTINCT FROM a.manual_score
       OR greatest(0,obj+man-deduction) IS DISTINCT FROM a.total_score
       OR bank_digest IS DISTINCT FROM '3765d9066eef00df6e48c7d3ca7a33342603d3a2a7728936d8beb98c7ce79160'
       OR response_digest IS NULL OR NOT(response_digest=ANY(expected)) OR response_digest=ANY(seen)
    THEN RAISE EXCEPTION 'Cross-source fingerprint, point or grade reconciliation failed'; END IF;
    seen:=array_append(seen,response_digest); pending_total:=pending_total+pending_count;
    INSERT INTO public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points,created_at)
    SELECT a.id,q.id,row_number() OVER(ORDER BY q.sort_order,q.id)::int,q.points,q.points,stamp
    FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
    WHERE r.attempt_id=a.id;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>50 THEN RAISE EXCEPTION 'Unexpected assignment count'; END IF;
    INSERT INTO private.buklod_quiz_recovered_assignment_r29(attempt_id,question_id,reference_hash,response_hash,points,canonical_order,recovered_at)
    SELECT aq.attempt_id,aq.question_id,private.buklod_quiz_reference_hash_r28(q),
      encode(sha256(convert_to(jsonb_build_array(r.id,r.question_id,r.answer,r.objective_score,r.manual_score,r.needs_review)::text,'UTF8')),'hex'),
      aq.points,aq.display_order,stamp
    FROM public.buklod_quiz_attempt_questions aq JOIN public.buklod_quiz_questions q ON q.id=aq.question_id
    JOIN public.buklod_quiz_responses r ON r.attempt_id=aq.attempt_id AND r.question_id=aq.question_id
    WHERE aq.attempt_id=a.id;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n<>50 THEN RAISE EXCEPTION 'Unexpected attestation count'; END IF;
  END LOOP;
  IF k<>5 OR pending_total<>34 OR cardinality(seen)<>5 THEN RAISE EXCEPTION 'Cohort changed; abort all recovery'; END IF;
END
$recovery$;

-- Preserve the existing original-reference path. The additional path is
-- independently documented, attempt-specific, timestamped recovery evidence.
CREATE OR REPLACE FUNCTION private.buklod_quiz_legacy_auto_ref_r28(p_attempt_id uuid,p_question_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
 SELECT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
 JOIN public.buklod_quiz_questions q ON q.id=aq.question_id AND q.exam_id=a.exam_id
 JOIN private.buklod_quiz_legacy_reference_attestation_r28 t ON t.question_id=q.id
 WHERE a.id=p_attempt_id AND q.id=p_question_id AND a.status='NEEDS_REVIEW'
 AND q.created_at<=a.started_at AND q.updated_at<=a.started_at
 AND aq.created_at<=coalesce(a.submitted_at,a.expires_at)
 AND t.reference_hash=private.buklod_quiz_reference_hash_r28(q))
 OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a
 JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id
 JOIN public.buklod_quiz_questions q ON q.id=aq.question_id AND q.exam_id=a.exam_id
 JOIN public.buklod_quiz_responses r ON r.attempt_id=a.id AND r.question_id=q.id AND r.student_user_id=a.student_user_id
 JOIN private.buklod_quiz_recovered_assignment_r29 t ON t.attempt_id=aq.attempt_id AND t.question_id=aq.question_id
 WHERE a.id=p_attempt_id AND q.id=p_question_id AND a.status='NEEDS_REVIEW'
 AND q.created_at<=a.started_at AND q.updated_at<=a.started_at AND q.is_active
 AND t.reference_hash=private.buklod_quiz_reference_hash_r28(q)
 AND t.response_hash=encode(sha256(convert_to(jsonb_build_array(r.id,r.question_id,r.answer,r.objective_score,r.manual_score,r.needs_review)::text,'UTF8')),'hex')
 AND aq.points=t.points AND aq.source_points=t.points AND q.points=t.points
 AND aq.display_order=t.canonical_order AND aq.created_at=t.recovered_at
 AND t.recovered_at>a.submitted_at AND t.evidence_kind='DEDICATED_LEGACY_BANK_AND_RESPONSE_MATCH');
$function$;
REVOKE ALL ON FUNCTION private.buklod_quiz_legacy_auto_ref_r28(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Transactional release gate: every pending row is eligible, auto-attested,
-- and accepted by the existing AI payload RPC without faculty confirmation.
-- The JWT setting is local to this transaction, and used only for read-only QA.
DO $verify$
DECLARE x record; g record; cnt int; ready int; payload_count int; group_count int:=0; all_pending int:=0;
BEGIN
  IF (SELECT count(*) FROM private.buklod_quiz_recovered_assignment_r29)<>250 THEN RAISE EXCEPTION 'Recovery count mismatch'; END IF;
  IF has_table_privilege('anon','private.buklod_quiz_recovered_assignment_r29','SELECT')
     OR has_table_privilege('authenticated','private.buklod_quiz_recovered_assignment_r29','SELECT')
     OR has_table_privilege('authenticated','private.buklod_quiz_recovered_assignment_r29','INSERT')
     OR has_function_privilege('authenticated','private.buklod_quiz_legacy_auto_ref_r28(uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Recovery attestation exposed'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='private.buklod_quiz_recovered_assignment_r29'::regclass) THEN RAISE EXCEPTION 'RLS not enabled'; END IF;
  FOR x IN SELECT DISTINCT a.exam_id,a.section_id,e.owner_user_id
    FROM public.buklod_quiz_attempts a JOIN public.buklod_quiz_exams e ON e.id=a.exam_id
    JOIN private.buklod_quiz_recovered_assignment_r29 t ON t.attempt_id=a.id
  LOOP
    PERFORM set_config('request.jwt.claim.sub',x.owner_user_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',x.owner_user_id,'role','authenticated')::text,true);
    SELECT count(*),count(*) FILTER(WHERE v.manual_eligible AND v.reference_digest IS NOT NULL AND (v.reference->>'auto_verified')::boolean IS TRUE),
      count(DISTINCT v.attempt_id)
    INTO cnt,ready,group_count FROM public.buklod_quiz_historical_class_review_v2(x.exam_id,x.section_id) v;
    IF cnt<>34 OR ready<>34 OR group_count<>5 THEN RAISE EXCEPTION 'Historical review gate failed'; END IF;
    FOR g IN SELECT v.attempt_id,v.reference_digest,count(*)::int AS pending
      FROM public.buklod_quiz_historical_class_review_v2(x.exam_id,x.section_id) v
      GROUP BY v.attempt_id,v.reference_digest
    LOOP
      SELECT count(*) INTO payload_count FROM public.buklod_quiz_historical_ai_payload_v1(g.attempt_id,g.reference_digest,false);
      IF payload_count<>g.pending THEN RAISE EXCEPTION 'AI payload gate failed'; END IF;
      all_pending:=all_pending+payload_count;
    END LOOP;
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{}',true);
  IF all_pending<>34 THEN RAISE EXCEPTION 'AI pending count mismatch'; END IF;
END
$verify$;
