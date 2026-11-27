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
# Production generates trace codes by trigger; fixture deliberately has no production triggers.
"${P[@]}" -q -c "ALTER TABLE public.buklod_quiz_attempts ALTER COLUMN external_capture_trace_code SET DEFAULT ('QA-'||gen_random_uuid()::text)"
for PATCH in AI_PAYLOAD_R1 REVIEW_R2 JOB_V2_R3 WORKER_LEASE_R4 WORKER_FENCE_R6 APPROVAL_R7 RECOVERY_R8 CLASS_APPROVAL_R10 PROVENANCE_R11 FACULTY_READ_R12 LIVE_RECOVERY_R13 BULK_ACTION_R14 SECTION_RECONCILIATION_R15 SECURE_JOIN_R16 SECURE_START_R17 SUBMISSION_R18 REVIEW_CAPTURE_R19 RECORDS_R20 IDENTITY_R21 HISTORICAL_R22 REGRESSION_R23; do
  echo "APPLY_LOCAL=$PATCH"
  run "BUKLOD_QUIZ_CENTRAL_${PATCH}.sql"
done
echo "PASS: all 21 cumulative SQL patches loaded"
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
 job constant uuid:='10000000-0000-0000-0000-000000000012';
 token constant uuid:='10000000-0000-0000-0000-000000000013';
 device constant text:='QA-device-token-0123456789';
 attempt uuid; response uuid; digest text; result record; approvals jsonb; suggestions jsonb; saved jsonb;
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
 BEGIN
  PERFORM public.buklod_quiz_join_live_class_v1('QA0002');
  RAISE EXCEPTION 'QA_FAIL wrong section allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_roster r WHERE r.exam_id=exam AND r.student_user_id=student AND r.section_id=sec) THEN RAISE EXCEPTION 'QA_FAIL roster changed'; END IF;
 PERFORM public.buklod_quiz_join_live_class_v4('QA0001');
 BEGIN
  PERFORM public.buklod_quiz_live_start_attempt_v1(room);
  RAISE EXCEPTION 'QA_FAIL missing device allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'QA_FAIL%' OR SQLERRM NOT ILIKE '%device token%' THEN RAISE; END IF;
 END;
 SELECT * INTO STRICT result FROM public.buklod_quiz_live_start_attempt_v3(room,device);
 attempt:=result.attempt_id;
 IF result.question_count<>2 OR result.total_score_target<>7 THEN RAISE EXCEPTION 'QA_FAIL assignment'; END IF;
 IF (SELECT x.attempt_id FROM public.buklod_quiz_live_start_attempt_v3(room,device) x) IS DISTINCT FROM attempt THEN RAISE EXCEPTION 'QA_FAIL duplicate start'; END IF;
 BEGIN
  PERFORM public.buklod_quiz_save_answer_v2(attempt,q3,'"B"',device);
  RAISE EXCEPTION 'QA_FAIL unassigned answer accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Unassigned question%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.buklod_quiz_save_answer_v2(attempt,q1,'"A"','different-device-012345');
  RAISE EXCEPTION 'QA_FAIL wrong device accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%locked to the first device%' THEN RAISE; END IF;
 END;
 -- Deliberately edit mutable bank after the frozen room was created.
 UPDATE public.buklod_quiz_questions SET correct_answer='"CHANGED"',points=100 WHERE id=q1;
 SELECT * INTO STRICT result FROM public.buklod_quiz_submit_attempt_v4(attempt,jsonb_build_array(jsonb_build_object('question_id',q1,'answer','A'),jsonb_build_object('question_id',q2,'answer','different wording')),NULL,false,NULL,device);
 IF result.status<>'NEEDS_REVIEW' OR result.max_score<>7 OR result.total_score<>2.8 THEN RAISE EXCEPTION 'QA_FAIL snapshot grading %, %, %',result.status,result.total_score,result.max_score; END IF;
 RAISE NOTICE 'PASS join, device binding, assigned-question save and frozen scoring';
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 SELECT x.response_id,x.capture_digest INTO STRICT response,digest FROM public.buklod_quiz_review_ai_payload_v2(attempt) x;
 INSERT INTO public.buklod_quiz_review_jobs(id,exam_id,section_id,created_by,status,attempt_ids,total_attempts) VALUES(job,exam,sec,owner_id,'QUEUED',ARRAY[attempt],1);
 IF public.buklod_quiz_worker_claim_v1(job,owner_id,token) IS DISTINCT FROM true THEN RAISE EXCEPTION 'QA_FAIL worker claim'; END IF;
 suggestions:=jsonb_build_array(jsonb_build_object('response_id',response,'attempt_id',attempt,'job_id',job,'created_by',owner_id,'suggested_score',4.2,'confidence',0.99,'feedback','Synthetic QA','model','qa','capture_digest',digest));
 SELECT r.answer INTO saved FROM public.buklod_quiz_responses r WHERE r.id=response;
 UPDATE public.buklod_quiz_responses SET answer='"changed"' WHERE id=response;
 BEGIN
  PERFORM public.buklod_quiz_worker_commit_v1(job,token,'{}',suggestions);
  RAISE EXCEPTION 'QA_FAIL stale capture accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%STALE_REVIEW_CAPTURE%' THEN RAISE; END IF;
 END;
 UPDATE public.buklod_quiz_responses SET answer=saved WHERE id=response;
 IF public.buklod_quiz_worker_commit_v1(job,token,'{"status":"COMPLETED","next_index":1,"processed_attempts":1}',suggestions) IS DISTINCT FROM true THEN RAISE EXCEPTION 'QA_FAIL worker commit'; END IF;
 PERFORM public.buklod_quiz_worker_release_v1(job,token);
 approvals:=public.buklod_quiz_approve_section_suggestions_v2(exam,sec,job,NULL);
 IF (approvals->>'approved')::int<>1 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=attempt AND a.status='GRADED' AND a.total_score=7 AND a.max_score=7) THEN RAISE EXCEPTION 'QA_FAIL approval %',approvals; END IF;
 IF has_function_privilege('anon','public.buklod_quiz_join_live_class_v3(text)','EXECUTE') OR has_function_privilege('authenticated','public.buklod_quiz_approve_section_suggestions_v2(uuid,uuid,uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'QA_FAIL privilege boundary'; END IF;
 PERFORM public.buklod_quiz_section_analytics_v2(exam,sec);
 RAISE NOTICE 'PASS captured-reference review, gated class approval, analytics';
END;
$qa$;
SQL
"${P[@]}" -q <<'SQL'
DO $qa$
DECLARE
 owner_id constant uuid:='10000000-0000-0000-0000-000000000001';
 student constant uuid:='10000000-0000-0000-0000-000000000002';
 outsider constant uuid:='10000000-0000-0000-0000-000000000003';
 exam constant uuid:='10000000-0000-0000-0000-000000000004';
 sec constant uuid:='10000000-0000-0000-0000-000000000005';
 room constant uuid:='10000000-0000-0000-0000-000000000007';
 q1 constant uuid:='10000000-0000-0000-0000-000000000009';
 q2 constant uuid:='10000000-0000-0000-0000-000000000010';
 device constant text:='QA-device-token-0123456789';
 original_id uuid; old_id uuid; new_id uuid; lease text; res record; action_result jsonb; payload jsonb;
BEGIN
 SELECT a.id INTO STRICT original_id FROM public.buklod_quiz_attempts a WHERE a.student_user_id=student AND a.status='GRADED';
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 IF public.buklod_quiz_release_attempt_v2(original_id,false,false,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'QA_FAIL release'; END IF;
 BEGIN
  PERFORM public.buklod_quiz_live_student_action_v1(room,student,'RESET_ATTEMPT',30);
  RAISE EXCEPTION 'QA_FAIL released reset allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Only an unfinished attempt%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.buklod_quiz_live_student_action_v2(room,student,'REOPEN',30);
  RAISE EXCEPTION 'QA_FAIL released reopen allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Completed results cannot be reopened%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.buklod_quiz_records_remove_for_reentry_v1(exam,sec,student);
  RAISE EXCEPTION 'QA_FAIL released removal allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Released records cannot be removed%' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.buklod_quiz_live_bulk_action_v3(room,'REMOVE_SELECTED',NULL,NULL);
  RAISE EXCEPTION 'QA_FAIL implicit selected remove';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Explicit student selection%' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 BEGIN
  PERFORM public.buklod_quiz_my_released_attempt_answers_v1(original_id);
  RAISE EXCEPTION 'QA_FAIL disabled answer review exposed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Faculty did not enable%' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM public.buklod_quiz_release_attempt_v2(original_id,false,true,true);
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 IF (SELECT count(*) FROM public.buklod_quiz_my_released_attempt_answers_v1(original_id))<>2 THEN RAISE EXCEPTION 'QA_FAIL released answer visibility'; END IF;
 PERFORM set_config('request.jwt.claim.sub',outsider::text,true);
 BEGIN
  PERFORM public.buklod_quiz_my_released_attempt_answers_v1(original_id);
  RAISE EXCEPTION 'QA_FAIL outsider released review';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Released result not found%' THEN RAISE; END IF;
 END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM public.buklod_quiz_live_student_action_v2(room,student,'ALLOW_NEW_ATTEMPT',NULL);
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 SELECT x.attempt_id INTO STRICT old_id FROM public.buklod_quiz_live_start_attempt_v3(room,device) x;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 BEGIN
  PERFORM public.buklod_quiz_live_student_action_v1(room,student,'FORCE_SUBMIT',NULL);
  RAISE EXCEPTION 'QA_FAIL blank force submit';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%0 server-saved answers%' THEN RAISE; END IF;
 END;
 action_result:=public.buklod_quiz_live_student_action_v2(room,student,'RESET_ATTEMPT',30);
 new_id:=(action_result->>'attempt_id')::uuid;
 IF new_id=old_id OR (action_result->>'voided_attempts')::integer<>1 OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=old_id AND a.status='VOID') OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=original_id AND a.status='RELEASED' AND a.total_score=7 AND a.max_score=7) THEN RAISE EXCEPTION 'QA_FAIL reset grade preservation'; END IF;
 IF (SELECT count(*) FROM public.buklod_quiz_attempt_questions aq WHERE aq.attempt_id=new_id)<>2 THEN RAISE EXCEPTION 'QA_FAIL reset assignments'; END IF;
 RAISE NOTICE 'PASS released-grade preservation, scoped reset, blank force-submit protection, release visibility';
 PERFORM set_config('request.jwt.claim.sub',student::text,true);
 PERFORM public.buklod_quiz_live_start_attempt_v3(room,device);
 SELECT l.lease_token INTO STRICT lease FROM public.buklod_quiz_issue_offline_lease_v2(new_id,device,NULL) l;
 -- Synthetic expiry simulation: no real clock waiting, no external connections.
 UPDATE public.buklod_quiz_attempts SET started_at=now()-interval '30 minutes',expires_at=now()-interval '1 minute' WHERE id=new_id;
 UPDATE public.buklod_quiz_offline_leases SET issued_at=now()-interval '10 minutes',attempt_expires_at=now()-interval '1 minute',sync_grace_expires_at=now()+interval '14 minutes' WHERE attempt_id=new_id;
 payload:=jsonb_build_array(jsonb_build_object('question_id',q1,'answer','A'),jsonb_build_object('question_id',q2,'answer','expected'));
 BEGIN
  PERFORM public.buklod_quiz_submit_attempt_v4(new_id,payload,now()-interval '2 minutes',true,'invalid-lease',device);
  RAISE EXCEPTION 'QA_FAIL invalid offline lease accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT ILIKE '%Valid device-bound offline lease required%' THEN RAISE; END IF;
 END;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempts a WHERE a.id=new_id AND a.status='STARTED') THEN RAISE EXCEPTION 'QA_FAIL rejected submission changed state'; END IF;
 SELECT * INTO STRICT res FROM public.buklod_quiz_submit_attempt_v4(new_id,payload,now()-interval '2 minutes',true,lease,device);
 IF res.status<>'GRADED' OR res.total_score<>7 OR res.max_score<>7 THEN RAISE EXCEPTION 'QA_FAIL offline grade %',row_to_json(res); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.buklod_quiz_offline_leases l WHERE l.attempt_id=new_id AND l.used_at IS NOT NULL) THEN RAISE EXCEPTION 'QA_FAIL lease not consumed'; END IF;
 SELECT * INTO STRICT res FROM public.buklod_quiz_submit_attempt_v4(new_id,payload,now()-interval '2 minutes',true,lease,device);
 IF res.status<>'GRADED' OR res.total_score<>7 THEN RAISE EXCEPTION 'QA_FAIL retry changed score'; END IF;
 RAISE NOTICE 'PASS invalid lease rejection, device-bound offline recovery and idempotent retry';
END;
$qa$;
SQL
echo "QUIZ_R23_REGRESSION_QA_PASS (not production approval)"
