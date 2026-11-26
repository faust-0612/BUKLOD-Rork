#!/usr/bin/env python3
"""Rollback-only draft reconciliation. No production release mode.
Requires two local PostgreSQL service definitions with read privileges on both
projects and transactional insert privileges on an isolated MAIN test target.
Do not store credentials or exported exam payload in Git.
"""
import json
import os
import re
import subprocess
import sys

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
SERVICE = re.compile(r"^[A-Za-z0-9_-]+$")
DEPENDENCIES = (
    "buklod_quiz_attempts", "buklod_quiz_audit_log", "buklod_quiz_documents",
    "buklod_quiz_live_sessions", "buklod_quiz_questions", "buklod_quiz_review_jobs",
    "buklod_quiz_roster",
)

def sql(service, statement):
    if not SERVICE.fullmatch(service):
        raise ValueError("Invalid local service name")
    env = dict(os.environ)
    for key in ("PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER",
                "PGPASSWORD", "PGSERVICE", "PGOPTIONS"):
        env.pop(key, None)
    env["PGCONNECT_TIMEOUT"] = "8"
    result = subprocess.run(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", "service=" + service],
        input=statement, text=True, capture_output=True, env=env, timeout=90,
    )
    if result.returncode:
        # PostgreSQL errors can contain private row values. Do not print stderr.
        raise RuntimeError("Database command failed; inspect securely on the local host")
    return result.stdout.strip()

def read(service, query):
    return json.loads(sql(service, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"
        "SET LOCAL statement_timeout='30s';\n" + query + ";\nROLLBACK;"))

def validate_key(value):
    if not isinstance(value, str) or not UUID.fullmatch(value):
        raise ValueError("Invalid UUID")
    return value

def candidate(source, target):
    query = "SELECT coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb) FROM public.buklod_quiz_exams"
    missing = set(read(source, query)) - set(read(target, query))
    if len(missing) != 1:
        raise RuntimeError("Expected exactly one source-only exam; re-audit required")
    exam = validate_key(missing.pop())
    dependencies = " OR ".join(
        f"EXISTS(SELECT 1 FROM public.{table} WHERE exam_id=e.id)"
        for table in DEPENDENCIES
    )
    payload = read(source, f"""
        SELECT coalesce((SELECT jsonb_build_object('exam',to_jsonb(e),
          'section',(SELECT to_jsonb(s) FROM public.buklod_quiz_sections s WHERE s.exam_id=e.id))
        FROM public.buklod_quiz_exams e WHERE e.id='{exam}'::uuid
        AND e.status='DRAFT' AND e.published_at IS NULL AND e.archived_at IS NULL
        AND e.archived_by IS NULL AND e.available_from IS NULL AND e.available_until IS NULL
        AND e.total_points=0 AND NOT ({dependencies})
        AND (SELECT count(*) FROM public.buklod_quiz_sections s WHERE s.exam_id=e.id)=1
        AND NOT EXISTS(SELECT 1 FROM public.buklod_quiz_sections s WHERE s.exam_id=e.id
          AND (s.archived_at IS NOT NULL OR s.archived_by IS NOT NULL))), 'null'::jsonb)
    """)
    if not isinstance(payload, dict):
        raise RuntimeError("Draft eligibility changed; stop")
    if validate_key(payload["exam"]["id"]) != exam:
        raise RuntimeError("Unexpected exam ID")
    validate_key(payload["exam"]["owner_user_id"])
    validate_key(payload["section"]["id"])
    if payload["section"]["exam_id"] != exam:
        raise RuntimeError("Section relation mismatch")
    return payload

def rollback_sql(payload):
    # Encode the source document as hex to prevent SQL quoting/injection issues.
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode().hex()
    return """
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TEMP TABLE quiz_draft_input(payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO quiz_draft_input VALUES(convert_from(decode('""" + encoded + """','hex'),'UTF8')::jsonb);
DO $qa$
DECLARE
 p jsonb;
 e public.buklod_quiz_exams;
 s public.buklod_quiz_sections;
BEGIN
 SELECT payload INTO STRICT p FROM quiz_draft_input;
 e:=jsonb_populate_record(NULL::public.buklod_quiz_exams,p->'exam');
 s:=jsonb_populate_record(NULL::public.buklod_quiz_sections,p->'section');
 IF e.id IS NULL OR e.owner_user_id IS NULL OR s.id IS NULL
 OR s.exam_id IS DISTINCT FROM e.id OR e.status IS DISTINCT FROM 'DRAFT'
 OR e.published_at IS NOT NULL OR e.archived_at IS NOT NULL OR e.archived_by IS NOT NULL
 OR e.available_from IS NOT NULL OR e.available_until IS NOT NULL OR e.total_points IS DISTINCT FROM 0
 OR s.archived_at IS NOT NULL OR s.archived_by IS NOT NULL
 THEN RAISE EXCEPTION 'Unsafe draft payload'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=e.owner_user_id)
 OR public.buklod_quiz_is_examiner(e.owner_user_id) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Owner not verified'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_exams x WHERE x.id=e.id)
 OR EXISTS(SELECT 1 FROM public.buklod_quiz_sections x WHERE x.id=s.id)
 THEN RAISE EXCEPTION 'Target conflict: no overwrite allowed'; END IF;
 -- Full row equality requires exact schema parity. Never drop unknown fields.
 IF to_jsonb(e) IS DISTINCT FROM p->'exam' OR to_jsonb(s) IS DISTINCT FROM p->'section'
 THEN RAISE EXCEPTION 'Source/target schema or representation mismatch'; END IF;
 INSERT INTO public.buklod_quiz_exams SELECT (e).*;
 INSERT INTO public.buklod_quiz_sections SELECT (s).*;
 IF (SELECT to_jsonb(x) FROM public.buklod_quiz_exams x WHERE x.id=e.id) IS DISTINCT FROM p->'exam'
 OR (SELECT to_jsonb(x) FROM public.buklod_quiz_sections x WHERE x.id=s.id) IS DISTINCT FROM p->'section'
 THEN RAISE EXCEPTION 'Post-insert payload mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempts x WHERE x.exam_id=e.id)
 OR EXISTS(SELECT 1 FROM public.buklod_quiz_live_sessions x WHERE x.exam_id=e.id)
 THEN RAISE EXCEPTION 'Unexpected attempt or session'; END IF;
END;
$qa$;
ROLLBACK;
SELECT 'DRAFT_AND_SECTION_ROLLBACK_QA_PASS';
"""

def main():
    if len(sys.argv) != 3 or sys.argv[1] == sys.argv[2]:
        raise RuntimeError("Usage: script.py dedicated_read_service isolated_main_qa_service")
    source, target = sys.argv[1:]
    payload = candidate(source, target)
    result = sql(target, rollback_sql(payload))
    if result != "DRAFT_AND_SECTION_ROLLBACK_QA_PASS":
        raise RuntimeError("Expected rollback marker missing")
    print(result)
    print("No production release authorized; no live session or grade migration performed")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, RuntimeError, subprocess.SubprocessError, OSError):
        print("QA stopped safely; no release performed", file=sys.stderr)
        sys.exit(1)
