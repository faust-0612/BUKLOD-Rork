#!/usr/bin/env bash
# Local disposable PostgreSQL only; no production connection, no real student data.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
REF="${1:-HEAD}"
BIN="$(pg_config --bindir 2>/dev/null || true)"
if [[ ! -x "$BIN/initdb" ]]; then BIN=/usr/lib/postgresql/17/bin; fi
[[ -x "$BIN/initdb" && -x "$BIN/pg_ctl" && -x "$BIN/psql" ]] || { echo "Local PostgreSQL binaries missing"; exit 1; }
[[ "$(id -u)" != 0 ]] || { echo "Run as non-root WSL user"; exit 1; }
WORK="$(mktemp -d /tmp/buklod-quiz-local.XXXXXX)"
cleanup() {
  "$BIN/pg_ctl" -D "$WORK/db" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf -- "$WORK"
}
trap cleanup EXIT
"$BIN/initdb" -D "$WORK/db" -A trust --no-locale >/dev/null
"$BIN/pg_ctl" -D "$WORK/db" -l "$WORK/server.log" -o "-h '' -k $WORK -p 55439" -w start >/dev/null
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGOPTIONS
export PGCONNECT_TIMEOUT=5
P=("$BIN/psql" -X -v ON_ERROR_STOP=1 -h "$WORK" -p 55439 -U "$(id -un)" -d postgres)
"${P[@]}" -q <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE public.buklod_quiz_exams(id uuid PRIMARY KEY,owner_user_id uuid NOT NULL);
CREATE TABLE public.buklod_quiz_sections(id uuid PRIMARY KEY,exam_id uuid NOT NULL);
CREATE TABLE public.buklod_quiz_attempts(id uuid PRIMARY KEY,exam_id uuid NOT NULL,section_id uuid NOT NULL,status text NOT NULL,total_score numeric,max_score numeric);
CREATE TABLE public.buklod_quiz_questions(id uuid PRIMARY KEY,exam_id uuid NOT NULL,question_type text,points numeric,correct_answer jsonb,explanation text,rubric jsonb);
CREATE TABLE public.buklod_quiz_responses(id uuid PRIMARY KEY,attempt_id uuid NOT NULL,question_id uuid NOT NULL,answer jsonb,manual_score numeric,needs_review boolean,feedback text,reviewed_by uuid,reviewed_at timestamptz,updated_at timestamptz);
CREATE TABLE public.buklod_quiz_review_jobs(id uuid PRIMARY KEY,exam_id uuid NOT NULL,section_id uuid NOT NULL,created_by uuid NOT NULL,status text NOT NULL,attempt_ids uuid[] NOT NULL,next_index integer NOT NULL DEFAULT 0,total_attempts integer NOT NULL,processed_attempts integer NOT NULL DEFAULT 0,failed_attempts integer NOT NULL DEFAULT 0,current_attempt_id uuid,last_error text,heartbeat_at timestamptz,updated_at timestamptz,completed_at timestamptz);
CREATE TABLE public.buklod_quiz_review_suggestions(response_id uuid PRIMARY KEY,job_id uuid NOT NULL,attempt_id uuid NOT NULL,suggested_score numeric,feedback text,confidence numeric,model text,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz);
-- Test doubles for application-specific examiner lookup and grade computation.
-- Real grading was exercised separately in the rollback positive-path test.
CREATE FUNCTION public.buklod_quiz_is_examiner(p_user uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p_user='00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.buklod_quiz_compute_attempt_internal(p_attempt_id uuid) RETURNS void LANGUAGE sql AS $$
 UPDATE public.buklod_quiz_attempts a SET status='GRADED',total_score=(SELECT sum(r.manual_score) FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id) WHERE a.id=p_attempt_id AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_responses r WHERE r.attempt_id=a.id AND r.needs_review);
