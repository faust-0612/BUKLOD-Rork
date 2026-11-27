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
for PATCH in AI_PAYLOAD_R1 REVIEW_R2 JOB_V2_R3 WORKER_LEASE_R4 WORKER_FENCE_R6 APPROVAL_R7 RECOVERY_R8 CLASS_APPROVAL_R10 PROVENANCE_R11 FACULTY_READ_R12 LIVE_RECOVERY_R13 BULK_ACTION_R14 SECTION_RECONCILIATION_R15 SECURE_JOIN_R16 SECURE_START_R17 SUBMISSION_R18 REVIEW_CAPTURE_R19 RECORDS_R20 IDENTITY_R21 HISTORICAL_R22 REGRESSION_R23 FRONTEND_CONTRACT_R24 HISTORICAL_COMPAT_R25; do
  run "BUKLOD_QUIZ_CENTRAL_${PATCH}.sql"
done
echo "R25 disposable fixture ready"
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
 hist_response uuid; missing_response uuid; frozen_response uuid; result record; payload jsonb; before_hash text;
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
 SELECT * INTO STRICT result FROM public.buklod_quiz_approve_historical_review_v1(historical_id,payload,true);
 IF result.status<>'GRADED' OR result.total_score<>7 OR result.max_score<>7 OR result.reviewed_count<>1
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=historical_id AND a.objective_score=2.8 AND a.manual_score=4.2 AND a.released_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_audit_log a WHERE a.attempt_id=historical_id AND a.action='HISTORICAL_MANUAL_REVIEW_CONFIRMED')
 OR before_hash IS DISTINCT FROM (SELECT md5(to_jsonb(a)::text) FROM public.buklod_quiz_attempts a WHERE a.id=missing_id) THEN RAISE EXCEPTION 'QA_FAIL historical integrity'; END IF;
 IF (SELECT count(*) FROM public.buklod_quiz_historical_class_review_v1(exam,sec))<>1 OR has_function_privilege('anon','public.buklod_quiz_historical_class_review_v1(uuid,uuid)','EXECUTE') OR has_function_privilege('anon','public.buklod_quiz_approve_historical_review_v1(uuid,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'QA_FAIL history isolation'; END IF;
 RAISE NOTICE 'PASS historical visibility, explicit confirmation, cap enforcement, outsider denial, frozen class approval, recorded-score preservation';
END;
$qa$;
SQL
echo "QUIZ_R25_HISTORICAL_COMPAT_QA_PASS"
