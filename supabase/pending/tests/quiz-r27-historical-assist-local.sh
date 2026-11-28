#!/usr/bin/env bash
# Disposable local QA only. No network database connections or real student rows.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
REF="$(git rev-parse "${1:-HEAD}^{commit}")"
BIN="$(pg_config --bindir 2>/dev/null || true)"
if [[ ! -x "$BIN/initdb" ]]; then BIN=/usr/lib/postgresql/17/bin; fi
[[ -x "$BIN/initdb" && -x "$BIN/pg_ctl" && -x "$BIN/psql" ]] || { echo "BLOCKED: PostgreSQL binaries missing"; exit 1; }
[[ "$(id -u)" != 0 ]] || { echo "Run as a non-root WSL user"; exit 1; }
WORK="$(mktemp -d /tmp/buklod-quiz-r22.XXXXXX)"
cleanup() {
  "$BIN/pg_ctl" -D "$WORK/db" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "$WORK"
}
trap cleanup EXIT
"$BIN/initdb" -D "$WORK/db" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$WORK/db" -l "$WORK/server.log" -o "-h '' -k $WORK -p 55442" -w start >/dev/null
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS PGDATABASE PGUSER PGHOST PGPORT
export PGCONNECT_TIMEOUT=5
P=("$BIN/psql" -X -v ON_ERROR_STOP=1 -h "$WORK" -p 55442 -U "$(id -un)" -d postgres)
extract() { git -C "$ROOT" show "$REF:supabase/pending/$1" > "$WORK/input.sql"; }
run() { extract "$1"; "${P[@]}" -q -f "$WORK/input.sql"; }
echo "QA_CANDIDATE=$REF"
echo "PRIVATE_SOCKET_ONLY"
run tests/quiz-main-catalog-fixture.sql
run tests/quiz-main-catalog-rls-fixture.sql
# Production generates trace codes by trigger; fixture deliberately has no production triggers.
"${P[@]}" -q -c "ALTER TABLE public.buklod_quiz_attempts ALTER COLUMN external_capture_trace_code SET DEFAULT ('QA-'||gen_random_uuid()::text)"
for PATCH in AI_PAYLOAD_R1 REVIEW_R2 JOB_V2_R3 WORKER_LEASE_R4 WORKER_FENCE_R6 APPROVAL_R7 RECOVERY_R8 CLASS_APPROVAL_R10 PROVENANCE_R11 FACULTY_READ_R12 LIVE_RECOVERY_R13 BULK_ACTION_R14 SECTION_RECONCILIATION_R15 SECURE_JOIN_R16 SECURE_START_R17 SUBMISSION_R18 REVIEW_CAPTURE_R19 RECORDS_R20 IDENTITY_R21 HISTORICAL_R22 REGRESSION_R23 FRONTEND_CONTRACT_R24 HISTORICAL_COMPAT_R25 RECORDED_REVIEW_R26 HISTORICAL_ASSIST_R27; do
  run "BUKLOD_QUIZ_CENTRAL_${PATCH}.sql"
done
echo "R26 disposable fixture ready"
"${P[@]}" -q <<'SQL'
DO $qa$
DECLARE
 owner_id constant uuid:='10000000-0000-0000-0000-000000000001';
 student constant uuid:='10000000-0000-0000-0000-000000000002';
 outsider constant uuid:='10000000-0000-0000-0000-000000000003';
 exam constant uuid:='10000000-0000-0000-0000-000000000004';
 sec constant uuid:='10000000-0000-0000-0000-000000000005';
 wrong_sec constant uuid:='10000000-0000-0000-0000-000000000006';
 room constant uuid:='10000000-0000-0000-0000-000000000007';
 wrong_room constant uuid:='10000000-0000-0000-0000-000000000008';
 q1 constant uuid:='10000000-0000-0000-0000-000000000009';
 q2 constant uuid:='10000000-0000-0000-0000-000000000010';
 q3 constant uuid:='10000000-0000-0000-0000-000000000011';
 device constant text:='QA-device-token-0123456789';
 frozen_id uuid; historical_id uuid:=gen_random_uuid(); missing_id uuid:=gen_random_uuid();
 released_stamp timestamptz; saved_hash text; hist_response uuid; missing_response uuid; frozen_response uuid; result record; payload jsonb; before_hash text;