$$;
INSERT INTO public.buklod_quiz_exams VALUES('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
INSERT INTO public.buklod_quiz_sections VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');
INSERT INTO public.buklod_quiz_questions VALUES('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','SHORT_TEXT',2,'"yes"',NULL,NULL);
INSERT INTO public.buklod_quiz_attempts SELECT ('10000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','NEEDS_REVIEW',0,2 FROM generate_series(1,53) i;
INSERT INTO public.buklod_quiz_responses(id,attempt_id,question_id,answer,needs_review)
SELECT ('20000000-0000-0000-0000-'||right(id::text,12))::uuid,id,'00000000-0000-0000-0000-000000000004','"yes"',true FROM public.buklod_quiz_attempts;
INSERT INTO public.buklod_quiz_review_jobs(id,exam_id,section_id,created_by,status,attempt_ids,total_attempts)
SELECT '00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','QUEUED',array_agg(id ORDER BY id),53 FROM public.buklod_quiz_attempts;
SQL
for PATCH in WORKER_LEASE_R4 APPROVAL_R7 PROVENANCE_R11; do
  git -C "$ROOT" show "$REF:supabase/pending/BUKLOD_QUIZ_CENTRAL_${PATCH}.sql" > "$WORK/patch.sql"
  "${P[@]}" -q -f "$WORK/patch.sql"
done
JOB=00000000-0000-0000-0000-000000000005
ACTOR=00000000-0000-0000-0000-000000000001
A=00000000-0000-0000-0000-000000000006
B=00000000-0000-0000-0000-000000000007
PGAPPNAME=quiz_qa_a "${P[@]}" -Atq -c "BEGIN; SELECT public.buklod_quiz_worker_claim_v1('$JOB','$ACTOR','$A'); SELECT pg_sleep(8); COMMIT;" >"$WORK/a" 2>"$WORK/a.err" &
PID_A=$!
wait_for() {
  local query="$1"
  for i in $(seq 1 50); do
    if [[ "$("${P[@]}" -Atq -c "$query")" == t ]]; then return 0; fi
    sleep 0.1
  done
  return 1
}
wait_for "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='quiz_qa_a' AND wait_event='PgSleep')" || { cat "$WORK/a.err"; echo "FAIL: worker A did not hold transaction"; exit 1; }
PGAPPNAME=quiz_qa_b "${P[@]}" -Atq -c "SELECT public.buklod_quiz_worker_claim_v1('$JOB','$ACTOR','$B');" >"$WORK/b" 2>"$WORK/b.err" &
PID_B=$!
wait_for "SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='quiz_qa_b' AND wait_event_type='Lock')" || { echo "FAIL: no observed concurrent contention"; exit 1; }
wait "$PID_A"; wait "$PID_B"
grep -qx t "$WORK/a"
grep -qx f "$WORK/b"
echo "PASS: two concurrent database sessions, only one lease acquired (lock wait observed)"
"${P[@]}" -q <<'SQL'
DO $test$
DECLARE
 job constant uuid:='00000000-0000-0000-0000-000000000005';
 actor constant uuid:='00000000-0000-0000-0000-000000000001';
 exam constant uuid:='00000000-0000-0000-0000-000000000002';
 section constant uuid:='00000000-0000-0000-0000-000000000003';
 token constant uuid:='00000000-0000-0000-0000-000000000006';
 b constant uuid:='00000000-0000-0000-0000-000000000007';
 suggestions jsonb; page jsonb; cursor_id uuid;
BEGIN
 UPDATE public.buklod_quiz_review_worker_leases SET expires_at=clock_timestamp()-interval '1 sec' WHERE job_id=job;
 IF public.buklod_quiz_worker_claim_v1(job,actor,b) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL takeover'; END IF;
 IF public.buklod_quiz_worker_commit_v1(job,token,'{}','[]') IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL stale write'; END IF;
 SELECT jsonb_agg(jsonb_build_object('response_id',r.id,'attempt_id',r.attempt_id,'job_id',job,'suggested_score',2,'confidence',0.99,'feedback','synthetic','model','qa','created_by',actor)) INTO suggestions FROM public.buklod_quiz_responses r;
 IF public.buklod_quiz_worker_commit_v1(job,b,jsonb_build_object('status','COMPLETED','next_index',53,'processed_attempts',53,'completed_at',now()),suggestions) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL fenced commit'; END IF;
 IF public.buklod_quiz_worker_release_v1(job,b) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL release'; END IF;
 UPDATE public.buklod_quiz_review_suggestions SET feedback='tampered' WHERE attempt_id='10000000-0000-0000-0000-000000000001';
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 page:=public.buklod_quiz_approve_section_suggestions_v2(exam,section,job,NULL);
 IF (page->>'scanned')::int IS DISTINCT FROM 50 OR (page->>'approved')::int IS DISTINCT FROM 49 OR (page->>'skipped')::int IS DISTINCT FROM 1 OR (page->>'failed')::int IS DISTINCT FROM 0 OR (page->>'may_have_more')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL first page %',page; END IF;
 cursor_id:=(page->>'next_cursor')::uuid;
 IF cursor_id IS DISTINCT FROM '10000000-0000-0000-0000-000000000050'::uuid THEN RAISE EXCEPTION 'FAIL cursor'; END IF;
 page:=public.buklod_quiz_approve_section_suggestions_v2(exam,section,job,cursor_id);
 IF (page->>'scanned')::int IS DISTINCT FROM 3 OR (page->>'approved')::int IS DISTINCT FROM 3 OR (page->>'failed')::int IS DISTINCT FROM 0 OR (page->>'may_have_more')::boolean IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL second page %',page; END IF;
 IF (SELECT count(*) FROM public.buklod_quiz_attempts WHERE status='GRADED' AND total_score=2)<>52 OR (SELECT count(*) FROM public.buklod_quiz_attempts WHERE status='NEEDS_REVIEW')<>1 OR EXISTS(SELECT 1 FROM public.buklod_quiz_attempts WHERE status='RELEASED') THEN RAISE EXCEPTION 'FAIL final state'; END IF;
 RAISE NOTICE 'PASS: stale worker fenced, 53 synthetic attempts scanned in pages 50+3, 52 graded, 1 pending, 0 released';
END;
$test$;
SQL
echo "PASS: local concurrency and batch-boundary suite completed"