BEGIN
 INSERT INTO auth.users(id) VALUES(owner_id),(student),(outsider);
 INSERT INTO public.profiles(id,is_active,full_name) VALUES(owner_id,true,'QA Examiner'),(student,true,'QA Student'),(outsider,true,'QA Outsider');
 INSERT INTO public.buklod_quiz_examiner_roles(user_id,is_active) VALUES(owner_id,true);
 INSERT INTO public.buklod_user_focus_app_entitlements(user_id,focus_app_code,status,activated_at,expires_at) VALUES(owner_id,'faculty','ACTIVE',now()-interval '1 day',now()+interval '1 day');
 INSERT INTO public.buklod_focus_app_admins(user_id,focus_app_code) VALUES(owner_id,'faculty');
 INSERT INTO public.buklod_quiz_exams(id,owner_user_id,title,status,total_points,duration_minutes,max_attempts,device_policy) VALUES(exam,owner_id,'Synthetic QA','PUBLISHED',10,30,1,'LOCK');
 INSERT INTO public.buklod_quiz_sections(id,exam_id,name) VALUES(sec,exam,'QA A'),(wrong_sec,exam,'QA B');
 INSERT INTO public.buklod_quiz_questions(id,exam_id,prompt,question_type,correct_answer,points,sort_order,is_active)
 VALUES(q1,exam,'Synthetic objective','MCQ','"A"',2,1,true),(q2,exam,'Synthetic short text','SHORT_TEXT','"expected"',3,2,true),(q3,exam,'Not assigned','MCQ','"B"',5,3,true);
 INSERT INTO public.buklod_quiz_live_sessions(id,exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join,selected_question_ids,question_count,total_score_target,device_policy)
 VALUES(room,exam,sec,owner_id,'QA0001','LIVE','OPEN',true,ARRAY[q1,q2],7-5,7,'LOCK'),
 (wrong_room,exam,wrong_sec,owner_id,'QA0002','LIVE','OPEN',true,ARRAY[q1,q2],2,7,'LOCK');
 INSERT INTO public.buklod_quiz_roster(exam_id,section_id,student_user_id,status) VALUES(exam,sec,student,'ACTIVE');

 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 PERFORM public.buklod_quiz_join_live_class_v4('QA0001');
 SELECT x.attempt_id INTO STRICT frozen_id FROM public.buklod_quiz_live_start_attempt_v3(room,device) x;
 SELECT * INTO STRICT result FROM public.buklod_quiz_submit_attempt_v4(frozen_id,jsonb_build_array(jsonb_build_object('question_id',q1,'answer','A'),jsonb_build_object('question_id',q2,'answer','other')),NULL,false,NULL,device);
 IF result.status<>'NEEDS_REVIEW' OR result.total_score<>2.8 THEN RAISE EXCEPTION 'QA_FAIL frozen setup'; END IF;
 INSERT INTO public.buklod_quiz_attempts(id,exam_id,section_id,student_user_id,attempt_no,status,expires_at,submitted_at,objective_score,manual_score,total_score,max_score)
 VALUES(historical_id,exam,sec,student,100,'NEEDS_REVIEW',now()-interval '1 day',now()-interval '1 day',2.8,0,2.8,7),
 (missing_id,exam,sec,student,101,'NEEDS_REVIEW',now()-interval '1 day',now()-interval '1 day',2.8,0,2.8,7);
 INSERT INTO public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points)
 VALUES(historical_id,q1,1,2,2.8),(historical_id,q2,2,3,4.2);
 INSERT INTO public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,objective_score,needs_review)
 VALUES(historical_id,q1,student,'"A"',2.8,false),(historical_id,q2,student,'"historical"',0,true),
 (missing_id,q1,student,'"A"',2.8,false),(missing_id,q2,student,'"missing assignment"',0,true);
 SELECT x.id INTO STRICT hist_response FROM public.buklod_quiz_responses x WHERE x.attempt_id=historical_id AND x.question_id=q2;
 SELECT x.id INTO STRICT missing_response FROM public.buklod_quiz_responses x WHERE x.attempt_id=missing_id AND x.question_id=q2;
 SELECT x.id INTO STRICT frozen_response FROM public.buklod_quiz_responses x WHERE x.attempt_id=frozen_id AND x.question_id=q2;
 SELECT md5(to_jsonb(a)::text) INTO before_hash FROM public.buklod_quiz_attempts a WHERE a.id=missing_id;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 IF (SELECT count(*) FROM public.buklod_quiz_historical_class_review_v1(exam,sec))<>2
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_historical_class_review_v1(exam,sec) x WHERE x.attempt_id=historical_id AND x.manual_eligible AND x.assigned_points=4.2)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_historical_class_review_v1(exam,sec) x WHERE x.attempt_id=missing_id AND NOT x.manual_eligible AND x.assigned_points IS NULL)
 OR (SELECT count(*) FROM public.buklod_quiz_class_review_queue_v1(exam,sec))<>1 THEN RAISE EXCEPTION 'QA_FAIL historical or frozen queue isolation'; END IF;
 payload:=jsonb_build_array(jsonb_build_object('response_id',hist_response,'score',4.2));
 BEGIN
  PERFORM public.buklod_quiz_approve_historical_review_v1(historical_id,payload,false);
  RAISE EXCEPTION 'QA_FAIL missing explicit confirmation accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Explicit faculty confirmation%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.buklod_quiz_approve_historical_review_v1(missing_id,jsonb_build_array(jsonb_build_object('response_id',missing_response,'score',4.2)),true);
  RAISE EXCEPTION 'QA_FAIL unassigned historical grade accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%separate evidence review%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.buklod_quiz_approve_historical_review_v1(historical_id,jsonb_build_array(jsonb_build_object('response_id',hist_response,'score',4.3)),true);
  RAISE EXCEPTION 'QA_FAIL over-cap historical grade accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Invalid historical review%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.buklod_quiz_historical_class_review_v1(exam,sec);
  RAISE EXCEPTION 'QA_FAIL outsider historical view';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.buklod_quiz_approve_historical_review_v1(historical_id,payload,true);
  RAISE EXCEPTION 'QA_FAIL outsider historical approval';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Explicit faculty confirmation%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 SELECT * INTO STRICT result FROM public.buklod_quiz_approve_class_review_v1(exam,sec,jsonb_build_array(jsonb_build_object('attempt_id',frozen_id,'response_id',frozen_response,'score',4.2)));
 IF result.approved_attempts<>1 OR result.reviewed_items<>1 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=frozen_id AND a.status='GRADED' AND a.total_score=7) THEN RAISE EXCEPTION 'QA_FAIL frozen class approval'; END IF;
 -- R27 candidate references and atomic historical bulk approval.
 DECLARE
  ref_digest text; valid_payload jsonb; invalid_payload jsonb;
 BEGIN
  SELECT DISTINCT x.reference_digest INTO STRICT ref_digest FROM public.buklod_quiz_historical_class_review_v2(exam,sec) x WHERE x.attempt_id=historical_id;
  IF ref_digest IS NULL OR EXISTS(SELECT 1 FROM public.buklod_quiz_historical_class_review_v2(exam,sec) x WHERE x.attempt_id=missing_id AND (x.reference IS NOT NULL OR x.reference_digest IS NOT NULL)) THEN RAISE EXCEPTION 'QA_FAIL historical reference eligibility'; END IF;
  IF (SELECT count(*) FROM public.buklod_quiz_historical_ai_payload_v1(historical_id,ref_digest,true))<>1 THEN RAISE EXCEPTION 'QA_FAIL confirmed AI payload'; END IF;
  BEGIN
   PERFORM public.buklod_quiz_historical_ai_payload_v1(historical_id,ref_digest,false);
   RAISE EXCEPTION 'QA_FAIL confirmation bypass';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Confirm the exact%' THEN RAISE; END IF; END;
  BEGIN
   PERFORM public.buklod_quiz_historical_ai_payload_v1(historical_id,repeat('0',64),true);
   RAISE EXCEPTION 'QA_FAIL stale reference accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Original reference missing%' THEN RAISE; END IF; END;
  valid_payload:=jsonb_build_array(jsonb_build_object('attempt_id',historical_id,'reference_digest',ref_digest,'reviews',payload));
  invalid_payload:=valid_payload||jsonb_build_array(jsonb_build_object('attempt_id',missing_id,'reviews',jsonb_build_array(jsonb_build_object('response_id',missing_response,'score',4.2))));
  BEGIN
   PERFORM public.buklod_quiz_approve_historical_class_v1(exam,sec,invalid_payload,true);
   RAISE EXCEPTION 'QA_FAIL incomplete evidence approved';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Historical attempt requires separate evidence%' THEN RAISE; END IF; END;
  IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=historical_id AND a.status='NEEDS_REVIEW' AND a.total_score=2.8) THEN RAISE EXCEPTION 'QA_FAIL atomic bulk rollback'; END IF;
  BEGIN
   SELECT * INTO STRICT result FROM public.buklod_quiz_approve_historical_class_v1(exam,sec,valid_payload,true);
   IF result.approved_attempts<>1 OR result.reviewed_items<>1 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=historical_id AND a.status='GRADED' AND a.total_score=7 AND a.max_score=7 AND a.released_at IS NULL) THEN RAISE EXCEPTION 'QA_FAIL bulk approval'; END IF;
   RAISE EXCEPTION 'QA_R27_ROLLBACK_VALID_CASE';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'QA_R27_ROLLBACK_VALID_CASE' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','public.buklod_quiz_historical_class_review_v2(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.buklod_quiz_historical_ai_payload_v1(uuid,text,boolean)','EXECUTE') OR has_function_privilege('anon','public.buklod_quiz_approve_historical_class_v1(uuid,uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'QA_FAIL anonymous R27 access'; END IF;
 END;
 SELECT * INTO STRICT result FROM public.buklod_quiz_approve_historical_review_v1(historical_id,payload,true);
 IF result.status<>'GRADED' OR result.total_score<>7 OR result.max_score<>7 OR result.reviewed_count<>1
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=historical_id AND a.objective_score=2.8 AND a.manual_score=4.2 AND a.released_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_audit_log a WHERE a.attempt_id=historical_id AND a.action='HISTORICAL_MANUAL_REVIEW_CONFIRMED')
 OR before_hash IS DISTINCT FROM (SELECT md5(to_jsonb(a)::text) FROM public.buklod_quiz_attempts a WHERE a.id=missing_id) THEN RAISE EXCEPTION 'QA_FAIL historical integrity'; END IF;
 IF (SELECT count(*) FROM public.buklod_quiz_historical_class_review_v1(exam,sec))<>1 OR has_function_privilege('anon','public.buklod_quiz_historical_class_review_v1(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.buklod_quiz_approve_historical_review_v1(uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'QA_FAIL history isolation'; END IF;
 RAISE NOTICE 'PASS historical visibility, explicit confirmation, cap enforcement, outsider denial, frozen class approval, recorded-score preservation';
 -- R26: verify immutable display even after question bank edits, and no
 -- assignment reconstruction when original evidence is missing.
 UPDATE public.buklod_quiz_questions SET prompt='changed bank',correct_answer='"CHANGED"',points=99 WHERE id=q2;
 IF (SELECT count(*) FROM public.buklod_quiz_attempt_full_review_v2(frozen_id))<>2
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_full_review_v2(frozen_id) x WHERE x.question_id=q2 AND x.prompt='Synthetic short text' AND x.correct_answer_text='expected' AND x.points=4.2)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_full_review_v2(missing_id) x WHERE x.question_id=q2 AND x.points IS NULL AND x.correct_answer_text='')
 OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions WHERE attempt_id=missing_id)
 THEN RAISE EXCEPTION 'QA_FAIL immutable review or historical assignment reconstruction'; END IF;
 SELECT * INTO STRICT result FROM public.buklod_quiz_attempt_faculty_analysis_v1(missing_id);
 IF result.earned_score<>2.8 OR result.max_score<>7 OR result.total_questions<>2 THEN RAISE EXCEPTION 'QA_FAIL recorded analytics'; END IF;
 SELECT md5(to_jsonb(a)::text) INTO saved_hash FROM public.buklod_quiz_attempts a WHERE a.id=historical_id;
 BEGIN
  PERFORM public.buklod_quiz_override_response_score_v2(hist_response,3,'QA',false,false);
  RAISE EXCEPTION 'QA_FAIL historical confirmation bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%confirm the original question reference%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.buklod_quiz_override_response_score_v2(missing_response,3,'QA',true,false);
  RAISE EXCEPTION 'QA_FAIL missing original points accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Verified original assignment required%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.buklod_quiz_override_response_score_v2(hist_response,'NaN'::numeric,'QA',true,false);
  RAISE EXCEPTION 'QA_FAIL nonfinite award accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Score must be%' THEN RAISE; END IF; END;
 IF saved_hash IS DISTINCT FROM (SELECT md5(to_jsonb(a)::text) FROM public.buklod_quiz_attempts a WHERE a.id=historical_id) THEN RAISE EXCEPTION 'QA_FAIL rejected correction mutated result'; END IF;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.buklod_quiz_override_response_score_v2(hist_response,3,'QA',true,true);
  RAISE EXCEPTION 'QA_FAIL outsider correction';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.buklod_quiz_attempt_full_review_v2(historical_id);
  RAISE EXCEPTION 'QA_FAIL outsider full review';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 SELECT * INTO STRICT result FROM public.buklod_quiz_override_response_score_v2(hist_response,3,'QA',true,false);
 IF result.attempt_status<>'GRADED' OR result.total_score<>5.8 OR result.max_score<>7 THEN RAISE EXCEPTION 'QA_FAIL historical correction total'; END IF;
 PERFORM public.buklod_quiz_release_attempt_v2(frozen_id,false,false,false);
 SELECT a.released_at INTO released_stamp FROM public.buklod_quiz_attempts a WHERE a.id=frozen_id;
 IF released_stamp IS NULL THEN RAISE EXCEPTION 'QA_FAIL fixture release'; END IF;
 BEGIN
  PERFORM public.buklod_quiz_override_response_score_v2(frozen_response,2,'QA',true,false);
  RAISE EXCEPTION 'QA_FAIL released confirmation bypass';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Explicit released result correction confirmation%' THEN RAISE; END IF; END;
 SELECT * INTO STRICT result FROM public.buklod_quiz_override_response_score_v2(frozen_response,2,'QA',true,true);
 IF result.attempt_status<>'RELEASED' OR result.total_score<>4.8 OR result.max_score<>7
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=frozen_id AND a.released_at=released_stamp AND a.objective_score=2.8 AND a.manual_score=2)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_audit_log a WHERE a.attempt_id=frozen_id AND a.action='FACULTY_SCORE_CORRECTION_R26')
 OR has_function_privilege('anon','public.buklod_quiz_override_response_score_v2(uuid,numeric,text,boolean,boolean)','EXECUTE')
 OR before_hash IS DISTINCT FROM (SELECT md5(to_jsonb(a)::text) FROM public.buklod_quiz_attempts a WHERE a.id=missing_id)
 THEN RAISE EXCEPTION 'QA_FAIL released correction/audit/identity preservation'; END IF;
 RAISE NOTICE 'PASS R26 frozen review, historical evidence, rejected unsafe scores, audited released correction';
END;
$qa$;
SQL
echo "QUIZ_R27_HISTORICAL_ASSIST_QA_PASS"
