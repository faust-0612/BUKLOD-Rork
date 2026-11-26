-- Synthetic QA fixture captured from MAIN catalog, 2026-11-26. NO ROW DATA.
-- Does not emulate Supabase Auth gateway, RLS, triggers, external app services.
-- Auth and system-admin are test doubles. Run only on disposable private PostgreSQL.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.is_system_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
SET search_path=public,extensions;
SET check_function_bodies=off;
CREATE TABLE public."buklod_education_classrooms"(
 "id" uuid,
 "faculty_user_id" uuid,
 "name" text,
 "subject_code" text,
 "section_name" text,
 "school_year" text,
 "term" text,
 "status" text,
 "grading_policy" jsonb,
 "closed_at" timestamp with time zone,
 "created_at" timestamp with time zone,
 "updated_at" timestamp with time zone,
 "description" text,
 "classroom_mode" text,
 "classroom_plan" text,
 "free_live_minutes" integer,
 "cover_path" text,
 "meeting_provider" text,
 "allow_student_posts" boolean,
 "allow_student_chat" boolean,
 "allow_student_uploads" boolean,
 "program_key" text,
 "subject_type" text,
 "template_key" text,
 "course_flow_mode" text,
 "passing_percent" numeric,
 "grading_terms" jsonb,
 "adaptive_config" jsonb,
 "archived_at" timestamp with time zone,
 "archived_by" uuid
);
CREATE TABLE public."buklod_focus_app_admins"(
 "scope_id" uuid,
 "focus_app_code" text,
 "user_id" uuid,
 "is_primary" boolean,
 "assigned_via" text,
 "assigned_by" uuid,
 "assigned_at" timestamp with time zone
);
CREATE TABLE public."buklod_focus_app_subscription_config"(
 "focus_app_code" text,
 "display_name" text,
 "annual_amount_php" numeric(14,2),
 "currency" text,
 "gcash_number" text,
 "billing_interval" text,
 "is_active" boolean,
 "metadata" jsonb,
 "created_at" timestamp with time zone,
 "updated_at" timestamp with time zone
);
CREATE TABLE public."buklod_quiz_attempt_allowances"(
 "live_session_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "bonus_attempts" integer NOT NULL DEFAULT 0,
 "granted_by" uuid,
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_attempt_questions"(
 "attempt_id" uuid NOT NULL,
 "question_id" uuid NOT NULL,
 "display_order" integer NOT NULL,
 "source_points" numeric NOT NULL,
 "points" numeric NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_attempts"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "section_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "attempt_no" integer NOT NULL,
 "status" text NOT NULL DEFAULT 'STARTED'::text,
 "started_at" timestamp with time zone NOT NULL DEFAULT now(),
 "expires_at" timestamp with time zone NOT NULL,
 "submitted_at" timestamp with time zone,
 "objective_score" numeric NOT NULL DEFAULT 0,
 "manual_score" numeric NOT NULL DEFAULT 0,
 "total_score" numeric NOT NULL DEFAULT 0,
 "max_score" numeric NOT NULL DEFAULT 0,
 "released_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 "integrity_violation_count" integer NOT NULL DEFAULT 0,
 "integrity_flagged_at" timestamp with time zone,
 "integrity_last_event_at" timestamp with time zone,
 "live_session_id" uuid,
 "external_capture_trace_code" text NOT NULL,
 "external_capture_trace_version" integer NOT NULL DEFAULT 1,
 "device_binding_hash" text,
 "device_bound_at" timestamp with time zone,
 "device_change_count" integer NOT NULL DEFAULT 0,
 "last_client_seen_at" timestamp with time zone,
 "last_answer_at" timestamp with time zone,
 "answer_save_count" integer NOT NULL DEFAULT 0,
 "rapid_answer_count" integer NOT NULL DEFAULT 0,
 "security_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public."buklod_quiz_audit_log"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid,
 "section_id" uuid,
 "live_session_id" uuid,
 "attempt_id" uuid,
 "actor_user_id" uuid,
 "action" text NOT NULL,
 "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_documents"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "owner_user_id" uuid NOT NULL,
 "file_name" text NOT NULL,
 "storage_path" text NOT NULL,
 "mime_type" text NOT NULL DEFAULT 'application/pdf'::text,
 "file_size" bigint,
 "status" text NOT NULL DEFAULT 'UPLOADED'::text,
 "processing_note" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "processed_at" timestamp with time zone
);
CREATE TABLE public."buklod_quiz_events"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "attempt_id" uuid,
 "student_user_id" uuid,
 "event_type" text NOT NULL,
 "event_data" jsonb,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_examiner_roles"(
 "user_id" uuid NOT NULL,
 "is_active" boolean NOT NULL DEFAULT true,
 "granted_by" uuid,
 "granted_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_exams"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "owner_user_id" uuid NOT NULL,
 "title" text NOT NULL,
 "exam_type" text NOT NULL DEFAULT 'EXAM'::text,
 "instructions" text,
 "duration_minutes" integer NOT NULL DEFAULT 30,
 "max_attempts" integer NOT NULL DEFAULT 1,
 "status" text NOT NULL DEFAULT 'DRAFT'::text,
 "randomize_questions" boolean NOT NULL DEFAULT true,
 "one_question_at_a_time" boolean NOT NULL DEFAULT true,
 "no_backtracking" boolean NOT NULL DEFAULT false,
 "pass_percent" numeric NOT NULL DEFAULT 75,
 "total_points" numeric NOT NULL DEFAULT 0,
 "available_from" timestamp with time zone,
 "available_until" timestamp with time zone,
 "published_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 "integrity_mode" text NOT NULL DEFAULT 'MONITOR'::text,
 "integrity_violation_limit" integer NOT NULL DEFAULT 3,
 "integrity_auto_submit" boolean NOT NULL DEFAULT false,
 "require_fullscreen_web" boolean NOT NULL DEFAULT false,
 "block_screen_capture" boolean NOT NULL DEFAULT true,
 "exam_language" text NOT NULL DEFAULT 'ENGLISH'::text,
 "archived_at" timestamp with time zone,
 "archived_by" uuid,
 "randomize_choices" boolean NOT NULL DEFAULT false,
 "security_preset" text NOT NULL DEFAULT 'STANDARD'::text,
 "device_policy" text NOT NULL DEFAULT 'MONITOR'::text,
 "behavior_monitoring" boolean NOT NULL DEFAULT true,
 "offline_security_mode" text NOT NULL DEFAULT 'SIGNED_LEASE'::text,
 "default_live_join_policy" text NOT NULL DEFAULT 'OPEN'::text,
 "description" text
);
CREATE TABLE public."buklod_quiz_faculty_actions"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "actor_user_id" uuid NOT NULL,
 "exam_id" uuid,
 "section_id" uuid,
 "live_session_id" uuid,
 "attempt_id" uuid,
 "action" text NOT NULL,
 "action_data" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_faculty_entitlements"(
 "user_id" uuid NOT NULL,
 "status" text NOT NULL DEFAULT 'INACTIVE'::text,
 "activated_at" timestamp with time zone,
 "expires_at" timestamp with time zone,
 "source" text NOT NULL DEFAULT 'BUKLOD_CONNECT_FACULTY'::text,
 "source_updated_at" timestamp with time zone,
 "synced_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_integrity_deduction_rules"(
 "owner_user_id" uuid NOT NULL,
 "event_type" text NOT NULL,
 "points_per_occurrence" numeric NOT NULL DEFAULT 0,
 "note_template" text,
 "is_enabled" boolean NOT NULL DEFAULT false,
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_integrity_deductions"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "attempt_id" uuid NOT NULL,
 "event_type" text NOT NULL,
 "deduction_points" numeric NOT NULL DEFAULT 0,
 "note" text,
 "applied_by" uuid,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_live_members"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "session_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "status" text NOT NULL DEFAULT 'WAITING'::text,
 "display_name" text NOT NULL DEFAULT ''::text,
 "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
 "admitted_at" timestamp with time zone,
 "removed_at" timestamp with time zone,
 "last_seen_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_live_question_snapshots"(
 "session_id" uuid NOT NULL,
 "question_id" uuid NOT NULL,
 "question_type" text NOT NULL,
 "prompt" text NOT NULL,
 "options" jsonb,
 "correct_answer" jsonb,
 "points" numeric NOT NULL,
 "sort_order" integer NOT NULL,
 "source_pages" text,
 "rubric" jsonb,
 "explanation" text,
 "snapshot_order" integer NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_live_sessions"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "faculty_user_id" uuid NOT NULL,
 "join_code" text NOT NULL,
 "status" text NOT NULL DEFAULT 'WAITING'::text,
 "admission_mode" text NOT NULL DEFAULT 'OPEN'::text,
 "allow_late_join" boolean NOT NULL DEFAULT true,
 "started_at" timestamp with time zone,
 "paused_at" timestamp with time zone,
 "ended_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 "section_id" uuid NOT NULL,
 "duration_minutes" integer,
 "max_attempts" integer,
 "pass_percent" numeric,
 "question_count" integer,
 "total_score_target" numeric,
 "randomize_questions" boolean,
 "randomize_choices" boolean,
 "one_question_at_a_time" boolean,
 "no_backtracking" boolean,
 "late_join_minutes" integer,
 "require_fullscreen_web" boolean,
 "block_screen_capture" boolean,
 "integrity_mode" text,
 "result_release_mode" text NOT NULL DEFAULT 'MANUAL'::text,
 "show_answers_after_release" boolean NOT NULL DEFAULT true,
 "show_correct_after_release" boolean NOT NULL DEFAULT false,
 "show_explanations_after_release" boolean NOT NULL DEFAULT false,
 "selected_question_ids" uuid[],
 "settings_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
 "config_locked_at" timestamp with time zone,
 "security_preset" text,
 "device_policy" text,
 "behavior_monitoring" boolean,
 "offline_security_mode" text,
 "join_policy" text NOT NULL DEFAULT 'OPEN'::text,
 "question_snapshot_hash" text
);
CREATE TABLE public."buklod_quiz_main_entry_gate"(
 "user_id" uuid NOT NULL,
 "last_issued_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_offline_leases"(
 "attempt_id" uuid NOT NULL,
 "lease_token_hash" text NOT NULL,
 "device_hash" text,
 "issued_at" timestamp with time zone NOT NULL DEFAULT now(),
 "expires_at" timestamp with time zone,
 "revoked_at" timestamp with time zone,
 "last_used_at" timestamp with time zone,
 "student_user_id" uuid NOT NULL,
 "attempt_expires_at" timestamp with time zone NOT NULL,
 "sync_grace_expires_at" timestamp with time zone NOT NULL,
 "used_at" timestamp with time zone
);
CREATE TABLE public."buklod_quiz_questions"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "source_document_id" uuid,
 "question_type" text NOT NULL DEFAULT 'MCQ'::text,
 "prompt" text NOT NULL,
 "options" jsonb,
 "correct_answer" jsonb,
 "points" numeric NOT NULL DEFAULT 1,
 "sort_order" integer NOT NULL DEFAULT 1,
 "source_pages" text,
 "rubric" jsonb,
 "explanation" text,
 "is_active" boolean NOT NULL DEFAULT true,
 "created_by" uuid,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_r13_quarantine"(
 "source_table" text NOT NULL,
 "source_pk" text NOT NULL,
 "source_user_id" uuid,
 "reason" text NOT NULL,
 "payload" jsonb NOT NULL,
 "preserved_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_release_preferences"(
 "attempt_id" uuid NOT NULL,
 "show_score" boolean NOT NULL DEFAULT true,
 "show_violations" boolean NOT NULL DEFAULT false,
 "show_answers" boolean NOT NULL DEFAULT false,
 "show_rationale" boolean NOT NULL DEFAULT false,
 "released_by" uuid,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_responses"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "attempt_id" uuid NOT NULL,
 "question_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "answer" jsonb,
 "objective_score" numeric,
 "manual_score" numeric,
 "is_correct" boolean,
 "needs_review" boolean NOT NULL DEFAULT false,
 "feedback" text,
 "reviewed_by" uuid,
 "reviewed_at" timestamp with time zone,
 "saved_at" timestamp with time zone NOT NULL DEFAULT now(),
 "answer_change_count" integer NOT NULL DEFAULT 0,
 "first_answered_at" timestamp with time zone,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_review_jobs"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "section_id" uuid NOT NULL,
 "created_by" uuid NOT NULL,
 "status" text NOT NULL DEFAULT 'QUEUED'::text,
 "attempt_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[],
 "next_index" integer NOT NULL DEFAULT 0,
 "total_attempts" integer NOT NULL DEFAULT 0,
 "processed_attempts" integer NOT NULL DEFAULT 0,
 "failed_attempts" integer NOT NULL DEFAULT 0,
 "current_attempt_id" uuid,
 "last_error" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "started_at" timestamp with time zone,
 "heartbeat_at" timestamp with time zone,
 "completed_at" timestamp with time zone,
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_review_suggestions"(
 "response_id" uuid NOT NULL,
 "job_id" uuid NOT NULL,
 "attempt_id" uuid NOT NULL,
 "suggested_score" numeric,
 "feedback" text,
 "confidence" numeric NOT NULL DEFAULT 0,
 "model" text,
 "created_by" uuid NOT NULL,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_roster"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "section_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "student_no" text,
 "surname" text NOT NULL DEFAULT ''::text,
 "first_name" text NOT NULL DEFAULT ''::text,
 "display_name" text NOT NULL DEFAULT ''::text,
 "status" text NOT NULL DEFAULT 'ACTIVE'::text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."buklod_quiz_section_join_overrides"(
 "session_id" uuid NOT NULL,
 "student_user_id" uuid NOT NULL,
 "granted_by" uuid NOT NULL,
 "note" text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "expires_at" timestamp with time zone
);
CREATE TABLE public."buklod_quiz_sections"(
 "id" uuid NOT NULL DEFAULT gen_random_uuid(),
 "exam_id" uuid NOT NULL,
 "name" text NOT NULL,
 "sort_order" integer NOT NULL DEFAULT 1,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "archived_at" timestamp with time zone,
 "archived_by" uuid
);
CREATE TABLE public."buklod_user_focus_app_entitlements"(
 "id" uuid,
 "user_id" uuid,
 "focus_app_code" text,
 "status" text,
 "source" text,
 "activated_at" timestamp with time zone,
 "expires_at" timestamp with time zone,
 "last_payment_request_id" uuid,
 "granted_by" uuid,
 "metadata" jsonb,
 "created_at" timestamp with time zone,
 "updated_at" timestamp with time zone
);
CREATE TABLE public."profiles"(
 "id" uuid,
 "full_name" text,
 "mobile" text,
 "birth_date" date,
 "sex" text,
 "avatar_url" text,
 "church_id" uuid,
 "role" text,
 "is_active" boolean,
 "created_at" timestamp with time zone,
 "updated_at" timestamp with time zone,
 "preferred_language" text,
 "quick_note" text,
 "first_name" text,
 "middle_name" text,
 "surname" text,
 "suffix" text,
 "username" text,
 "login_method" text,
 "login_identifier" text,
 "is_verified" boolean,
 "verified_by" uuid,
 "verified_at" timestamp with time zone,
 "preferred_bible_version" text,
 "connection_type" text,
 "trust_level" smallint,
 "profile_background_url" text,
 "user_deactivated_at" timestamp with time zone,
 "user_deactivation_reason" text,
 "user_deactivation_prev_active" boolean,
 "last_user_reactivated_at" timestamp with time zone
);
CREATE OR REPLACE FUNCTION private.buklod_quiz_canonical_integrity_count_v1(p_attempt_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(sum(x.event_count),0)::integer
  from private.buklod_quiz_canonical_integrity_events_v1(p_attempt_id) x
$function$;
CREATE OR REPLACE FUNCTION private.buklod_quiz_canonical_integrity_events_v1(p_attempt_id uuid)
 RETURNS TABLE(event_type text, event_count integer, first_event_at timestamp with time zone, last_event_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with departure_raw as (
    select
      ev.id,
      ev.event_type,
      ev.created_at,
      lag(ev.created_at) over(order by ev.created_at,ev.id) as prev_created_at
    from public.buklod_quiz_events ev
    where ev.attempt_id=p_attempt_id
      and ev.event_type in (
        'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','FULLSCREEN_EXIT'
      )
  ), departure_marked as (
    select
      id,event_type,created_at,
      case
        when prev_created_at is null or created_at-prev_created_at>interval '5 seconds' then 1
        else 0
      end as new_group
    from departure_raw
  ), departure_labeled as (
    select
      id,event_type,created_at,
      sum(new_group) over(order by created_at,id rows unbounded preceding) as grp
    from departure_marked
  ), departure_groups as (
    select grp,min(created_at) as first_at,max(created_at) as last_at
    from departure_labeled
    group by grp
  ), departure_representative as (
    select distinct on (grp)
      grp,event_type,created_at
    from departure_labeled
    order by grp,created_at,id
  ), canonical_rows as (
    select
      r.event_type,
      g.first_at as first_at,
      g.last_at as last_at
    from departure_representative r
    join departure_groups g using(grp)

    union all

    select
      ev.event_type,
      ev.created_at,
      ev.created_at
    from public.buklod_quiz_events ev
    where ev.attempt_id=p_attempt_id
      and ev.event_type in (
        'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT',
        'CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
      )
  )
  select
    c.event_type,
    count(*)::integer,
    min(c.first_at),
    max(c.last_at)
  from canonical_rows c
  group by c.event_type
$function$;
CREATE OR REPLACE FUNCTION private.buklod_quiz_normalized_scalar(p_value jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select lower(trim(coalesce(p_value #>> '{}', '')))
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_answer_change_signal_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  e public.buklod_quiz_exams%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  v_behavior boolean;
begin
  if new.answer_change_count<=old.answer_change_count then return new; end if;
  if new.answer_change_count<10 or mod(new.answer_change_count,10)<>0 then return new; end if;
  select x.* into a from public.buklod_quiz_attempts x where x.id=new.attempt_id;
  if a.id is null or a.status<>'STARTED' then return new; end if;
  select x.* into e from public.buklod_quiz_exams x where x.id=a.exam_id;
  if a.live_session_id is not null then select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id; end if;
  v_behavior:=coalesce((a.security_snapshot->>'behavior_monitoring')::boolean,s.behavior_monitoring,e.behavior_monitoring,true);
  if v_behavior then
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(a.id,a.student_user_id,'EXCESSIVE_ANSWER_CHANGES',jsonb_build_object(
      'question_id',new.question_id,'answer_change_count',new.answer_change_count,'threshold_step',10
    ));
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION private.buklod_quiz_attempt_question_allowed_r1(p_attempt_id uuid, p_question_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN exists(SELECT 1 FROM public.buklod_quiz_attempt_questions v WHERE v.attempt_id=p_attempt_id)
 THEN exists(SELECT 1 FROM public.buklod_quiz_attempt_questions v WHERE v.attempt_id=p_attempt_id AND v.question_id=p_question_id)
 ELSE exists(SELECT 1 FROM public.buklod_quiz_questions q
 JOIN public.buklod_quiz_attempts a ON a.exam_id=q.exam_id
 WHERE a.id=p_attempt_id AND q.id=p_question_id AND q.is_active=true) END;
$function$;
CREATE OR REPLACE FUNCTION private.buklod_quiz_attempt_question_count_r1(p_attempt_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT CASE WHEN exists(SELECT 1 FROM public.buklod_quiz_attempt_questions v WHERE v.attempt_id=p_attempt_id)
 THEN (SELECT count(*)::integer FROM public.buklod_quiz_attempt_questions v WHERE v.attempt_id=p_attempt_id)
 ELSE (SELECT count(*)::integer FROM public.buklod_quiz_questions q
 JOIN public.buklod_quiz_attempts a ON a.exam_id=q.exam_id
 WHERE a.id=p_attempt_id AND q.is_active=true) END;
$function$;
CREATE OR REPLACE FUNCTION private.buklod_quiz_assign_attempt_questions_r1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 INSERT INTO public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points)
 SELECT new.id, z.id,z.ord,z.points,z.points FROM (
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
 SELECT sum(points) INTO v_max FROM public.buklod_quiz_attempt_questions
 WHERE attempt_id=new.id;
 UPDATE public.buklod_quiz_attempts SET max_score=v_max WHERE id=new.id;
 RETURN new;
END $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_add_roster_member_v1(p_exam_id uuid, p_section_id uuid, p_student_user_id uuid, p_student_no text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id and s.archived_at is null) then
    raise exception 'Selected class is deleted/archived or does not belong to this exam.';
  end if;

  select * into v_profile from public.profiles p where p.id=p_student_user_id and p.is_active=true;
  if v_profile.id is null then raise exception 'Student profile not found.'; end if;

  insert into public.buklod_quiz_roster(
    exam_id,section_id,student_user_id,student_no,surname,first_name,display_name,status,updated_at
  ) values (
    p_exam_id,p_section_id,p_student_user_id,nullif(trim(p_student_no),''),
    coalesce(v_profile.surname,''),coalesce(v_profile.first_name,''),
    coalesce(nullif(trim(v_profile.full_name),''),nullif(trim(concat_ws(' ',v_profile.first_name,v_profile.surname)),''),v_profile.username,v_profile.email,'BUKLOD User'),
    'ACTIVE',now()
  )
  on conflict(exam_id,student_user_id) do update set
    section_id=excluded.section_id,
    student_no=coalesce(excluded.student_no,public.buklod_quiz_roster.student_no),
    surname=excluded.surname,
    first_name=excluded.first_name,
    display_name=excluded.display_name,
    status='ACTIVE',
    updated_at=now();

  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_apply_security_preset_v1(p_exam_id uuid, p_preset text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_preset text := upper(btrim(coalesce(p_preset,'')));
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists(
    select 1 from public.buklod_quiz_exams e
    where e.id=p_exam_id and e.owner_user_id=v_actor
      and public.buklod_quiz_is_examiner(v_actor)
  ) then raise exception 'Exam not found or unauthorized.'; end if;

  if v_preset='STANDARD' then
    update public.buklod_quiz_exams set
      security_preset='STANDARD',device_policy='MONITOR',behavior_monitoring=true,
      offline_security_mode='SIGNED_LEASE',default_live_join_policy='OPEN',
      integrity_mode='STRICT',integrity_auto_submit=false,
      require_fullscreen_web=true,block_screen_capture=true,
      randomize_questions=true,randomize_choices=false,
      one_question_at_a_time=true,no_backtracking=false,updated_at=now()
    where id=p_exam_id;
  elsif v_preset='STRICT' then
    update public.buklod_quiz_exams set
      security_preset='STRICT',device_policy='LOCK',behavior_monitoring=true,
      offline_security_mode='SIGNED_LEASE',default_live_join_policy='ROSTER_ONLY',
      integrity_mode='STRICT',integrity_auto_submit=false,
      require_fullscreen_web=true,block_screen_capture=true,
      randomize_questions=true,randomize_choices=true,
      one_question_at_a_time=true,no_backtracking=false,updated_at=now()
    where id=p_exam_id;
  elsif v_preset='HIGH_STAKES' then
    update public.buklod_quiz_exams set
      security_preset='HIGH_STAKES',device_policy='LOCK',behavior_monitoring=true,
      offline_security_mode='SIGNED_LEASE',default_live_join_policy='ROSTER_APPROVAL',
      integrity_mode='STRICT',integrity_auto_submit=false,
      require_fullscreen_web=true,block_screen_capture=true,
      randomize_questions=true,randomize_choices=true,
      one_question_at_a_time=true,no_backtracking=true,updated_at=now()
    where id=p_exam_id;
  elsif v_preset='CUSTOM' then
    update public.buklod_quiz_exams set security_preset='CUSTOM',updated_at=now()
    where id=p_exam_id;
  else
    raise exception 'Unsupported security preset.';
  end if;

  perform public.buklod_quiz_audit_write_v1(
    p_exam_id,null,null,null,'SECURITY_PRESET_APPLIED',
    jsonb_build_object('preset',v_preset),v_actor
  );
  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v1(p_attempt_id uuid, p_reviews jsonb)
 RETURNS TABLE(status text, total_score numeric, max_score numeric, reviewed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid; v_status text; v_expected integer; v_item jsonb;
  v_response_id uuid; v_score numeric; v_points numeric; v_feedback text; v_seen integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;
  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Attempt not found or unauthorized.'; end if;
  if v_status not in ('NEEDS_REVIEW','GRADED') then raise exception 'Attempt is not ready for manual review.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id);
  select count(*)::int into v_expected
  from public.buklod_quiz_responses r
  where r.attempt_id=p_attempt_id and r.needs_review=true and r.manual_score is null;

  if v_expected=0 then
    perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
    return query select a.status,a.total_score,a.max_score,0 from public.buklod_quiz_attempts a where a.id=p_attempt_id;
    return;
  end if;
  if jsonb_array_length(p_reviews)<>v_expected then raise exception 'Approve All requires exactly % pending review item(s).',v_expected; end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_response_id:=nullif(v_item->>'response_id','')::uuid;
      v_score:=(v_item->>'score')::numeric;
    exception when others then raise exception 'Each review must contain a valid response_id and numeric score.'; end;
    v_feedback:=nullif(btrim(coalesce(v_item->>'feedback','')),'');

    select aq.points into v_points
    from public.buklod_quiz_responses r
    join public.buklod_quiz_attempt_questions aq
      on aq.attempt_id=r.attempt_id and aq.question_id=r.question_id
    where r.id=v_response_id and r.attempt_id=p_attempt_id
      and r.needs_review=true and r.manual_score is null;
    if v_points is null then raise exception 'Review response is stale or not part of this attempt.'; end if;
    if v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

    select count(*)::int into v_seen
    from jsonb_array_elements(p_reviews) x where x->>'response_id'=v_response_id::text;
    if v_seen<>1 then raise exception 'Duplicate or missing review response %.',v_response_id; end if;

    update public.buklod_quiz_responses
    set manual_score=v_score,feedback=v_feedback,reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=v_response_id and attempt_id=p_attempt_id and needs_review=true;
  end loop;

  if exists(select 1 from public.buklod_quiz_responses r where r.attempt_id=p_attempt_id and r.needs_review=true and r.manual_score is null) then
    raise exception 'Manual review is incomplete.';
  end if;
  perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return query select a.status,a.total_score,a.max_score,v_expected from public.buklod_quiz_attempts a where a.id=p_attempt_id;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_attempt_review_v2(p_attempt_id uuid, p_reviews jsonb)
 RETURNS TABLE(status text, total_score numeric, max_score numeric, reviewed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_status text;
  v_expected integer;
  v_item jsonb;
  v_response_id uuid;
  v_score numeric;
  v_points numeric;
  v_feedback text;
  v_seen integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;

  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;

  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Attempt not found or unauthorized.'; end if;
  if v_status<>'NEEDS_REVIEW' then raise exception 'Attempt is not pending manual review.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  select count(*)::int into v_expected
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true;

  if v_expected=0 then
    perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
    return query select a.status,a.total_score,a.max_score,0 from public.buklod_quiz_attempts a where a.id=p_attempt_id;
    return;
  end if;

  if jsonb_array_length(p_reviews)<>v_expected then
    raise exception 'Approve Student requires exactly % pending review item(s). Refresh Review and try again.',v_expected;
  end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_response_id:=nullif(v_item->>'response_id','')::uuid;
      v_score:=(v_item->>'score')::numeric;
    exception when others then
      raise exception 'Each review must contain a valid response_id and numeric score.';
    end;
    v_feedback:=nullif(btrim(coalesce(v_item->>'feedback','')),'');

    select q.points into v_points
    from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.id=v_response_id
      and r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true;

    if v_points is null then raise exception 'Review response is stale or not part of this attempt.'; end if;
    if v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

    select count(*)::int into v_seen
    from jsonb_array_elements(p_reviews) x
    where x->>'response_id'=v_response_id::text;
    if v_seen<>1 then raise exception 'Duplicate or missing review response %.',v_response_id; end if;

    update public.buklod_quiz_responses
    set manual_score=v_score,
        feedback=v_feedback,
        reviewed_by=(select auth.uid()),
        reviewed_at=now(),
        needs_review=false,
        updated_at=now()
    where id=v_response_id and attempt_id=p_attempt_id;
  end loop;

  if exists(
    select 1 from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.attempt_id=p_attempt_id
      and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
      and r.manual_score is null
      and coalesce(r.needs_review,false)=true
  ) then raise exception 'Manual review is incomplete.'; end if;

  perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  return query select a.status,a.total_score,a.max_score,v_expected from public.buklod_quiz_attempts a where a.id=p_attempt_id;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_approve_class_review_v1(p_exam_id uuid, p_section_id uuid, p_reviews jsonb)
 RETURNS TABLE(approved_attempts integer, reviewed_items integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid; v_expected integer; v_item jsonb; v_attempt_id uuid; v_response_id uuid;
  v_score numeric; v_feedback text; v_points numeric; v_seen integer;
  v_attempts integer:=0; v_items integer:=0; v_pending_attempt uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_exams e where e.id=p_exam_id;
  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Exam not found or unauthorized.'; end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id) then raise exception 'Class / section not found for this exam.'; end if;
  if p_reviews is null or jsonb_typeof(p_reviews)<>'array' then raise exception 'p_reviews must be a JSON array.'; end if;

  select count(*)::int into v_expected
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status='NEEDS_REVIEW'
    and r.needs_review=true and r.manual_score is null;
  if v_expected=0 then return query select 0,0; return; end if;
  if jsonb_array_length(p_reviews)<>v_expected then raise exception 'Approve All Pending requires exactly % review item(s). Refresh Review and try again.',v_expected; end if;

  for v_item in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_attempt_id:=nullif(v_item->>'attempt_id','')::uuid;
      v_response_id:=nullif(v_item->>'response_id','')::uuid;
      v_score:=(v_item->>'score')::numeric;
    exception when others then raise exception 'Each review must contain valid attempt_id, response_id, and numeric score.'; end;
    v_feedback:=nullif(btrim(coalesce(v_item->>'feedback','')),'');

    perform public.buklod_quiz_seed_attempt_questions_v1(v_attempt_id);
    select aq.points into v_points
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_responses r on r.attempt_id=a.id
    join public.buklod_quiz_attempt_questions aq on aq.attempt_id=a.id and aq.question_id=r.question_id
    where a.id=v_attempt_id and a.exam_id=p_exam_id and a.section_id=p_section_id
      and a.status='NEEDS_REVIEW' and r.id=v_response_id and r.needs_review=true and r.manual_score is null;
    if v_points is null then raise exception 'A review item is stale, already approved, or not part of this class. Refresh Review and try again.'; end if;
    if v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

    select count(*)::int into v_seen from jsonb_array_elements(p_reviews)x where x->>'response_id'=v_response_id::text;
    if v_seen<>1 then raise exception 'Duplicate or missing review response %.',v_response_id; end if;

    update public.buklod_quiz_responses
    set manual_score=v_score,feedback=v_feedback,reviewed_by=(select auth.uid()),reviewed_at=now()
    where id=v_response_id and attempt_id=v_attempt_id and needs_review=true;
    v_items:=v_items+1;
  end loop;

  if exists(
    select 1 from public.buklod_quiz_attempts a join public.buklod_quiz_responses r on r.attempt_id=a.id
    where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status='NEEDS_REVIEW'
      and r.needs_review=true and r.manual_score is null
  ) then raise exception 'Manual review is incomplete. Every pending item needs a score.'; end if;

  for v_pending_attempt in
    select distinct a.id
    from public.buklod_quiz_attempts a join public.buklod_quiz_responses r on r.attempt_id=a.id
    where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status='NEEDS_REVIEW' and r.needs_review=true
    order by a.id
  loop
    perform public.buklod_quiz_compute_attempt_internal(v_pending_attempt);
    v_attempts:=v_attempts+1;
  end loop;
  return query select v_attempts,v_items;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_archive_exam_v1(p_exam_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists(
    select 1 from public.buklod_quiz_live_sessions s join public.buklod_quiz_exams e on e.id=s.exam_id
    where s.exam_id=p_exam_id and s.status in ('LIVE','PAUSED') and e.owner_user_id=(select auth.uid())
  ) then raise exception 'End the active live session before archiving this exam.'; end if;
  update public.buklod_quiz_exams e
  set archived_at=now(),archived_by=(select auth.uid()),status='DRAFT',updated_at=now()
  where e.id=p_exam_id and e.owner_user_id=(select auth.uid());
  if not found then raise exception 'Exam not found or unauthorized.'; end if;
  update public.buklod_quiz_live_sessions s set status='ENDED',ended_at=coalesce(s.ended_at,now()),updated_at=now()
  where s.exam_id=p_exam_id and s.status='WAITING';
  insert into public.buklod_quiz_faculty_actions(actor_user_id,exam_id,action)
  values((select auth.uid()),p_exam_id,'EXAM_ARCHIVED');
  return true;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_final_score_guard_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_exam_total numeric;
begin
  if new.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    select e.total_points into v_exam_total
    from public.buklod_quiz_exams e
    where e.id = new.exam_id;

    IF EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=new.id) THEN
      SELECT sum(x.points) INTO v_exam_total
      FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=new.id;
    END IF;
    if v_exam_total is not null then
      new.max_score := v_exam_total;
    end if;
  end if;
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_bootstrap_v1(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  v_questions jsonb;
  v_answers jsonb;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id
    and x.student_user_id=(select auth.uid())
    and x.status='STARTED';

  if a.id is null then
    raise exception 'Active exam attempt not found.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.display_order), '[]'::jsonb)
  into v_questions
  from public.buklod_quiz_student_questions_v1(p_attempt_id) q;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  into v_answers
  from public.buklod_quiz_saved_answers_v1(p_attempt_id) s;

  return jsonb_build_object(
    'attempt_id',a.id,
    'expires_at',a.expires_at,
    'questions',v_questions,
    'saved_answers',v_answers
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, display_name text, attempt_status text, total_questions integer, answered_count integer, unanswered_count integer, correct_count integer, incorrect_count integer, partial_credit_count integer, manual_pending_count integer, earned_score numeric, max_score numeric, score_percent numeric, question_type_breakdown jsonb, cheating_risk_pct integer, cheating_risk_level text, leakage_risk_pct integer, leakage_risk_level text, confidence_pct integer, integrity_incident_count integer, strong_signal_count integer, performance_summary text, integrity_summary text, analysis_notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id);

  return query
  with target as(
    select a.*,
      coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),'BUKLOD Student')::text as student_name
    from public.buklod_quiz_attempts a where a.id=p_attempt_id
  ), per_question as(
    select q.question_type,aq.points,rr.answer,rr.objective_score,rr.manual_score,rr.is_correct,
      coalesce(rr.manual_score,rr.objective_score,0)::numeric as awarded,
      (coalesce(rr.needs_review,false) and rr.manual_score is null) as manual_pending,
      (rr.answer is not null and nullif(trim(case when jsonb_typeof(rr.answer)='string' then rr.answer#>>'{}' else rr.answer::text end),'') is not null) as answered
    from target t
    join public.buklod_quiz_attempt_questions aq on aq.attempt_id=t.id
    join public.buklod_quiz_questions q on q.id=aq.question_id
    left join public.buklod_quiz_responses rr on rr.attempt_id=t.id and rr.question_id=q.id
  ), totals as(
    select count(*)::int total_questions,
      count(*) filter(where answered)::int answered_count,
      count(*) filter(where not answered)::int unanswered_count,
      count(*) filter(where is_correct is true)::int correct_count,
      count(*) filter(where is_correct is false)::int incorrect_count,
      count(*) filter(where awarded>0 and awarded<points)::int partial_credit_count,
      count(*) filter(where manual_pending)::int manual_pending_count,
      coalesce(sum(awarded),0)::numeric earned_score,coalesce(sum(points),0)::numeric max_score
    from per_question
  ), by_type as(
    select coalesce(jsonb_object_agg(question_type,obj),'{}'::jsonb) breakdown
    from(
      select question_type,jsonb_build_object(
        'questions',count(*),'answered',count(*) filter(where answered),
        'correct',count(*) filter(where is_correct is true),
        'incorrect',count(*) filter(where is_correct is false),
        'manual_pending',count(*) filter(where manual_pending),
        'earned',coalesce(sum(awarded),0),'possible',coalesce(sum(points),0)
      ) obj
      from per_question group by question_type
    ) x
  ), integrity as(select * from public.buklod_quiz_integrity_metrics_v1(p_attempt_id))
  select t.id,t.student_name,t.status::text,z.total_questions,z.answered_count,z.unanswered_count,
    z.correct_count,z.incorrect_count,z.partial_credit_count,z.manual_pending_count,
    z.earned_score,z.max_score,
    case when z.max_score>0 then public.buklod_quiz_transmuted_percent_v1(z.earned_score,z.max_score) else null end,
    b.breakdown,i.cheating_risk_pct,
    case when i.cheating_risk_pct>=75 then 'CRITICAL' when i.cheating_risk_pct>=50 then 'HIGH' when i.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.leakage_risk_pct,
    case when i.leakage_risk_pct>=75 then 'CRITICAL' when i.leakage_risk_pct>=50 then 'HIGH' when i.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
    i.confidence_pct,
    (i.departure_incidents+i.copy_attempts+i.screen_capture_signals+i.devtools_attempts+i.context_menu_attempts)::int,
    (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)::int,
    case
      when z.manual_pending_count>0 then format('%s faculty-review item(s) still need scoring before release.',z.manual_pending_count)
      when z.unanswered_count>0 then format('%s of %s questions were answered; %s were unanswered. Current score is %s/%s.',z.answered_count,z.total_questions,z.unanswered_count,z.earned_score,z.max_score)
      else format('All %s questions were answered. Current score is %s/%s.',z.total_questions,z.earned_score,z.max_score)
    end::text,
    case
      when i.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
      when (i.copy_attempts+i.screen_capture_signals+i.devtools_attempts)=0 then 'Focus-loss or exam-away behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Review the timeline before making an academic decision.'
      else 'One or more stronger integrity signals were recorded. Review the exact timeline and the student answers before making an academic decision.'
    end::text,
    'Faculty analysis is decision support only. Integrity risk is not proof of cheating, and release remains a manual faculty decision.'::text
  from target t cross join totals z cross join by_type b cross join integrity i;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_heartbeat_v1(p_attempt_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
    from public.buklod_quiz_attempts a
    where a.id=p_attempt_id
      and a.student_user_id=(select auth.uid())
      and a.status='STARTED'
  );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_attempt_change_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.status is distinct from new.status then
    perform public.buklod_quiz_audit_write_v1(
      new.exam_id,new.section_id,new.live_session_id,new.id,'ATTEMPT_STATUS_CHANGED',
      jsonb_build_object('old_status',old.status,'new_status',new.status,'attempt_no',new.attempt_no),
      (select auth.uid())
    );
  end if;
  if old.released_at is distinct from new.released_at and new.released_at is not null then
    perform public.buklod_quiz_audit_write_v1(
      new.exam_id,new.section_id,new.live_session_id,new.id,'RESULT_RELEASED',
      jsonb_build_object('released_at',new.released_at),
      (select auth.uid())
    );
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  return query
  select a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    coalesce(a.integrity_violation_count,0)::integer,
    q.id,row_number() over(order by q.sort_order,q.id)::integer,q.question_type::text,q.prompt::text,q.options,
    case when rr.answer is null then '' when jsonb_typeof(rr.answer)='string' then rr.answer #>> '{}' else rr.answer::text end::text,
    case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer #>> '{}' else q.correct_answer::text end::text,
    q.points,rr.objective_score,rr.manual_score,coalesce(rr.manual_score,rr.objective_score,0)::numeric,rr.is_correct,
    coalesce(rr.needs_review,false),rr.feedback::text,q.explanation::text,q.source_pages::text
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_questions q on q.exam_id=a.exam_id and q.is_active=true
  left join public.buklod_quiz_responses rr on rr.attempt_id=a.id and rr.question_id=q.id
  left join public.buklod_quiz_roster rst on rst.exam_id=a.exam_id and rst.section_id=a.section_id and rst.student_user_id=a.student_user_id
  where a.id=p_attempt_id
  order by q.sort_order,q.id;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_full_review_v2(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, display_name text, attempt_no integer, attempt_status text, started_at timestamp with time zone, submitted_at timestamp with time zone, released_at timestamp with time zone, total_score numeric, max_score numeric, integrity_violation_count integer, response_id uuid, question_id uuid, question_no integer, question_type text, prompt text, options jsonb, answer_text text, correct_answer_text text, points numeric, objective_score numeric, manual_score numeric, awarded_score numeric, is_correct boolean, needs_review boolean, feedback text, explanation text, source_pages text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid()); v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id into v_owner
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id);

  return query
  select a.id,a.exam_id,e.title::text,a.section_id,s.name::text,a.student_user_id,
    coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id),nullif(rst.display_name,''),'BUKLOD Student')::text,
    a.attempt_no,a.status::text,a.started_at,a.submitted_at,a.released_at,a.total_score,a.max_score,
    coalesce(a.integrity_violation_count,0)::integer,rr.id,q.id,aq.display_order,q.question_type::text,q.prompt::text,q.options,
    case when rr.answer is null then '' when jsonb_typeof(rr.answer)='string' then rr.answer#>>'{}' else rr.answer::text end::text,
    case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer#>>'{}' else q.correct_answer::text end::text,
    aq.points,rr.objective_score,rr.manual_score,coalesce(rr.manual_score,rr.objective_score,0)::numeric,
    rr.is_correct,coalesce(rr.needs_review,false),rr.feedback::text,q.explanation::text,q.source_pages::text
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_attempt_questions aq on aq.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=aq.question_id
  left join public.buklod_quiz_responses rr on rr.attempt_id=a.id and rr.question_id=q.id
  left join public.buklod_quiz_roster rst on rst.exam_id=a.exam_id and rst.section_id=a.section_id and rst.student_user_id=a.student_user_id
  where a.id=p_attempt_id
  order by aq.display_order;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_integrity_analysis_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, display_name text, cheating_risk_pct integer, cheating_risk_level text, leakage_risk_pct integer, leakage_risk_level text, confidence_pct integer, incident_count integer, strong_signal_count integer, trace_code text, external_camera_direct_detection boolean, external_capture_trace_ready boolean, summary text, evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with target as (
  select a.*,e.owner_user_id,
         coalesce(nullif(r.display_name,''),nullif(concat_ws(', ',nullif(r.surname,''),nullif(r.first_name,'')),''),'BUKLOD Student')::text as display_name
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  left join public.buklod_quiz_roster r
    on r.exam_id=a.exam_id and r.section_id=a.section_id and r.student_user_id=a.student_user_id
  where a.id=p_attempt_id
    and (
      a.student_user_id=(select auth.uid())
      or (e.owner_user_id=(select auth.uid()) and public.buklod_quiz_is_examiner((select auth.uid())))
    )
  limit 1
)
select
  t.id,t.student_user_id,t.display_name,
  m.cheating_risk_pct,
  case when m.cheating_risk_pct>=75 then 'CRITICAL' when m.cheating_risk_pct>=50 then 'HIGH' when m.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
  m.leakage_risk_pct,
  case when m.leakage_risk_pct>=75 then 'CRITICAL' when m.leakage_risk_pct>=50 then 'HIGH' when m.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
  m.confidence_pct,
  m.departure_incidents + m.copy_attempts + m.screen_capture_signals + m.devtools_attempts + m.context_menu_attempts,
  m.copy_attempts + m.screen_capture_signals + m.devtools_attempts,
  t.external_capture_trace_code,
  false,
  t.external_capture_trace_code is not null,
  case
    when m.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
    when (m.copy_attempts+m.screen_capture_signals+m.devtools_attempts)=0 then 'Repeated exam-away or focus-loss behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Faculty review is recommended; this is not proof of cheating.'
    else 'One or more stronger integrity signals were recorded in addition to sequence behavior. Review the exact timeline and other evidence before making any academic decision.'
  end,
  m.evidence || jsonb_build_object('trace_code',t.external_capture_trace_code)
from target t
cross join lateral public.buklod_quiz_integrity_metrics_v1(t.id) m
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_integrity_policy_v1(p_attempt_id uuid)
 RETURNS TABLE(integrity_mode text, integrity_violation_limit integer, integrity_auto_submit boolean, require_fullscreen_web boolean, block_screen_capture boolean, integrity_violation_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    e.integrity_mode,e.integrity_violation_limit,e.integrity_auto_submit,
    e.require_fullscreen_web,e.block_screen_capture,
    private.buklod_quiz_canonical_integrity_count_v1(a.id)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_sections sx on sx.id=a.section_id and sx.archived_at is null
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id
    and a.student_user_id=(select auth.uid())
    and a.status='STARTED'
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_trace_fill_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.external_capture_trace_code is null or btrim(new.external_capture_trace_code) = '' then
    new.external_capture_trace_code := upper(substr(md5(new.id::text || ':' || new.student_user_id::text || ':' || clock_timestamp()::text || ':' || random()::text),1,12));
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_attempt_trace_v1(p_attempt_id uuid, p_question_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(attempt_id uuid, display_name text, trace_code text, question_fingerprint text, watermark_text text, server_time timestamp with time zone, external_camera_direct_detection boolean, external_capture_mode text, trace_notice text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select
  a.id,
  coalesce(nullif(r.display_name,''),nullif(concat_ws(', ',nullif(r.surname,''),nullif(r.first_name,'')),''),'BUKLOD Student')::text,
  a.external_capture_trace_code,
  case when p_question_id is null then null
       else upper(substr(md5(a.id::text || ':' || p_question_id::text || ':' || a.external_capture_trace_code),1,10)) end,
  (coalesce(nullif(r.display_name,''),'BUKLOD Student') || ' • BUKLOD ' || a.external_capture_trace_code)::text,
  now(),
  false,
  'TRACE_WATERMARK'::text,
  'Another phone/camera cannot be directly detected reliably. This trace watermark and question fingerprint are designed to identify the source if a photographed exam image is later found.'::text
from public.buklod_quiz_attempts a
join public.buklod_quiz_exams e on e.id=a.exam_id
left join public.buklod_quiz_roster r
  on r.exam_id=a.exam_id and r.section_id=a.section_id and r.student_user_id=a.student_user_id
where a.id=p_attempt_id
  and (
    a.student_user_id=(select auth.uid())
    or (e.owner_user_id=(select auth.uid()) and public.buklod_quiz_is_examiner((select auth.uid())))
  )
  and (p_question_id is null or exists(
    select 1 from public.buklod_quiz_questions q where q.id=p_question_id and q.exam_id=a.exam_id and q.is_active=true
  ))
limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_manual_review_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
begin
  if old.manual_score is distinct from new.manual_score or old.feedback is distinct from new.feedback then
    select x.* into a from public.buklod_quiz_attempts x where x.id=new.attempt_id;
    perform public.buklod_quiz_audit_write_v1(
      a.exam_id,a.section_id,a.live_session_id,a.id,'MANUAL_REVIEW_UPDATED',
      jsonb_build_object('response_id',new.id,'question_id',new.question_id,'manual_score',new.manual_score),
      (select auth.uid())
    );
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_deduction_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_attempt uuid; a public.buklod_quiz_attempts%rowtype; v_type text; v_old numeric; v_new numeric;
begin
  if tg_op='DELETE' then v_attempt:=old.attempt_id; v_type:=old.event_type; v_old:=old.deduction_points; v_new:=null;
  elsif tg_op='INSERT' then v_attempt:=new.attempt_id; v_type:=new.event_type; v_old:=null; v_new:=new.deduction_points;
  else v_attempt:=new.attempt_id; v_type:=new.event_type; v_old:=old.deduction_points; v_new:=new.deduction_points; end if;
  select x.* into a from public.buklod_quiz_attempts x where x.id=v_attempt;
  perform public.buklod_quiz_audit_write_v1(
    a.exam_id,a.section_id,a.live_session_id,a.id,
    case tg_op when 'INSERT' then 'INTEGRITY_DEDUCTION_ADDED' when 'UPDATE' then 'INTEGRITY_DEDUCTION_UPDATED' else 'INTEGRITY_DEDUCTION_REMOVED' end,
    jsonb_build_object('event_type',v_type,'old_points',v_old,'new_points',v_new),(select auth.uid())
  );
  if tg_op='DELETE' then return old; else return new; end if;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_exam_change_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.title is not distinct from new.title
     and old.duration_minutes is not distinct from new.duration_minutes
     and old.max_attempts is not distinct from new.max_attempts
     and old.status is not distinct from new.status
     and old.randomize_questions is not distinct from new.randomize_questions
     and old.randomize_choices is not distinct from new.randomize_choices
     and old.one_question_at_a_time is not distinct from new.one_question_at_a_time
     and old.no_backtracking is not distinct from new.no_backtracking
     and old.integrity_mode is not distinct from new.integrity_mode
     and old.require_fullscreen_web is not distinct from new.require_fullscreen_web
     and old.block_screen_capture is not distinct from new.block_screen_capture
     and old.security_preset is not distinct from new.security_preset
     and old.device_policy is not distinct from new.device_policy
     and old.behavior_monitoring is not distinct from new.behavior_monitoring
     and old.offline_security_mode is not distinct from new.offline_security_mode
     and old.default_live_join_policy is not distinct from new.default_live_join_policy then
    return new;
  end if;

  if new.owner_user_id=(select auth.uid()) then
    perform public.buklod_quiz_audit_write_v1(
      new.id,null,null,null,'EXAM_CONFIG_CHANGED',
      jsonb_build_object(
        'title',new.title,'duration_minutes',new.duration_minutes,'max_attempts',new.max_attempts,'status',new.status,
        'randomize_questions',new.randomize_questions,'randomize_choices',new.randomize_choices,
        'one_question_at_a_time',new.one_question_at_a_time,'no_backtracking',new.no_backtracking,
        'integrity_mode',new.integrity_mode,'require_fullscreen_web',new.require_fullscreen_web,
        'block_screen_capture',new.block_screen_capture,'security_preset',new.security_preset,'device_policy',new.device_policy,
        'behavior_monitoring',new.behavior_monitoring,'offline_security_mode',new.offline_security_mode,
        'default_live_join_policy',new.default_live_join_policy
      ),(select auth.uid())
    );
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_integrity_rule_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid;
  v_type text;
  v_enabled boolean;
  v_points numeric;
begin
  if tg_op='DELETE' then
    v_actor:=old.owner_user_id; v_type:=old.event_type; v_enabled:=false; v_points:=old.points_per_occurrence;
  else
    v_actor:=new.owner_user_id; v_type:=new.event_type; v_enabled:=new.is_enabled; v_points:=new.points_per_occurrence;
  end if;

  insert into public.buklod_quiz_audit_log(
    exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details
  ) values(
    null,null,null,null,v_actor,
    case tg_op when 'INSERT' then 'INTEGRITY_RULE_CREATED' when 'UPDATE' then 'INTEGRITY_RULE_CHANGED' else 'INTEGRITY_RULE_REMOVED' end,
    jsonb_build_object('event_type',v_type,'enabled',v_enabled,'points_per_occurrence',v_points)
  );

  if tg_op='DELETE' then return old; else return new; end if;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_live_change_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if old.status is distinct from new.status then
    perform public.buklod_quiz_audit_write_v1(
      new.exam_id,new.section_id,new.id,null,'LIVE_STATUS_CHANGED',
      jsonb_build_object('old_status',old.status,'new_status',new.status),
      (select auth.uid())
    );
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_question_change_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_exam uuid;
  v_q uuid;
  v_action text;
  v_details jsonb;
begin
  if tg_op='INSERT' then
    v_exam:=new.exam_id; v_q:=new.id; v_action:='QUESTION_CREATED';
    v_details:=jsonb_build_object('question_id',new.id,'question_type',new.question_type,'sort_order',new.sort_order,'points',new.points);
  elsif tg_op='DELETE' then
    v_exam:=old.exam_id; v_q:=old.id; v_action:='QUESTION_DELETED';
    v_details:=jsonb_build_object('question_id',old.id,'question_type',old.question_type,'sort_order',old.sort_order,'points',old.points);
  else
    if old.prompt is not distinct from new.prompt
       and old.options is not distinct from new.options
       and old.correct_answer is not distinct from new.correct_answer
       and old.points is not distinct from new.points
       and old.sort_order is not distinct from new.sort_order
       and old.is_active is not distinct from new.is_active
       and old.question_type is not distinct from new.question_type
       and old.rubric is not distinct from new.rubric
       and old.explanation is not distinct from new.explanation then
      return new;
    end if;
    v_exam:=new.exam_id; v_q:=new.id; v_action:='QUESTION_EDITED';
    v_details:=jsonb_build_object(
      'question_id',new.id,'question_type',new.question_type,'sort_order',new.sort_order,'points',new.points,'is_active',new.is_active,
      'active_live_snapshot_unchanged',exists(
        select 1 from public.buklod_quiz_live_question_snapshots qs
        join public.buklod_quiz_live_sessions ls on ls.id=qs.session_id
        where qs.question_id=new.id and ls.status<>'ENDED'
      )
    );
  end if;

  if exists(select 1 from public.buklod_quiz_exams e where e.id=v_exam and e.owner_user_id=(select auth.uid())) then
    perform public.buklod_quiz_audit_write_v1(v_exam,null,null,null,v_action,v_details,(select auth.uid()));
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_audit_write_v1(p_exam_id uuid, p_section_id uuid, p_live_session_id uuid, p_attempt_id uuid, p_action text, p_details jsonb DEFAULT '{}'::jsonb, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.buklod_quiz_audit_log(
    exam_id,section_id,live_session_id,attempt_id,actor_user_id,action,details
  ) values(
    p_exam_id,p_section_id,p_live_session_id,p_attempt_id,
    coalesce(p_actor,(select auth.uid())),
    upper(btrim(coalesce(p_action,'AUDIT'))),
    coalesce(p_details,'{}'::jsonb)
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v1(p_exam_id uuid, p_section_id uuid, p_attempt_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(saved_count integer, total_deduction numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  v_saved integer:=0;
  v_total numeric:=0;
  v_attempt uuid;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists(
    select 1 from public.buklod_quiz_exams e
    join public.buklod_quiz_sections sx on sx.exam_id=e.id and sx.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=v_actor and public.buklod_quiz_is_examiner(v_actor)
  ) then raise exception 'Class not found or unauthorized.'; end if;

  with latest as (
    select distinct on (a.student_user_id) a.id,a.student_user_id,a.status
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id and r.section_id=a.section_id and r.student_user_id=a.student_user_id and r.status='ACTIVE'
    where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  ), grouped as (
    select l.id as attempt_id,i.event_type,i.event_count::numeric
    from latest l
    cross join lateral public.buklod_quiz_integrity_incident_rows_v1(l.id) i
    where l.status in ('NEEDS_REVIEW','GRADED') and (p_attempt_id is null or l.id=p_attempt_id)
  ), applied as (
    insert into public.buklod_quiz_integrity_deductions(attempt_id,event_type,deduction_points,note,applied_by,created_at,updated_at)
    select
      g.attempt_id,g.event_type,greatest(0,r.points_per_occurrence*g.event_count),
      coalesce(nullif(r.note_template,''),
        'Auto-set: '||trim(to_char(r.points_per_occurrence,'FM999999990.##'))||
        ' point(s) per incident x '||trim(to_char(g.event_count,'FM999999990'))),
      v_actor,now(),now()
    from grouped g
    join public.buklod_quiz_integrity_deduction_rules r
      on r.owner_user_id=v_actor and r.event_type=g.event_type and r.is_enabled=true
    where r.points_per_occurrence>=0
    on conflict(attempt_id,event_type) do update set
      deduction_points=excluded.deduction_points,note=excluded.note,applied_by=excluded.applied_by,updated_at=now()
    returning attempt_id
  )
  select count(*)::integer into v_saved from applied;

  delete from public.buklod_quiz_integrity_deductions d
  using public.buklod_quiz_attempts a
  where d.attempt_id=a.id
    and d.event_type='APP_EXIT_OR_BACKGROUND'
    and a.exam_id=p_exam_id and a.section_id=p_section_id
    and a.status in ('NEEDS_REVIEW','GRADED')
    and (p_attempt_id is null or a.id=p_attempt_id);

  for v_attempt in
    select distinct a.id
    from public.buklod_quiz_attempts a
    where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status in ('NEEDS_REVIEW','GRADED')
      and (p_attempt_id is null or a.id=p_attempt_id)
      and exists(select 1 from public.buklod_quiz_integrity_deductions d where d.attempt_id=a.id)
  loop
    perform public.buklod_quiz_compute_attempt_internal(v_attempt);
  end loop;

  select coalesce(sum(d.deduction_points),0) into v_total
  from public.buklod_quiz_integrity_deductions d
  join public.buklod_quiz_attempts a on a.id=d.attempt_id
  where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status in ('NEEDS_REVIEW','GRADED');

  return query select v_saved,v_total;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v2(p_exam_id uuid, p_section_id uuid, p_attempt_id uuid DEFAULT NULL::uuid, p_include_released boolean DEFAULT false)
 RETURNS TABLE(saved_count integer, total_deduction numeric, matched_event_count integer, affected_attempts integer, released_affected integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_saved integer := 0;
  v_total numeric := 0;
  v_matched_events integer := 0;
  v_affected integer := 0;
  v_released integer := 0;
  v_attempt uuid;
  v_status text;
  v_deduction numeric;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if not exists(
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections sx
      on sx.exam_id=e.id
     and sx.id=p_section_id
    where e.id=p_exam_id
      and e.owner_user_id=v_actor
      and public.buklod_quiz_is_examiner(v_actor)
  ) then
    raise exception 'Class not found or unauthorized.';
  end if;

  create temporary table if not exists pg_temp.buklod_integrity_autoset_targets(
    attempt_id uuid,
    attempt_status text,
    event_type text,
    event_count numeric,
    deduction_points numeric,
    note text
  ) on commit drop;
  truncate pg_temp.buklod_integrity_autoset_targets;

  insert into pg_temp.buklod_integrity_autoset_targets(
    attempt_id,attempt_status,event_type,event_count,deduction_points,note
  )
  with latest as (
    select distinct on (a.student_user_id)
      a.id,
      a.student_user_id,
      a.status
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id
     and r.section_id=a.section_id
     and r.student_user_id=a.student_user_id
     and r.status='ACTIVE'
    where a.exam_id=p_exam_id
      and a.section_id=p_section_id
      and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  ), grouped as (
    select
      ev.attempt_id,
      l.status as attempt_status,
      ev.event_type,
      count(*)::numeric as event_count
    from public.buklod_quiz_events ev
    join latest l on l.id=ev.attempt_id
    where (p_attempt_id is null or ev.attempt_id=p_attempt_id)
      and (
        l.status in ('NEEDS_REVIEW','GRADED')
        or (p_include_released and l.status='RELEASED')
      )
      and ev.event_type in (
        'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
        'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
      )
    group by ev.attempt_id,l.status,ev.event_type
  )
  select
    g.attempt_id,
    g.attempt_status,
    g.event_type,
    g.event_count,
    greatest(0,r.points_per_occurrence*g.event_count),
    coalesce(
      nullif(r.note_template,''),
      'Auto-set: ' || trim(to_char(r.points_per_occurrence,'FM999999990.##')) ||
      ' point(s) per occurrence x ' || trim(to_char(g.event_count,'FM999999990'))
    )
  from grouped g
  join public.buklod_quiz_integrity_deduction_rules r
    on r.owner_user_id=v_actor
   and r.event_type=g.event_type
   and r.is_enabled=true
   and r.points_per_occurrence>0;

  select
    coalesce(sum(event_count),0)::integer,
    count(distinct attempt_id)::integer,
    count(distinct attempt_id) filter (where attempt_status='RELEASED')::integer
  into v_matched_events,v_affected,v_released
  from pg_temp.buklod_integrity_autoset_targets;

  if v_affected=0 then
    return query select 0,0::numeric,0,0,0;
    return;
  end if;

  insert into public.buklod_quiz_integrity_deductions(
    attempt_id,event_type,deduction_points,note,applied_by,created_at,updated_at
  )
  select
    t.attempt_id,
    t.event_type,
    t.deduction_points,
    t.note,
    v_actor,
    now(),
    now()
  from pg_temp.buklod_integrity_autoset_targets t
  on conflict(attempt_id,event_type)
  do update set
    deduction_points=excluded.deduction_points,
    note=excluded.note,
    applied_by=excluded.applied_by,
    updated_at=now();

  get diagnostics v_saved = row_count;

  for v_attempt,v_status in
    select distinct attempt_id,attempt_status
    from pg_temp.buklod_integrity_autoset_targets
  loop
    if v_status in ('NEEDS_REVIEW','GRADED') then
      perform public.buklod_quiz_compute_attempt_internal(v_attempt);
    elsif v_status='RELEASED' then
      select coalesce(sum(d.deduction_points),0)
        into v_deduction
      from public.buklod_quiz_integrity_deductions d
      where d.attempt_id=v_attempt;

      update public.buklod_quiz_attempts a
         set total_score = greatest(
               0,
               coalesce(a.objective_score,0) + coalesce(a.manual_score,0) - v_deduction
             ),
             updated_at = now()
       where a.id=v_attempt
         and a.status='RELEASED';
    end if;
  end loop;

  select coalesce(sum(d.deduction_points),0)
    into v_total
  from public.buklod_quiz_integrity_deductions d
  join (
    select distinct attempt_id
    from pg_temp.buklod_integrity_autoset_targets
  ) t on t.attempt_id=d.attempt_id;

  return query
  select v_saved,coalesce(v_total,0),v_matched_events,v_affected,v_released;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v3(p_exam_id uuid, p_section_id uuid, p_attempt_id uuid DEFAULT NULL::uuid, p_scope text DEFAULT 'REVIEWABLE'::text)
 RETURNS TABLE(saved_count integer, total_deduction numeric, matched_event_count integer, affected_attempts integer, released_affected integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_scope text := upper(btrim(coalesce(p_scope,'REVIEWABLE')));
  v_saved integer := 0;
  v_total numeric := 0;
  v_matched_events integer := 0;
  v_affected integer := 0;
  v_released integer := 0;
  v_attempt uuid;
  v_status text;
  v_deduction numeric;
begin
  if v_actor is null then
    raise exception 'Authentication required.';
  end if;

  if v_scope not in ('REVIEWABLE','RELEASED') then
    raise exception 'Unsupported Auto Set scope.';
  end if;

  if not exists(
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections sx
      on sx.exam_id=e.id
     and sx.id=p_section_id
    where e.id=p_exam_id
      and e.owner_user_id=v_actor
      and public.buklod_quiz_is_examiner(v_actor)
  ) then
    raise exception 'Class not found or unauthorized.';
  end if;

  create temporary table if not exists pg_temp.buklod_integrity_autoset_targets_v3(
    attempt_id uuid,
    attempt_status text,
    event_type text,
    event_count numeric,
    deduction_points numeric,
    note text
  ) on commit drop;
  truncate pg_temp.buklod_integrity_autoset_targets_v3;

  insert into pg_temp.buklod_integrity_autoset_targets_v3(
    attempt_id,attempt_status,event_type,event_count,deduction_points,note
  )
  with latest as (
    select distinct on (a.student_user_id)
      a.id,
      a.student_user_id,
      a.status
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id
     and r.section_id=a.section_id
     and r.student_user_id=a.student_user_id
     and r.status='ACTIVE'
    where a.exam_id=p_exam_id
      and a.section_id=p_section_id
      and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  ), grouped as (
    select
      ev.attempt_id,
      l.status as attempt_status,
      ev.event_type,
      count(*)::numeric as event_count
    from public.buklod_quiz_events ev
    join latest l on l.id=ev.attempt_id
    where (p_attempt_id is null or ev.attempt_id=p_attempt_id)
      and (
        (v_scope='REVIEWABLE' and l.status in ('NEEDS_REVIEW','GRADED'))
        or (v_scope='RELEASED' and l.status='RELEASED')
      )
      and ev.event_type in (
        'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
        'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
      )
    group by ev.attempt_id,l.status,ev.event_type
  )
  select
    g.attempt_id,
    g.attempt_status,
    g.event_type,
    g.event_count,
    greatest(0,r.points_per_occurrence*g.event_count),
    coalesce(
      nullif(r.note_template,''),
      'Auto-set: ' || trim(to_char(r.points_per_occurrence,'FM999999990.##')) ||
      ' point(s) per occurrence x ' || trim(to_char(g.event_count,'FM999999990'))
    )
  from grouped g
  join public.buklod_quiz_integrity_deduction_rules r
    on r.owner_user_id=v_actor
   and r.event_type=g.event_type
   and r.is_enabled=true
   and r.points_per_occurrence>0;

  select
    coalesce(sum(event_count),0)::integer,
    count(distinct attempt_id)::integer,
    count(distinct attempt_id) filter (where attempt_status='RELEASED')::integer
  into v_matched_events,v_affected,v_released
  from pg_temp.buklod_integrity_autoset_targets_v3;

  if v_affected=0 then
    return query select 0,0::numeric,0,0,0;
    return;
  end if;

  insert into public.buklod_quiz_integrity_deductions(
    attempt_id,event_type,deduction_points,note,applied_by,created_at,updated_at
  )
  select
    t.attempt_id,
    t.event_type,
    t.deduction_points,
    t.note,
    v_actor,
    now(),
    now()
  from pg_temp.buklod_integrity_autoset_targets_v3 t
  on conflict(attempt_id,event_type)
  do update set
    deduction_points=excluded.deduction_points,
    note=excluded.note,
    applied_by=excluded.applied_by,
    updated_at=now();

  get diagnostics v_saved = row_count;

  for v_attempt,v_status in
    select distinct attempt_id,attempt_status
    from pg_temp.buklod_integrity_autoset_targets_v3
  loop
    if v_status in ('NEEDS_REVIEW','GRADED') then
      perform public.buklod_quiz_compute_attempt_internal(v_attempt);
    elsif v_status='RELEASED' then
      select coalesce(sum(d.deduction_points),0)
        into v_deduction
      from public.buklod_quiz_integrity_deductions d
      where d.attempt_id=v_attempt;

      update public.buklod_quiz_attempts a
         set total_score = greatest(
               0,
               coalesce(a.objective_score,0) + coalesce(a.manual_score,0) - v_deduction
             ),
             updated_at = now()
       where a.id=v_attempt
         and a.status='RELEASED';
    end if;
  end loop;

  select coalesce(sum(d.deduction_points),0)
    into v_total
  from public.buklod_quiz_integrity_deductions d
  join (
    select distinct attempt_id
    from pg_temp.buklod_integrity_autoset_targets_v3
  ) t on t.attempt_id=d.attempt_id;

  return query
  select v_saved,coalesce(v_total,0),v_matched_events,v_affected,v_released;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_bind_attempt_device_v1(p_attempt_id uuid, p_device_token text, p_source text DEFAULT 'CLIENT'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  a public.buklod_quiz_attempts%rowtype;
  e public.buklod_quiz_exams%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  v_token text := btrim(coalesce(p_device_token,''));
  v_hash text;
  v_policy text;
  v_recent boolean;
  v_bound boolean := false;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=v_actor and x.status='STARTED';
  if a.id is null then raise exception 'Attempt is not active.'; end if;

  -- Legacy clients: keep liveness, but do not rewrite the row on every call.
  if v_token='' then
    update public.buklod_quiz_attempts x
       set last_client_seen_at=now(), updated_at=now()
     where x.id=a.id
       and (x.last_client_seen_at is null or x.last_client_seen_at < now()-interval '15 seconds');
    return 'LEGACY_NO_TOKEN';
  end if;

  if length(v_token)<16 or length(v_token)>200 then raise exception 'Invalid device token.'; end if;
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  -- This is the normal hot path. No row lock and at most one liveness write per 15s.
  if a.device_binding_hash=v_hash then
    update public.buklod_quiz_attempts x
       set last_client_seen_at=now(), updated_at=now()
     where x.id=a.id
       and (x.last_client_seen_at is null or x.last_client_seen_at < now()-interval '15 seconds');
    return 'SAME';
  end if;

  -- First binding is atomic. If another request wins the race, reload and continue safely.
  if a.device_binding_hash is null then
    update public.buklod_quiz_attempts x
       set device_binding_hash=v_hash,
           device_bound_at=now(),
           last_client_seen_at=now(),
           updated_at=now()
     where x.id=a.id and x.device_binding_hash is null
     returning true into v_bound;

    if coalesce(v_bound,false) then
      select x.* into e from public.buklod_quiz_exams x where x.id=a.exam_id;
      if a.live_session_id is not null then
        select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id;
      end if;
      v_policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,e.device_policy,'MONITOR'));
      insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
      values(a.id,v_actor,'DEVICE_BOUND',jsonb_build_object('source',p_source,'device_hash_prefix',left(v_hash,12),'policy',v_policy));
      return 'BOUND';
    end if;

    select x.* into a
    from public.buklod_quiz_attempts x
    where x.id=p_attempt_id and x.student_user_id=v_actor and x.status='STARTED';
    if a.id is null then raise exception 'Attempt is not active.'; end if;
    if a.device_binding_hash=v_hash then return 'SAME'; end if;
  end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=a.exam_id;
  if a.live_session_id is not null then
    select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id;
  end if;
  v_policy:=upper(coalesce(nullif(a.security_snapshot->>'device_policy',''),s.device_policy,e.device_policy,'MONITOR'));

  if v_policy='LOCK' then
    raise exception 'This exam attempt is locked to the first device/browser used. Ask faculty to reset or authorize recovery.';
  end if;

  select exists(
    select 1 from public.buklod_quiz_events ev
    where ev.attempt_id=a.id and ev.event_type='DEVICE_CHANGED'
      and ev.event_data->>'device_hash_prefix'=left(v_hash,12)
      and ev.created_at>=now()-interval '10 minutes'
  ) into v_recent;

  if not v_recent then
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(a.id,v_actor,'DEVICE_CHANGED',jsonb_build_object(
      'source',p_source,'device_hash_prefix',left(v_hash,12),'original_hash_prefix',left(a.device_binding_hash,12),'policy',v_policy
    ));
    update public.buklod_quiz_attempts x
       set device_change_count=x.device_change_count+1,last_client_seen_at=now(),updated_at=now()
     where x.id=a.id;
  else
    update public.buklod_quiz_attempts x
       set last_client_seen_at=now(),updated_at=now()
     where x.id=a.id
       and (x.last_client_seen_at is null or x.last_client_seen_at < now()-interval '15 seconds');
  end if;
  return 'CHANGED_MONITORED';
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_integrity_analysis_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, student_user_id uuid, cheating_risk_pct integer, cheating_risk_level text, leakage_risk_pct integer, leakage_risk_level text, confidence_pct integer, incident_count integer, strong_signal_count integer, trace_code text, summary text, evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with authorized as (
  select e.id
  from public.buklod_quiz_exams e
  join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
  where e.id=p_exam_id
    and e.owner_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
), latest as (
  select distinct on (a.student_user_id) a.*
  from public.buklod_quiz_attempts a
  join authorized z on z.id=a.exam_id
  join public.buklod_quiz_roster r
    on r.exam_id=a.exam_id and r.section_id=a.section_id and r.student_user_id=a.student_user_id and r.status='ACTIVE'
  where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status<>'VOID'
  order by a.student_user_id,a.attempt_no desc
)
select
  a.id,a.student_user_id,
  m.cheating_risk_pct,
  case when m.cheating_risk_pct>=75 then 'CRITICAL' when m.cheating_risk_pct>=50 then 'HIGH' when m.cheating_risk_pct>=25 then 'MODERATE' else 'LOW' end,
  m.leakage_risk_pct,
  case when m.leakage_risk_pct>=75 then 'CRITICAL' when m.leakage_risk_pct>=50 then 'HIGH' when m.leakage_risk_pct>=25 then 'MODERATE' else 'LOW' end,
  m.confidence_pct,
  m.departure_incidents + m.copy_attempts + m.screen_capture_signals + m.devtools_attempts + m.context_menu_attempts,
  m.copy_attempts + m.screen_capture_signals + m.devtools_attempts,
  a.external_capture_trace_code,
  case
    when m.raw_integrity_signals=0 then 'No supported integrity signal was recorded. This does not prove that no misconduct occurred.'
    when (m.copy_attempts+m.screen_capture_signals+m.devtools_attempts)=0 then 'Repeated exam-away or focus-loss behavior may be present, but no direct copy, screenshot/screen-capture, or developer-tools signal was recorded. Faculty review is recommended; this is not proof of cheating.'
    else 'One or more stronger integrity signals were recorded in addition to sequence behavior. Review the exact timeline and other evidence before making any academic decision.'
  end,
  m.evidence || jsonb_build_object('trace_code',a.external_capture_trace_code)
from latest a
cross join lateral public.buklod_quiz_integrity_metrics_v1(a.id) m
order by m.cheating_risk_pct desc,m.leakage_risk_pct desc,a.student_user_id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_compute_attempt_internal(p_attempt_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_obj numeric;
  v_man numeric;
  v_max numeric;
  v_pending boolean;
  v_status text;
  v_deduction numeric;
begin
  update public.buklod_quiz_responses r
     set objective_score = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         case when lower(trim(coalesce(r.answer#>>'{}',''))) = lower(trim(coalesce(q.correct_answer#>>'{}',''))) then q.points else 0 end
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then 0
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then q.points
           else 0
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              then q.points else 0 end
       else null
     end,
     is_correct = case
       when q.question_type in ('MCQ','TRUE_FALSE') then
         lower(trim(coalesce(r.answer#>>'{}',''))) = lower(trim(coalesce(q.correct_answer#>>'{}','')))
       when q.question_type='SHORT_TEXT' then
         case
           when r.manual_score is not null then
             case when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = '' then false
           when public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') = public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}') then true
           else null
         end
       when q.question_type='NUMERIC' then
         case when trim(coalesce(r.answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
                and trim(coalesce(q.correct_answer#>>'{}',''))~'^-?[0-9]+([.][0-9]+)?$'
              then abs((r.answer#>>'{}')::numeric-(q.correct_answer#>>'{}')::numeric)<=0.000001
              else false end
       else case when r.manual_score is null then null when r.manual_score >= q.points then true when r.manual_score <= 0 then false else null end
     end,
     needs_review = case
       when q.question_type='SHORT_TEXT' then
         r.manual_score is null
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> ''
         and public.buklod_quiz_normalize_short_text_v1(r.answer#>>'{}') <> public.buklod_quiz_normalize_short_text_v1(q.correct_answer#>>'{}')
       when q.question_type in ('ESSAY','ENUMERATION','MANUAL') then
         r.manual_score is null
         and case
           when r.answer is null or r.answer='null'::jsonb then false
           when jsonb_typeof(r.answer)='string' then nullif(trim(r.answer#>>'{}'),'') is not null
           when jsonb_typeof(r.answer)='array' then jsonb_array_length(r.answer)>0
           when jsonb_typeof(r.answer)='object' then r.answer <> '{}'::jsonb
           else true
         end
       else false
     end
  from public.buklod_quiz_questions q
  where q.id = r.question_id
    and r.attempt_id = p_attempt_id;

  select
    coalesce(sum(case when r.manual_score is null then coalesce(r.objective_score,0) else 0 end),0),
    coalesce(sum(coalesce(r.manual_score,0)),0),
    coalesce(sum(q.points),0),
    coalesce(bool_or(r.needs_review and r.manual_score is null),false)
    into v_obj,v_man,v_max,v_pending
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and q.is_active=true;

  select coalesce(sum(d.deduction_points),0)
    into v_deduction
  from public.buklod_quiz_integrity_deductions d
  where d.attempt_id=p_attempt_id;

  v_status := case when v_pending then 'NEEDS_REVIEW' else 'GRADED' end;

  update public.buklod_quiz_attempts
     set status=v_status,
         objective_score=v_obj,
         manual_score=v_man,
         total_score=greatest(0,v_obj+v_man-v_deduction),
         max_score=v_max,
         submitted_at=coalesce(submitted_at,now()),
         updated_at=now()
   where id=p_attempt_id;

  return v_status;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_record_violations_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, attempt_status text, event_type text, violation_label text, event_count integer, first_event_at timestamp with time zone, last_event_at timestamp with time zone, deduction_points numeric, deduction_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with authorized as (
    select e.id
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections sx on sx.exam_id=e.id and sx.id=p_section_id
    where e.id=p_exam_id
      and e.owner_user_id=(select auth.uid())
      and public.buklod_quiz_is_examiner((select auth.uid()))
  ), latest as (
    select distinct on (a.student_user_id) a.id,a.status,a.student_user_id
    from public.buklod_quiz_attempts a
    join authorized z on z.id=a.exam_id
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id and r.section_id=a.section_id and r.student_user_id=a.student_user_id and r.status='ACTIVE'
    where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  ), deductions as (
    select d.attempt_id,
           case when d.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND') then 'TAB_HIDDEN' else d.event_type end as event_type,
           sum(d.deduction_points)::numeric as deduction_points,
           nullif(string_agg(d.note,' | ' order by d.event_type) filter(where d.note is not null),'') as deduction_note
    from public.buklod_quiz_integrity_deductions d
    join latest l on l.id=d.attempt_id
    group by d.attempt_id,case when d.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND') then 'TAB_HIDDEN' else d.event_type end
  )
  select
    l.id,l.status,i.event_type,i.violation_label,i.event_count,i.first_event_at,i.last_event_at,
    coalesce(d.deduction_points,0)::numeric,d.deduction_note
  from latest l
  cross join lateral public.buklod_quiz_integrity_incident_rows_v1(l.id) i
  left join deductions d on d.attempt_id=l.id and d.event_type=i.event_type
  order by l.id,i.last_event_at desc,i.event_type
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_records_v1(p_exam_id uuid, p_section_id uuid, p_sort text DEFAULT 'SCORE_DESC'::text)
 RETURNS TABLE(section_id uuid, section_name text, student_user_id uuid, surname text, first_name text, display_name text, student_no text, attempt_id uuid, attempt_no integer, attempt_status text, total_score numeric, max_score numeric, score_percent numeric, class_rank bigint, released_at timestamp with time zone, integrity_events integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_sort text := upper(coalesce(p_sort,'SCORE_DESC'));
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;

  return query
  with base as (
    select
      r.section_id,
      s.name::text as section_name,
      r.student_user_id,
      r.surname::text,
      r.first_name::text,
      r.display_name::text,
      r.student_no::text,
      a.id as attempt_id,
      a.attempt_no,
      a.status::text as attempt_status,
      a.total_score,
      a.max_score,
      case when coalesce(a.max_score,0)>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end as score_percent,
      a.released_at,
      coalesce(im.supported_incidents,0)::integer as integrity_events
    from public.buklod_quiz_roster r
    join public.buklod_quiz_sections s on s.id=r.section_id and s.exam_id=r.exam_id
    left join lateral (
      select ax.*
      from public.buklod_quiz_attempts ax
      where ax.exam_id=r.exam_id
        and ax.section_id=r.section_id
        and ax.student_user_id=r.student_user_id
        and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc
      limit 1
    ) a on true
    left join lateral (
      select (
        coalesce(m.departure_incidents,0)
        + coalesce(m.copy_attempts,0)
        + coalesce(m.screen_capture_signals,0)
        + coalesce(m.devtools_attempts,0)
        + coalesce(m.context_menu_attempts,0)
      )::integer as supported_incidents
      from public.buklod_quiz_integrity_metrics_v1(a.id) m
    ) im on a.id is not null
    where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), ranked as (
    select b.*,
      case when b.attempt_id is null then null::bigint
           else dense_rank() over(order by b.score_percent desc nulls last,b.total_score desc nulls last) end as class_rank
    from base b
  )
  select
    x.section_id,x.section_name,x.student_user_id,x.surname,x.first_name,x.display_name,x.student_no,
    x.attempt_id,x.attempt_no,x.attempt_status,x.total_score,x.max_score,x.score_percent,x.class_rank,x.released_at,x.integrity_events
  from ranked x
  order by
    case when v_sort='NAME_ASC' then lower(coalesce(nullif(x.surname,''),x.display_name)) end asc nulls last,
    case when v_sort='NAME_ASC' then lower(coalesce(x.first_name,'')) end asc nulls last,
    case when v_sort='VIOLATIONS_DESC' then x.integrity_events end desc nulls last,
    case when v_sort='VIOLATIONS_DESC' then x.score_percent end desc nulls last,
    case when v_sort not in ('NAME_ASC','VIOLATIONS_DESC') then x.score_percent end desc nulls last,
    case when v_sort not in ('NAME_ASC','VIOLATIONS_DESC') then x.total_score end desc nulls last,
    lower(coalesce(nullif(x.surname,''),x.display_name)),lower(coalesce(x.first_name,'')),x.student_user_id;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_review_queue_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,
    rr.id,
    a.student_user_id,
    coalesce(
      public.buklod_quiz_profile_display_name_v1(a.student_user_id),
      nullif(trim(ro.display_name), ''),
      'BUKLOD Student'
    )::text,
    sx.name,
    q.id,
    q.prompt,
    q.question_type,
    q.points,
    rr.answer #>> '{}',
    rr.manual_score,
    rr.feedback
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses rr on rr.attempt_id = a.id
  join public.buklod_quiz_questions q on q.id = rr.question_id
  join public.buklod_quiz_roster ro
    on ro.exam_id = a.exam_id
   and ro.section_id = a.section_id
   and ro.student_user_id = a.student_user_id
  left join public.profiles p on p.id = a.student_user_id
  join public.buklod_quiz_sections sx
    on sx.id = a.section_id and sx.exam_id = a.exam_id
  join public.buklod_quiz_exams e on e.id = a.exam_id
  where a.exam_id = p_exam_id
    and a.section_id = p_section_id
    and e.owner_user_id = (select auth.uid())
    and rr.needs_review = true
    and a.status = 'NEEDS_REVIEW'
  order by
    lower(coalesce(nullif(trim(p.surname), ''), ro.surname, '')),
    lower(coalesce(nullif(trim(p.first_name), ''), ro.first_name, '')),
    lower(coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id), ro.display_name, '')),
    a.attempt_no,
    q.sort_order
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_review_queue_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(section_id uuid, section_name text, attempt_id uuid, student_user_id uuid, display_name text, response_id uuid, question_id uuid, question_type text, prompt text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(
    select 1
    from public.buklod_quiz_exams e
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then
    raise exception 'Exam owner access required.';
  end if;

  return query
  select
    a.section_id,
    s.name::text,
    a.id,
    a.student_user_id,
    coalesce(rst.display_name,p.full_name,p.username,p.email,'BUKLOD Student')::text,
    r.id,
    q.id,
    q.question_type::text,
    q.prompt::text,
    q.points,
    case
      when r.answer is null then ''
      when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
      else r.answer::text
    end::text,
    coalesce(r.manual_score, sug.suggested_score),
    coalesce(nullif(btrim(r.feedback::text),''), sug.feedback::text)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_sections s
    on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_responses r
    on r.attempt_id=a.id
  join public.buklod_quiz_questions q
    on q.id=r.question_id and q.exam_id=a.exam_id
  left join public.buklod_quiz_roster rst
    on rst.exam_id=a.exam_id
   and rst.section_id=a.section_id
   and rst.student_user_id=a.student_user_id
  left join public.profiles p
    on p.id=a.student_user_id
  left join public.buklod_quiz_review_suggestions sug
    on sug.response_id=r.id
   and sug.created_by=v_actor
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status='NEEDS_REVIEW'
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL')
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true
  order by
    lower(coalesce(rst.surname,p.surname,'')),
    lower(coalesce(rst.first_name,p.first_name,'')),
    a.attempt_no,
    q.sort_order,
    q.id;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_security_signals_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(student_user_id uuid, display_name text, attempt_id uuid, attempt_status text, signal_count bigint, device_changes integer, rapid_bursts bigint, long_gaps bigint, reentries bigint, answer_change_flags bigint, offline_syncs bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with authorized as(
    select e.id
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=(select auth.uid()) and public.buklod_quiz_is_examiner((select auth.uid()))
  ), latest as(
    select distinct on(a.student_user_id) a.*
    from public.buklod_quiz_attempts a
    join authorized z on z.id=a.exam_id
    where a.section_id=p_section_id and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  )
  select l.student_user_id,
         coalesce(public.buklod_quiz_profile_display_name_v1(l.student_user_id),'BUKLOD Student'),
         l.id,l.status,
         count(ev.id) filter(where ev.event_type in ('DEVICE_CHANGED','RAPID_ANSWER_BURST','LONG_HEARTBEAT_GAP','ATTEMPT_REENTERED','EXCESSIVE_ANSWER_CHANGES','OFFLINE_SUBMISSION_SYNC')),
         count(ev.id) filter(where ev.event_type='DEVICE_CHANGED')::integer,
         count(ev.id) filter(where ev.event_type='RAPID_ANSWER_BURST'),
         count(ev.id) filter(where ev.event_type='LONG_HEARTBEAT_GAP'),
         count(ev.id) filter(where ev.event_type='ATTEMPT_REENTERED'),
         count(ev.id) filter(where ev.event_type='EXCESSIVE_ANSWER_CHANGES'),
         count(ev.id) filter(where ev.event_type='OFFLINE_SUBMISSION_SYNC')
  from latest l
  left join public.buklod_quiz_events ev on ev.attempt_id=l.id
  group by l.student_user_id,l.id,l.status
  order by 5 desc,lower(coalesce(public.buklod_quiz_profile_display_name_v1(l.student_user_id),'BUKLOD Student'))
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_class_violations_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, event_type text, violation_label text, event_count integer, first_event_at timestamp with time zone, last_event_at timestamp with time zone, deduction_points numeric, deduction_note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select x.attempt_id,x.event_type,x.violation_label,x.event_count,x.first_event_at,x.last_event_at,x.deduction_points,x.deduction_note
  from public.buklod_quiz_class_record_violations_v2(p_exam_id,p_section_id) x
  join public.buklod_quiz_attempts a on a.id=x.attempt_id
  where a.status='NEEDS_REVIEW';
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_clone_live_session_v1(p_session_id uuid, p_section_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.buklod_quiz_live_sessions%rowtype; v_new uuid; v_section uuid;
begin
  select x.* into s from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid());
  if s.id is null then raise exception 'Live session not found or unauthorized.'; end if;
  v_section:=coalesce(p_section_id,s.section_id);
  if not exists(select 1 from public.buklod_quiz_sections x where x.id=v_section and x.exam_id=s.exam_id and x.archived_at is null) then
    raise exception 'Target class/section is invalid.';
  end if;
  if exists(select 1 from public.buklod_quiz_live_sessions x where x.exam_id=s.exam_id and x.section_id=v_section and x.faculty_user_id=(select auth.uid()) and x.status<>'ENDED') then
    raise exception 'Target class already has an active or waiting live session.';
  end if;
  insert into public.buklod_quiz_live_sessions(
    exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join,
    duration_minutes,max_attempts,pass_percent,question_count,total_score_target,
    randomize_questions,randomize_choices,one_question_at_a_time,no_backtracking,
    late_join_minutes,require_fullscreen_web,block_screen_capture,integrity_mode,
    result_release_mode,show_answers_after_release,show_correct_after_release,
    show_explanations_after_release,selected_question_ids,settings_snapshot
  ) values(
    s.exam_id,v_section,(select auth.uid()),public.buklod_quiz_make_live_code_v1(),'WAITING',s.admission_mode,s.allow_late_join,
    s.duration_minutes,s.max_attempts,s.pass_percent,s.question_count,s.total_score_target,
    s.randomize_questions,s.randomize_choices,s.one_question_at_a_time,s.no_backtracking,
    s.late_join_minutes,s.require_fullscreen_web,s.block_screen_capture,s.integrity_mode,
    'MANUAL',s.show_answers_after_release,s.show_correct_after_release,
    s.show_explanations_after_release,s.selected_question_ids,s.settings_snapshot
  ) returning id into v_new;
  insert into public.buklod_quiz_faculty_actions(actor_user_id,exam_id,section_id,live_session_id,action,action_data)
  values((select auth.uid()),s.exam_id,v_section,v_new,'LIVE_SESSION_CLONED',jsonb_build_object('source_session_id',s.id));
  return v_new;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_create_live_class_v1(p_exam_id uuid, p_admission_mode text DEFAULT 'OPEN'::text, p_allow_late_join boolean DEFAULT true)
 RETURNS TABLE(session_id uuid, join_code text, status text, admission_mode text, allow_late_join boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_section_id uuid;
  v_section_count integer;
begin
  select count(*)
  into v_section_count
  from public.buklod_quiz_sections sx
  where sx.exam_id = p_exam_id;

  if v_section_count = 0 then
    raise exception 'This exam has no class configured.';
  elsif v_section_count > 1 then
    raise exception 'Choose a class/section before opening the live room.';
  end if;

  select sx.id
  into strict v_section_id
  from public.buklod_quiz_sections sx
  where sx.exam_id = p_exam_id
  order by sx.sort_order nulls last, lower(sx.name), sx.id
  limit 1;

  return query
  select x.session_id, x.join_code, x.status, x.admission_mode, x.allow_late_join
  from public.buklod_quiz_create_live_class_v2(
    p_exam_id,
    v_section_id,
    p_admission_mode,
    p_allow_late_join
  ) x;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_create_live_class_v2(p_exam_id uuid, p_section_id uuid, p_admission_mode text DEFAULT 'OPEN'::text, p_allow_late_join boolean DEFAULT true)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, join_code text, status text, admission_mode text, allow_late_join boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.buklod_quiz_exams%rowtype; sx public.buklod_quiz_sections%rowtype; s public.buklod_quiz_live_sessions%rowtype; m text:=upper(trim(coalesce(p_admission_mode,'OPEN')));
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;
  select x.* into e from public.buklod_quiz_exams x where x.id=p_exam_id and x.owner_user_id=(select auth.uid());
  if e.id is null or not public.buklod_quiz_is_examiner((select auth.uid())) then raise exception 'Exam not found or unauthorized.'; end if;
  select x.* into sx from public.buklod_quiz_sections x where x.id=p_section_id and x.exam_id=p_exam_id and x.archived_at is null;
  if sx.id is null then raise exception 'Selected class is deleted/archived or does not belong to this exam.'; end if;
  if m not in ('OPEN','APPROVAL') then raise exception 'Invalid admission mode.'; end if;
  select x.* into s from public.buklod_quiz_live_sessions x
   where x.exam_id=p_exam_id and x.section_id=p_section_id and x.faculty_user_id=(select auth.uid()) and x.status<>'ENDED'
   order by x.created_at desc limit 1 for update;
  if s.id is null then
    begin
      insert into public.buklod_quiz_live_sessions(exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join)
      values(p_exam_id,p_section_id,(select auth.uid()),public.buklod_quiz_make_live_code_v1(),'WAITING',m,coalesce(p_allow_late_join,true)) returning * into s;
    exception when unique_violation then
      select x.* into s from public.buklod_quiz_live_sessions x
       where x.exam_id=p_exam_id and x.section_id=p_section_id and x.faculty_user_id=(select auth.uid()) and x.status<>'ENDED'
       order by x.created_at desc limit 1;
    end;
  end if;
  update public.buklod_quiz_live_sessions x set admission_mode=m,allow_late_join=coalesce(p_allow_late_join,true),updated_at=now() where x.id=s.id returning * into s;
  return query select s.id,s.section_id,sx.name,s.join_code,s.status,s.admission_mode,s.allow_late_join;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_create_live_class_v4(p_exam_id uuid, p_section_id uuid, p_join_policy text DEFAULT NULL::text, p_allow_late_join boolean DEFAULT NULL::boolean)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, join_code text, status text, admission_mode text, allow_late_join boolean, join_policy text, security_preset text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  e public.buklod_quiz_exams%rowtype;
  sx public.buklod_quiz_sections%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  v_policy text;
  v_admission text;
  v_late boolean;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;
  select x.* into e from public.buklod_quiz_exams x
  where x.id=p_exam_id and x.owner_user_id=v_actor;
  if e.id is null or not public.buklod_quiz_is_examiner(v_actor) then
    raise exception 'Exam not found or unauthorized.';
  end if;

  select x.* into sx from public.buklod_quiz_sections x
  where x.id=p_section_id and x.exam_id=p_exam_id and x.archived_at is null;
  if sx.id is null then raise exception 'Selected class is deleted/archived or does not belong to this exam.'; end if;

  v_policy:=upper(btrim(coalesce(p_join_policy,e.default_live_join_policy,'OPEN')));
  if v_policy not in ('OPEN','ROSTER_ONLY','APPROVAL','ROSTER_APPROVAL') then
    raise exception 'Invalid live join policy.';
  end if;
  v_admission:=case when v_policy in ('APPROVAL','ROSTER_APPROVAL') then 'APPROVAL' else 'OPEN' end;
  v_late:=case when e.security_preset='HIGH_STAKES' then false else coalesce(p_allow_late_join,true) end;

  select ls.* into s from public.buklod_quiz_live_sessions ls
  where ls.exam_id=p_exam_id and ls.section_id=p_section_id
    and ls.faculty_user_id=v_actor and ls.status<>'ENDED'
  order by ls.created_at desc limit 1 for update;

  if s.id is null then
    begin
      insert into public.buklod_quiz_live_sessions(
        exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join,
        join_policy,security_preset,device_policy,behavior_monitoring,offline_security_mode,
        require_fullscreen_web,block_screen_capture,integrity_mode,
        randomize_questions,randomize_choices,one_question_at_a_time,no_backtracking,
        duration_minutes,max_attempts,pass_percent
      ) values(
        p_exam_id,p_section_id,v_actor,public.buklod_quiz_make_live_code_v1(),'WAITING',v_admission,v_late,
        v_policy,e.security_preset,e.device_policy,e.behavior_monitoring,e.offline_security_mode,
        e.require_fullscreen_web,e.block_screen_capture,e.integrity_mode,
        e.randomize_questions,e.randomize_choices,e.one_question_at_a_time,e.no_backtracking,
        e.duration_minutes,e.max_attempts,e.pass_percent
      ) returning * into s;
    exception when unique_violation then
      select ls.* into s from public.buklod_quiz_live_sessions ls
      where ls.exam_id=p_exam_id and ls.section_id=p_section_id
        and ls.faculty_user_id=v_actor and ls.status<>'ENDED'
      order by ls.created_at desc limit 1;
    end;
  end if;

  if s.config_locked_at is not null and s.status<>'WAITING' then
    -- Content/security config is immutable after START; only late-join remains a live control.
    update public.buklod_quiz_live_sessions ls
      set allow_late_join=case when coalesce(ls.security_preset,e.security_preset)='HIGH_STAKES' then false else v_late end,
          updated_at=now()
    where ls.id=s.id returning * into s;
  else
    update public.buklod_quiz_live_sessions ls set
      admission_mode=v_admission,allow_late_join=v_late,join_policy=v_policy,
      security_preset=e.security_preset,device_policy=e.device_policy,
      behavior_monitoring=e.behavior_monitoring,offline_security_mode=e.offline_security_mode,
      require_fullscreen_web=e.require_fullscreen_web,block_screen_capture=e.block_screen_capture,
      integrity_mode=e.integrity_mode,randomize_questions=e.randomize_questions,
      randomize_choices=e.randomize_choices,one_question_at_a_time=e.one_question_at_a_time,
      no_backtracking=e.no_backtracking,duration_minutes=e.duration_minutes,
      max_attempts=e.max_attempts,pass_percent=e.pass_percent,updated_at=now()
    where ls.id=s.id returning * into s;
  end if;

  perform public.buklod_quiz_audit_write_v1(
    p_exam_id,p_section_id,s.id,null,'LIVE_CLASS_CONFIGURED',
    jsonb_build_object('join_policy',s.join_policy,'allow_late_join',s.allow_late_join,'security_preset',s.security_preset),v_actor
  );

  return query select s.id,s.section_id,sx.name,s.join_code,s.status,s.admission_mode,s.allow_late_join,s.join_policy,s.security_preset;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_current_user_assigned_to_exam(p_exam_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select exists (
        select 1
        from public.buklod_quiz_roster r
        where r.exam_id = p_exam_id
          and r.student_user_id = (select auth.uid())
          and r.status = 'ACTIVE'
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(p_user_id uuid, p_email text, p_user_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_email text := lower(trim(coalesce(p_email,'')));
  v_existing_id uuid;
  v_now timestamptz := now();
  v_metadata jsonb := coalesce(p_user_metadata,'{}'::jsonb);
begin
  if p_user_id is null or v_email = '' then
    return jsonb_build_object('ok',false,'error','missing_identity');
  end if;

  select id into v_existing_id
  from auth.users
  where id = p_user_id;

  if v_existing_id is not null then
    return jsonb_build_object('ok',true,'created',false,'user_id',p_user_id);
  end if;

  select id into v_existing_id
  from auth.users
  where lower(email) = v_email
    and is_sso_user = false
  limit 1;

  if v_existing_id is not null and v_existing_id <> p_user_id then
    -- Preserve the existing Quiz UUID and all existing exam/roster/attempt data.
    -- This privileged RPC must be followed by live Main Auth email validation
    -- before the caller can issue any Quiz login link.
    if exists (
      select 1 from auth.users u
      where u.id = v_existing_id
        and u.email_confirmed_at is not null
        and coalesce(u.is_sso_user,false) = false
        and coalesce(u.is_anonymous,false) = false
        and (u.banned_until is null or u.banned_until <= now())
        and (
          u.raw_app_meta_data->>'buklod_main_user_id' is null
          or u.raw_app_meta_data->>'buklod_main_user_id' = p_user_id::text
        )
    ) then
      return jsonb_build_object('ok',true,'created',false,'user_id',v_existing_id,'legacy_existing',true);
    end if;
    return jsonb_build_object('ok',false,'error','email_identity_conflict');
  end if;

  insert into auth.users(
    instance_id,id,aud,role,email,encrypted_password,
    email_confirmed_at,confirmation_token,recovery_token,
    email_change_token_new,email_change,
    raw_app_meta_data,raw_user_meta_data,is_super_admin,
    created_at,updated_at,phone,phone_change,phone_change_token,
    email_change_token_current,email_change_confirm_status,
    reauthentication_token,is_sso_user,is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    p_user_id,'authenticated','authenticated',v_email,null,
    v_now,'','',
    '','',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    v_metadata,null,
    v_now,v_now,null,'','',
    '',0,
    '',false,false
  )
  on conflict (id) do nothing;

  insert into auth.identities(
    provider_id,user_id,identity_data,provider,
    last_sign_in_at,created_at,updated_at
  ) values (
    p_user_id::text,
    p_user_id,
    v_metadata || jsonb_build_object(
      'sub',p_user_id::text,
      'email',v_email,
      'email_verified',true,
      'phone_verified',false
    ),
    'email',null,v_now,v_now
  )
  on conflict (provider_id,provider) do nothing;

  return jsonb_build_object('ok',true,'created',true,'user_id',p_user_id);
exception
  when unique_violation then
    return jsonb_build_object('ok',false,'error','identity_conflict');
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_records_v1(p_exam_id uuid)
 RETURNS TABLE(section_id uuid, section_name text, student_user_id uuid, surname text, first_name text, display_name text, student_no text, attempt_no integer, attempt_status text, total_score numeric, max_score numeric, released_at timestamp with time zone, integrity_events bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.id,
    s.name,
    r.student_user_id,
    r.surname,
    r.first_name,
    r.display_name,
    r.student_no,
    a.attempt_no,
    a.status,
    a.total_score,
    a.max_score,
    a.released_at,
    coalesce(a.integrity_violation_count,0)::bigint
  from public.buklod_quiz_roster r
  join public.buklod_quiz_sections s on s.id = r.section_id
  join public.buklod_quiz_exams e on e.id = r.exam_id
  left join lateral(
    select x.*
    from public.buklod_quiz_attempts x
    where x.exam_id = r.exam_id
      and x.student_user_id = r.student_user_id
    order by x.attempt_no desc
    limit 1
  ) a on true
  where r.exam_id = p_exam_id
    and r.status = 'ACTIVE'
    and e.owner_user_id = auth.uid()
  order by s.sort_order,
           lower(r.surname),
           lower(r.first_name),
           lower(r.display_name)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_entry_claim_r13(p_user_id uuid)
 RETURNS TABLE(allowed boolean, retry_after_ms integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_last timestamptz;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_required'; END IF;
  INSERT INTO public.buklod_quiz_main_entry_gate(user_id,last_issued_at,updated_at)
    VALUES (p_user_id, clock_timestamp(), clock_timestamp())
  ON CONFLICT(user_id) DO UPDATE
    SET last_issued_at=EXCLUDED.last_issued_at, updated_at=EXCLUDED.updated_at
  WHERE public.buklod_quiz_main_entry_gate.last_issued_at <= clock_timestamp() - interval '6 seconds'
  RETURNING last_issued_at INTO v_last;
  IF FOUND THEN
    allowed:=true;retry_after_ms:=0;
  ELSE
    SELECT last_issued_at INTO v_last
    FROM public.buklod_quiz_main_entry_gate WHERE user_id=p_user_id;
    allowed:=false;
    retry_after_ms:=greatest(1000,ceil(extract(epoch FROM (v_last + interval '6 seconds' - clock_timestamp())) * 1000)::integer);
  END IF;
  RETURN NEXT;
END;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_current_user_in_live_session(p_session_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select exists (
        select 1
        from public.buklod_quiz_live_members m
        where m.session_id = p_session_id
          and m.student_user_id = (select auth.uid())
          and m.status <> 'REMOVED'
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_duplicate_exam_v1(p_exam_id uuid, p_new_title text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.buklod_quiz_exams%rowtype;
  v_new uuid;
  v_title text;
begin
  select x.* into e
  from public.buklod_quiz_exams x
  where x.id=p_exam_id
    and x.owner_user_id=(select auth.uid());

  if e.id is null or not public.buklod_quiz_is_examiner((select auth.uid())) then
    raise exception 'Exam not found or unauthorized.';
  end if;

  v_title:=coalesce(nullif(trim(p_new_title),''),e.title||' (Copy)');

  insert into public.buklod_quiz_exams(
    owner_user_id,title,description,exam_type,instructions,duration_minutes,max_attempts,status,
    randomize_questions,randomize_choices,one_question_at_a_time,no_backtracking,
    pass_percent,total_points,integrity_mode,integrity_violation_limit,integrity_auto_submit,
    require_fullscreen_web,block_screen_capture,exam_language
  ) values(
    (select auth.uid()),v_title,e.description,e.exam_type,e.instructions,e.duration_minutes,e.max_attempts,'DRAFT',
    e.randomize_questions,e.randomize_choices,e.one_question_at_a_time,e.no_backtracking,
    e.pass_percent,e.total_points,e.integrity_mode,e.integrity_violation_limit,false,
    e.require_fullscreen_web,e.block_screen_capture,e.exam_language
  ) returning id into v_new;

  insert into public.buklod_quiz_questions(
    exam_id,question_type,prompt,options,correct_answer,points,sort_order,source_pages,rubric,explanation,is_active,created_by
  )
  select v_new,q.question_type,q.prompt,q.options,q.correct_answer,q.points,q.sort_order,
         q.source_pages,q.rubric,q.explanation,q.is_active,(select auth.uid())
  from public.buklod_quiz_questions q
  where q.exam_id=p_exam_id;

  insert into public.buklod_quiz_sections(exam_id,name,sort_order)
  select v_new,s.name,s.sort_order
  from public.buklod_quiz_sections s
  where s.exam_id=p_exam_id and s.archived_at is null;

  if not exists(select 1 from public.buklod_quiz_sections s where s.exam_id=v_new) then
    insert into public.buklod_quiz_sections(exam_id,name,sort_order)
    values(v_new,'General',1);
  end if;

  return v_new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_audit_v1(p_exam_id uuid, p_section_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 200)
 RETURNS TABLE(audit_id uuid, created_at timestamp with time zone, action text, actor_user_id uuid, actor_name text, section_id uuid, live_session_id uuid, attempt_id uuid, details jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with authorized as(
    select e.id
    from public.buklod_quiz_exams e
    where e.id=p_exam_id and e.owner_user_id=(select auth.uid())
      and public.buklod_quiz_is_examiner((select auth.uid()))
  )
  select a.id,a.created_at,a.action,a.actor_user_id,
         coalesce(public.buklod_quiz_profile_display_name_v1(a.actor_user_id),'SYSTEM'),
         a.section_id,a.live_session_id,a.attempt_id,a.details
  from public.buklod_quiz_audit_log a
  cross join authorized z
  where (
      a.exam_id=p_exam_id
      and (p_section_id is null or a.section_id=p_section_id)
    )
    or (
      a.exam_id is null
      and a.actor_user_id=(select auth.uid())
      and a.action in ('INTEGRITY_RULE_CREATED','INTEGRITY_RULE_CHANGED','INTEGRITY_RULE_REMOVED')
    )
  order by a.created_at desc,a.id desc
  limit greatest(1,least(coalesce(p_limit,200),500))
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_management_list_v1()
 RETURNS TABLE(exam_id uuid, title text, status text, duration_minutes integer, max_attempts integer, pass_percent numeric, randomize_questions boolean, randomize_choices boolean, one_question_at_a_time boolean, no_backtracking boolean, question_count integer, total_raw_points numeric, section_count integer, attempt_count integer, released_count integer, active_live_count integer, archived_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id,e.title,e.status,e.duration_minutes,e.max_attempts,e.pass_percent,e.randomize_questions,e.randomize_choices,
         e.one_question_at_a_time,e.no_backtracking,
         (select count(*)::int from public.buklod_quiz_questions q where q.exam_id=e.id and q.is_active=true),
         (select coalesce(sum(q.points),0)::numeric from public.buklod_quiz_questions q where q.exam_id=e.id and q.is_active=true),
         (select count(*)::int from public.buklod_quiz_sections s where s.exam_id=e.id and s.archived_at is null),
         (select count(*)::int from public.buklod_quiz_attempts a where a.exam_id=e.id and a.status<>'VOID'),
         (select count(*)::int from public.buklod_quiz_attempts a where a.exam_id=e.id and a.status='RELEASED'),
         (select count(*)::int from public.buklod_quiz_live_sessions ls where ls.exam_id=e.id and ls.status<>'ENDED'),
         e.archived_at,e.created_at,e.updated_at
  from public.buklod_quiz_exams e
  where e.owner_user_id=(select auth.uid())
  order by (e.archived_at is not null),e.updated_at desc,e.created_at desc;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_preview_v1(p_exam_id uuid)
 RETURNS TABLE(question_id uuid, question_no integer, question_type text, prompt text, options jsonb, points numeric, correct_answer text, explanation text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.id,row_number() over(order by q.sort_order,q.id)::int,q.question_type,q.prompt,q.options,q.points,
         case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer#>>'{}' else q.correct_answer::text end,
         q.explanation
  from public.buklod_quiz_questions q
  join public.buklod_quiz_exams e on e.id=q.exam_id
  where q.exam_id=p_exam_id and q.is_active=true and e.owner_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
  order by q.sort_order,q.id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_sections_v1(p_exam_id uuid)
 RETURNS TABLE(section_id uuid, section_name text, sort_order integer, active_students bigint, active_session_id uuid, active_join_code text, active_session_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    sx.id,
    sx.name,
    sx.sort_order,
    count(r.id) filter (where r.status = 'ACTIVE')::bigint,
    live.id,
    live.join_code,
    live.status
  from public.buklod_quiz_exams e
  join public.buklod_quiz_sections sx
    on sx.exam_id = e.id
   and sx.archived_at is null
  left join public.buklod_quiz_roster r
    on r.exam_id = e.id
   and r.section_id = sx.id
  left join lateral (
    select ls.id, ls.join_code, ls.status
    from public.buklod_quiz_live_sessions ls
    where ls.exam_id = e.id
      and ls.section_id = sx.id
      and ls.faculty_user_id = (select auth.uid())
      and ls.status <> 'ENDED'
    order by ls.created_at desc
    limit 1
  ) live on true
  where e.id = p_exam_id
    and e.owner_user_id = (select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
  group by sx.id, sx.name, sx.sort_order, live.id, live.join_code, live.status
  order by sx.sort_order, lower(sx.name), sx.id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_sections_v2(p_exam_id uuid)
 RETURNS TABLE(section_id uuid, section_name text, sort_order integer, roster_count bigint, active_roster_count bigint, current_session_id uuid, join_code text, live_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id,s.name,s.sort_order,
         (select count(*) from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=s.id),
         (select count(*) from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=s.id and r.status='ACTIVE'),
         ls.id,ls.join_code,ls.status
  from public.buklod_quiz_sections s
  left join lateral (
    select x.id,x.join_code,x.status from public.buklod_quiz_live_sessions x
    where x.exam_id=p_exam_id and x.section_id=s.id and x.status<>'ENDED'
    order by x.created_at desc limit 1
  ) ls on true
  where s.exam_id=p_exam_id and s.archived_at is null
    and exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=(select auth.uid()))
  order by s.sort_order,lower(s.name),s.id;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_exam_security_settings_v1(p_exam_id uuid)
 RETURNS TABLE(security_preset text, device_policy text, behavior_monitoring boolean, offline_security_mode text, default_live_join_policy text, integrity_mode text, require_fullscreen_web boolean, block_screen_capture boolean, randomize_questions boolean, randomize_choices boolean, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    e.security_preset,e.device_policy,e.behavior_monitoring,e.offline_security_mode,
    e.default_live_join_policy,e.integrity_mode,e.require_fullscreen_web,e.block_screen_capture,
    e.randomize_questions,e.randomize_choices,e.one_question_at_a_time,e.no_backtracking
  from public.buklod_quiz_exams e
  where e.id=p_exam_id
    and e.owner_user_id=(select auth.uid())
    and public.buklod_quiz_is_examiner((select auth.uid()))
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_examiner_access_status_v1()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role boolean := false;
  v_entitlement boolean := false;
  v_class_admin boolean := false;
  v_focus_admin boolean := false;
  v_system boolean := false;
  v_cfg public.buklod_focus_app_subscription_config%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select exists(
    select 1 from public.buklod_quiz_examiner_roles r
    where r.user_id=v_uid and r.is_active=true
  ) into v_role;

  select exists(
    select 1 from public.buklod_user_focus_app_entitlements e
    where e.user_id=v_uid
      and lower(e.focus_app_code)='faculty'
      and e.status='ACTIVE'
      and (e.expires_at is null or e.expires_at>now())
  ) into v_entitlement;

  select exists(
    select 1 from public.buklod_education_classrooms c
    where c.faculty_user_id=v_uid
      and upper(coalesce(c.status,''))='ACTIVE'
  ) into v_class_admin;

  select exists(
    select 1 from public.buklod_focus_app_admins a
    where a.user_id=v_uid and lower(a.focus_app_code)='faculty'
  ) into v_focus_admin;

  v_system := public.buklod_quiz_is_system_admin();

  select * into v_cfg
  from public.buklod_focus_app_subscription_config
  where focus_app_code='faculty'
  limit 1;

  return jsonb_build_object(
    'can_conduct', v_system or (v_role and v_entitlement and (v_class_admin or v_focus_admin)),
    'is_system_admin', v_system,
    'has_examiner_role', v_role,
    'faculty_entitlement_active', v_entitlement,
    'faculty_admin_ready', (v_class_admin or v_focus_admin),
    'owns_active_faculty_classroom', v_class_admin,
    'explicit_focus_app_admin', v_focus_admin,
    'focus_app_code', 'faculty',
    'display_name', coalesce(v_cfg.display_name,'BUKLOD Faculty'),
    'annual_amount_php', v_cfg.annual_amount_php,
    'billing_interval', v_cfg.billing_interval,
    'purchase_route', '/profile/focus-apps',
    'examiner_requires', 'ACTIVE_FACULTY_FOCUS_APP_PLUS_FACULTY_ADMIN',
    'system_admin_emergency_bypass', true
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    p_user is not null
    and exists (
      select 1
      from public.buklod_user_focus_app_entitlements e
      where e.user_id = p_user
        and lower(e.focus_app_code) = 'faculty'
        and e.status = 'ACTIVE'
        and (e.expires_at is null or e.expires_at > now())
    )
    and (
      exists (
        select 1
        from public.buklod_education_classrooms c
        where c.faculty_user_id = p_user
          and upper(coalesce(c.status,'')) = 'ACTIVE'
      )
      or exists (
        select 1
        from public.buklod_focus_app_admins a
        where a.user_id = p_user
          and lower(a.focus_app_code) = 'faculty'
      )
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_deduction_rules_v1()
 RETURNS TABLE(event_type text, violation_label text, points_per_occurrence numeric, note_template text, is_enabled boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with kinds(event_type,violation_label,sort_order) as (
    values
      ('TAB_HIDDEN'::text,'Left / backgrounded / switched away from exam'::text,1),
      ('USER_LEFT_EXAM','Used Leave Exam',2),
      ('WINDOW_BLUR','Exam window lost focus',3),
      ('FULLSCREEN_EXIT','Exited fullscreen',4),
      ('SCREENSHOT_ATTEMPT','Screenshot attempt',5),
      ('SCREEN_CAPTURE_DETECTED','Screen capture detected',6),
      ('COPY_ATTEMPT','Copy attempt',7),
      ('CONTEXT_MENU_ATTEMPT','Right-click / context-menu attempt',8),
      ('DEVTOOLS_SHORTCUT_ATTEMPT','Developer-tools shortcut attempt',9)
  )
  select k.event_type,k.violation_label,coalesce(r.points_per_occurrence,0)::numeric,r.note_template,coalesce(r.is_enabled,false)
  from kinds k
  left join public.buklod_quiz_integrity_deduction_rules r
    on r.owner_user_id=(select auth.uid()) and r.event_type=k.event_type
  where (select auth.uid()) is not null
  order by k.sort_order
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_audit_v1(p_limit integer DEFAULT 200)
 RETURNS TABLE(audit_id uuid, created_at timestamp with time zone, action text, exam_id uuid, exam_title text, section_id uuid, live_session_id uuid, attempt_id uuid, details jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id,a.created_at,a.action,a.exam_id,e.title,a.section_id,a.live_session_id,a.attempt_id,a.details
  from public.buklod_quiz_audit_log a
  left join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.actor_user_id=(select auth.uid())
     or (e.owner_user_id=(select auth.uid()) and public.buklod_quiz_is_examiner((select auth.uid())))
  order by a.created_at desc,a.id desc
  limit greatest(1,least(coalesce(p_limit,200),500))
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_live_room_v1(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, join_code text, live_status text, admission_mode text, allow_late_join boolean, student_user_id uuid, display_name text, member_status text, joined_at timestamp with time zone, attempt_id uuid, attempt_status text, answered_count integer, total_questions integer, total_score numeric, max_score numeric, released_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    ls.id,
    ls.exam_id,
    e.title,
    ls.join_code,
    ls.status,
    ls.admission_mode,
    ls.allow_late_join,
    lm.student_user_id,
    coalesce(
      public.buklod_quiz_profile_display_name_v1(lm.student_user_id),
      nullif(trim(ro.display_name), ''),
      nullif(trim(lm.display_name), ''),
      'BUKLOD Student'
    )::text,
    lm.status,
    lm.joined_at,
    a.id,
    a.status,
    coalesce(ans.answered_count, 0)::integer,
    q.total_questions::integer,
    a.total_score,
    a.max_score,
    a.released_at
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id = ls.exam_id
  join public.buklod_quiz_live_members lm
    on lm.session_id = ls.id
   and lm.status in ('WAITING','ADMITTED')
  left join public.buklod_quiz_roster ro
    on ro.exam_id = ls.exam_id
   and ro.section_id = ls.section_id
   and ro.student_user_id = lm.student_user_id
  left join public.profiles p on p.id = lm.student_user_id
  left join lateral (
    select x.*
    from public.buklod_quiz_attempts x
    where x.exam_id = ls.exam_id
      and x.section_id = ls.section_id
      and x.student_user_id = lm.student_user_id
      and x.status <> 'VOID'
      and (x.live_session_id = ls.id or x.live_session_id is null)
    order by (x.live_session_id = ls.id) desc, x.attempt_no desc
    limit 1
  ) a on true
  left join lateral (
    select count(*) filter (
      where rr.answer is not null
        and nullif(trim(coalesce(rr.answer #>> '{}', '')), '') is not null
    )::integer as answered_count
    from public.buklod_quiz_responses rr
    where rr.attempt_id = a.id
  ) ans on true
  left join lateral (
    select count(*)::integer as total_questions
    from public.buklod_quiz_questions qq
    where qq.exam_id = ls.exam_id and qq.is_active = true
  ) q on true
  where ls.id = p_session_id
    and ls.faculty_user_id = (select auth.uid())
  order by
    lower(coalesce(nullif(trim(p.surname), ''), ro.surname, '')),
    lower(coalesce(nullif(trim(p.first_name), ''), ro.first_name, '')),
    lower(coalesce(public.buklod_quiz_profile_display_name_v1(lm.student_user_id), ro.display_name, lm.display_name, '')),
    lm.student_user_id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_event_v1(p_attempt_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(violation_count integer, violation_limit integer, action text, attempt_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_type text := upper(trim(coalesce(p_event_type,'')));
  v_count integer;
  v_action text := 'LOGGED';
  v_is_violation boolean;
  v_is_new_incident boolean := true;
  v_score_version integer := 1;
  v_weight integer := 1;
  v_window interval := interval '750 milliseconds';
begin
  select aa.* into a
  from public.buklod_quiz_attempts aa
  where aa.id=p_attempt_id
    and aa.student_user_id=auth.uid()
    and aa.status='STARTED'
  for update;

  if a.id is null then raise exception 'Attempt is not active.'; end if;

  select ee.* into e
  from public.buklod_quiz_exams ee
  where ee.id=a.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  if v_type not in (
    'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
    'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
  ) then
    raise exception 'Unsupported integrity event.';
  end if;

  if coalesce(a.security_snapshot->>'integrity_scoring_version','') ~ '^[0-9]+$' then
    v_score_version := (a.security_snapshot->>'integrity_scoring_version')::int;
  end if;

  if v_score_version >= 2 then
    case v_type
      when 'WINDOW_BLUR' then v_weight:=1; v_window:=interval '15 seconds';
      when 'TAB_HIDDEN' then v_weight:=2; v_window:=interval '10 seconds';
      when 'APP_EXIT_OR_BACKGROUND' then v_weight:=2; v_window:=interval '10 seconds';
      when 'USER_LEFT_EXAM' then v_weight:=2; v_window:=interval '10 seconds';
      when 'CONTEXT_MENU_ATTEMPT' then v_weight:=1; v_window:=interval '10 seconds';
      when 'COPY_ATTEMPT' then v_weight:=2; v_window:=interval '10 seconds';
      when 'FULLSCREEN_EXIT' then v_weight:=2; v_window:=interval '10 seconds';
      when 'SCREENSHOT_ATTEMPT' then v_weight:=3; v_window:=interval '10 seconds';
      when 'SCREEN_CAPTURE_DETECTED' then v_weight:=3; v_window:=interval '10 seconds';
      when 'DEVTOOLS_SHORTCUT_ATTEMPT' then v_weight:=3; v_window:=interval '10 seconds';
      else v_weight:=1; v_window:=interval '10 seconds';
    end case;

    if v_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM') then
      v_is_new_incident := not exists(
        select 1 from public.buklod_quiz_events ev
        where ev.attempt_id=a.id
          and ev.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM')
          and ev.created_at >= now()-v_window
          and coalesce((ev.event_data->>'incident_counted')::boolean,true)=true
      );
    else
      v_is_new_incident := not exists(
        select 1 from public.buklod_quiz_events ev
        where ev.attempt_id=a.id
          and ev.event_type=v_type
          and ev.created_at >= now()-v_window
          and coalesce((ev.event_data->>'incident_counted')::boolean,true)=true
      );
    end if;
  else
    if v_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND') then
      v_is_new_incident := not exists(
        select 1 from public.buklod_quiz_events ev
        where ev.attempt_id=a.id
          and ev.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND')
          and ev.created_at >= now()-interval '5 seconds'
      );
    elsif v_type in (
      'USER_LEFT_EXAM','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT',
      'SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
    ) then
      v_is_new_incident := not exists(
        select 1 from public.buklod_quiz_events ev
        where ev.attempt_id=a.id
          and ev.event_type=v_type
          and ev.created_at >= now()-interval '750 milliseconds'
      );
    end if;
  end if;

  insert into public.buklod_quiz_events(
    attempt_id,student_user_id,event_type,event_data
  ) values(
    a.id,auth.uid(),v_type,
    coalesce(p_event_data,'{}'::jsonb)
      || jsonb_build_object(
        'server_time',now(),
        'integrity_mode',e.integrity_mode,
        'integrity_scoring_version',v_score_version,
        'incident_weight',case when v_score_version>=2 then v_weight else 1 end,
        'incident_counted',v_is_new_incident,
        'server_auto_submit_disabled',true,
        'strict_capture_r9_2',true
      )
  );

  v_is_violation := e.integrity_mode<>'OFF';
  if not v_is_violation then
    return query
    select a.integrity_violation_count,e.integrity_violation_limit,'IGNORED'::text,a.status;
    return;
  end if;

  if v_is_new_incident then
    update public.buklod_quiz_attempts aa
    set integrity_violation_count=coalesce(aa.integrity_violation_count,0)+case when v_score_version>=2 then v_weight else 1 end,
        integrity_flagged_at=coalesce(aa.integrity_flagged_at,now()),
        integrity_last_event_at=now(),
        updated_at=now()
    where aa.id=a.id
    returning aa.integrity_violation_count into v_count;
  else
    v_count := coalesce(a.integrity_violation_count,0);
  end if;

  v_action := case
    when e.integrity_mode='MONITOR' then 'FLAGGED'
    when e.integrity_mode='STRICT' then 'WARNING'
    else 'LOGGED'
  end;

  return query
  select v_count,e.integrity_violation_limit,v_action,'STARTED'::text;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_live_room_v2(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, admission_mode text, allow_late_join boolean, student_user_id uuid, surname text, first_name text, display_name text, member_status text, joined_at timestamp with time zone, attempt_id uuid, attempt_status text, answered_count integer, total_questions integer, total_score numeric, max_score numeric, score_percent numeric, integrity_events integer, released_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    ls.id,ls.exam_id,ls.section_id,sec.name,e.title,ls.join_code,ls.status,ls.admission_mode,ls.allow_late_join,
    m.student_user_id,p.surname,p.first_name,
    coalesce(nullif(p.full_name,''),trim(concat_ws(' ',p.first_name,p.surname)),'BUKLOD Student'),
    m.status,m.joined_at,a.id,a.status,
    coalesce((select count(*)::int from public.buklod_quiz_responses r where r.attempt_id=a.id and r.answer is not null),0),
    coalesce((select count(*)::int from public.buklod_quiz_questions q where q.exam_id=ls.exam_id and q.is_active=true),0),
    a.total_score,a.max_score,
    case when a.max_score>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end,
    case when a.id is null then 0 else private.buklod_quiz_canonical_integrity_count_v1(a.id) end,
    a.released_at
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_exams e on e.id=ls.exam_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id
  join public.buklod_quiz_live_members m on m.session_id=ls.id
  left join public.profiles p on p.id=m.student_user_id
  left join lateral (
    select x.*
    from public.buklod_quiz_attempts x
    where x.live_session_id=ls.id and x.student_user_id=m.student_user_id and x.status<>'VOID'
    order by x.attempt_no desc
    limit 1
  ) a on true
  where ls.id=p_session_id
    and ls.faculty_user_id=(select auth.uid())
    and m.status<>'REMOVED'
  order by lower(coalesce(p.surname,p.full_name,'')),lower(coalesce(p.first_name,'')),m.joined_at
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_faculty_released_results_v1(p_limit integer DEFAULT 500)
 RETURNS TABLE(attempt_id uuid, exam_id uuid, exam_title text, section_id uuid, section_name text, student_user_id uuid, student_name text, student_no text, attempt_no integer, total_score numeric, max_score numeric, score_percent numeric, released_at timestamp with time zone, integrity_events integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id as attempt_id,
    e.id as exam_id,
    e.title as exam_title,
    s.id as section_id,
    s.name as section_name,
    a.student_user_id,
    coalesce(
      nullif(r.display_name,''),
      nullif(concat_ws(', ', nullif(r.surname,''), nullif(r.first_name,'')),''),
      nullif(p.full_name,''),
      'BUKLOD Student'
    ) as student_name,
    r.student_no,
    a.attempt_no,
    a.total_score,
    a.max_score,
    case
      when coalesce(a.max_score,0) > 0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score)
      else null::numeric
    end as score_percent,
    a.released_at,
    coalesce(a.integrity_violation_count,0) as integrity_events
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  left join public.buklod_quiz_sections s on s.id=a.section_id
  left join public.buklod_quiz_roster r
    on r.exam_id=a.exam_id
   and r.section_id is not distinct from a.section_id
   and r.student_user_id=a.student_user_id
  left join public.profiles p on p.id=a.student_user_id
  where e.owner_user_id=auth.uid()
    and a.status='RELEASED'
    and a.released_at is not null
    and (
      public.buklod_quiz_is_system_admin()
      or public.buklod_quiz_faculty_focus_admin_eligible_v1(auth.uid())
    )
  order by a.released_at desc, e.title, s.sort_order nulls last, student_name
  limit greatest(1,least(coalesce(p_limit,500),2000));
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_finalize_attempt_v1(p_attempt_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$begin if not exists(select 1 from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id where a.id=p_attempt_id and e.owner_user_id=auth.uid())then raise exception 'Unauthorized attempt.';end if;if exists(select 1 from public.buklod_quiz_responses where attempt_id=p_attempt_id and needs_review and manual_score is null)then raise exception 'Manual review is incomplete.';end if;perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);return true;end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_guard_live_question_delete_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- A question bank DELETE is intentionally converted into a safe removal.
  -- The row is retained so old attempts and immutable live snapshots keep
  -- their historical question id, wording, scoring and audit chain intact.
  update public.buklod_quiz_questions q
     set is_active=false,
         updated_at=now()
   where q.id=old.id
     and q.is_active=true;
  return null;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_event_v1(p_attempt_id uuid, p_event_type text, p_event_data jsonb, p_device_token text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  a public.buklod_quiz_attempts%rowtype;
  e public.buklod_quiz_exams%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  v_behavior boolean;
  v_weight integer:=0;
  v_type text:=upper(btrim(coalesce(p_event_type,'')));
  v_recent boolean;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=v_actor and x.status='STARTED';
  if a.id is null then raise exception 'Attempt is not active.'; end if;
  if a.expires_at<=now() then return a.integrity_incident_count; end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=a.exam_id;
  if a.live_session_id is not null then
    select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id;
  end if;

  perform public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'INTEGRITY_EVENT');

  v_behavior:=coalesce((a.security_snapshot->>'behavior_monitoring')::boolean,s.behavior_monitoring,e.behavior_monitoring,true);
  if not v_behavior then return a.integrity_incident_count; end if;

  if v_type in ('FOCUS_LOST','WINDOW_BLUR','TAB_HIDDEN','APP_BACKGROUND') then v_weight:=1;
  elsif v_type in ('FULLSCREEN_EXIT','DEVTOOLS_SUSPECTED','COPY_ATTEMPT','PASTE_ATTEMPT','PRINTSCREEN','SCREENSHOT_ATTEMPT') then v_weight:=2;
  elsif v_type in ('DEVICE_CHANGED','SECOND_DEVICE','MULTIPLE_ACTIVE_DEVICES') then v_weight:=3;
  else v_weight:=0;
  end if;
  if v_weight=0 then return a.integrity_incident_count; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=v_actor and x.status='STARTED'
  for update;
  if a.id is null then raise exception 'Attempt is not active.'; end if;
  if a.expires_at<=now() then return a.integrity_incident_count; end if;

  select exists(
    select 1 from public.buklod_quiz_events ev
    where ev.attempt_id=a.id and ev.event_type=v_type
      and ev.created_at>=now()-case
        when v_type in ('FOCUS_LOST','WINDOW_BLUR','TAB_HIDDEN','APP_BACKGROUND') then interval '5 seconds'
        else interval '2 seconds'
      end
  ) into v_recent;

  if v_recent then
    update public.buklod_quiz_attempts x
       set last_client_seen_at=now(),updated_at=now()
     where x.id=a.id
       and (x.last_client_seen_at is null or x.last_client_seen_at<now()-interval '15 seconds');
    return a.integrity_incident_count;
  end if;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,v_actor,v_type,coalesce(p_event_data,'{}'::jsonb));

  update public.buklod_quiz_attempts x set
    integrity_incident_count=integrity_incident_count+v_weight,
    last_integrity_event_at=now(),
    last_client_seen_at=now(),
    updated_at=now()
  where x.id=a.id
  returning x.integrity_incident_count into a.integrity_incident_count;

  return a.integrity_incident_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_incident_count_v1(p_attempt_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(sum(x.event_count),0)::integer
  from public.buklod_quiz_integrity_incident_rows_v1(p_attempt_id) x
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_incident_rows_v1(p_attempt_id uuid)
 RETURNS TABLE(event_type text, violation_label text, event_count integer, first_event_at timestamp with time zone, last_event_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with allowed as (
    select a.id
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_exams e on e.id=a.exam_id
    where a.id=p_attempt_id
      and (
        a.student_user_id=(select auth.uid())
        or (
          e.owner_user_id=(select auth.uid())
          and public.buklod_quiz_is_examiner((select auth.uid()))
        )
      )
  ), raw as (
    select ev.event_type,ev.created_at,
      case when ev.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND')
           then 'TAB_HIDDEN' else ev.event_type end as canonical_type
    from public.buklod_quiz_events ev
    join allowed a on a.id=ev.attempt_id
    where ev.event_type in (
      'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
      'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
    )
  ), vis as (
    select created_at,
           lag(created_at) over(order by created_at) as prev_at
    from raw
    where canonical_type='TAB_HIDDEN'
  ), vis_marks as (
    select created_at,
           case when prev_at is null or created_at-prev_at > interval '5 seconds' then 1 else 0 end as starts_incident
    from vis
  ), vis_summary as (
    select
      'TAB_HIDDEN'::text as event_type,
      'Left / backgrounded / switched away from exam'::text as violation_label,
      coalesce(sum(starts_incident),0)::integer as event_count,
      min(created_at) as first_event_at,
      max(created_at) as last_event_at
    from vis_marks
    having count(*)>0
  ), other_summary as (
    select
      canonical_type as event_type,
      case canonical_type
        when 'USER_LEFT_EXAM' then 'Used Leave Exam'
        when 'WINDOW_BLUR' then 'Exam window lost focus'
        when 'FULLSCREEN_EXIT' then 'Exited fullscreen'
        when 'SCREENSHOT_ATTEMPT' then 'Screenshot attempt'
        when 'SCREEN_CAPTURE_DETECTED' then 'Screen capture detected'
        when 'COPY_ATTEMPT' then 'Copy attempt'
        when 'CONTEXT_MENU_ATTEMPT' then 'Right-click / context-menu attempt'
        when 'DEVTOOLS_SHORTCUT_ATTEMPT' then 'Developer-tools shortcut attempt'
        else canonical_type
      end as violation_label,
      count(*)::integer as event_count,
      min(created_at) as first_event_at,
      max(created_at) as last_event_at
    from raw
    where canonical_type<>'TAB_HIDDEN'
    group by canonical_type
  )
  select * from vis_summary
  union all
  select * from other_summary
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_is_system_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v boolean:=false; begin
  if to_regprocedure('public.is_system_admin()') is not null then execute 'select public.is_system_admin()' into v; end if;
  return coalesce(v,false);
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_metrics_v1(p_attempt_id uuid)
 RETURNS TABLE(departure_incidents integer, raw_integrity_signals integer, return_events integer, copy_attempts integer, screen_capture_signals integer, devtools_attempts integer, context_menu_attempts integer, fullscreen_exits integer, max_absence_seconds numeric, avg_absence_seconds numeric, burst_departures integer, attempt_minutes numeric, distinct_signal_types integer, cheating_risk_pct integer, leakage_risk_pct integer, confidence_pct integer, evidence jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with a as (
  select x.id,x.started_at,x.submitted_at,x.status
  from public.buklod_quiz_attempts x
  where x.id=p_attempt_id
), dep_raw as (
  select ev.created_at
  from public.buklod_quiz_events ev
  where ev.attempt_id=p_attempt_id
    and ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT')
), dep_mark as (
  select created_at,
         case when lag(created_at) over(order by created_at) is null
                   or created_at-lag(created_at) over(order by created_at) > interval '5 seconds'
              then 1 else 0 end as new_group
  from dep_raw
), dep_labeled as (
  select created_at,
         sum(new_group) over(order by created_at rows unbounded preceding) as grp
  from dep_mark
), dep_groups as (
  select grp,min(created_at) as first_at,max(created_at) as last_at
  from dep_labeled
  group by grp
), dep_seq as (
  select g.*,
         lag(g.first_at) over(order by g.first_at) as prev_first_at,
         (
           select min(r.created_at)
           from public.buklod_quiz_events r
           where r.attempt_id=p_attempt_id
             and r.event_type='APP_RETURNED'
             and r.created_at>g.last_at
         ) as returned_at
  from dep_groups g
), dep_stats as (
  select
    count(*)::integer as departure_incidents,
    count(*) filter(where prev_first_at is not null and first_at-prev_first_at<=interval '30 seconds')::integer as burst_departures,
    coalesce(max(extract(epoch from (returned_at-first_at))) filter(where returned_at is not null),0)::numeric as max_absence_seconds,
    coalesce(avg(extract(epoch from (returned_at-first_at))) filter(where returned_at is not null),0)::numeric as avg_absence_seconds
  from dep_seq
), sig as (
  select
    count(*) filter(where ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'))::integer as raw_integrity_signals,
    count(*) filter(where ev.event_type='APP_RETURNED')::integer as return_events,
    count(*) filter(where ev.event_type='COPY_ATTEMPT')::integer as copy_attempts,
    count(*) filter(where ev.event_type in ('SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED'))::integer as screen_capture_signals,
    count(*) filter(where ev.event_type='DEVTOOLS_SHORTCUT_ATTEMPT')::integer as devtools_attempts,
    count(*) filter(where ev.event_type='CONTEXT_MENU_ATTEMPT')::integer as context_menu_attempts,
    count(*) filter(where ev.event_type='FULLSCREEN_EXIT')::integer as fullscreen_exits,
    count(distinct ev.event_type) filter(where ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'))::integer as distinct_signal_types
  from public.buklod_quiz_events ev
  where ev.attempt_id=p_attempt_id
), base as (
  select
    coalesce(d.departure_incidents,0) as departure_incidents,
    coalesce(s.raw_integrity_signals,0) as raw_integrity_signals,
    coalesce(s.return_events,0) as return_events,
    coalesce(s.copy_attempts,0) as copy_attempts,
    coalesce(s.screen_capture_signals,0) as screen_capture_signals,
    coalesce(s.devtools_attempts,0) as devtools_attempts,
    coalesce(s.context_menu_attempts,0) as context_menu_attempts,
    coalesce(s.fullscreen_exits,0) as fullscreen_exits,
    coalesce(d.max_absence_seconds,0) as max_absence_seconds,
    coalesce(d.avg_absence_seconds,0) as avg_absence_seconds,
    coalesce(d.burst_departures,0) as burst_departures,
    greatest(1,extract(epoch from (coalesce(a.submitted_at,now())-a.started_at))/60)::numeric as attempt_minutes,
    coalesce(s.distinct_signal_types,0) as distinct_signal_types,
    a.status
  from a
  cross join dep_stats d
  cross join sig s
), scored as (
  select b.*,
    least(100,round(
      least(25::numeric,b.departure_incidents*0.8)
      + least(10::numeric,b.burst_departures*1.0)
      + case when b.departure_incidents/b.attempt_minutes>0.75 then 10 when b.departure_incidents/b.attempt_minutes>0.30 then 5 else 0 end
      + case when b.max_absence_seconds>=300 then 10 when b.max_absence_seconds>=120 then 6 when b.max_absence_seconds>=30 then 3 else 0 end
      + least(20::numeric,b.copy_attempts*8)
      + least(30::numeric,b.screen_capture_signals*18)
      + least(30::numeric,b.devtools_attempts*20)
      + least(8::numeric,b.context_menu_attempts*2)
    ))::integer as cheating_risk_pct,
    least(100,round(
      least(15::numeric,b.departure_incidents*0.4)
      + least(5::numeric,b.burst_departures*0.5)
      + case when b.max_absence_seconds>=300 then 10 when b.max_absence_seconds>=120 then 8 when b.max_absence_seconds>=30 then 3 else 0 end
      + least(25::numeric,b.copy_attempts*10)
      + least(45::numeric,b.screen_capture_signals*25)
      + least(30::numeric,b.devtools_attempts*15)
      + least(6::numeric,b.context_menu_attempts*1)
    ))::integer as leakage_risk_pct,
    least(95,
      35
      + least(25,b.raw_integrity_signals)
      + case when b.return_events>0 then 15 else 0 end
      + case when b.distinct_signal_types>=2 then 10 else 0 end
      + case when b.status<>'STARTED' then 10 else 0 end
    )::integer as confidence_pct
  from base b
)
select
  x.departure_incidents,x.raw_integrity_signals,x.return_events,x.copy_attempts,
  x.screen_capture_signals,x.devtools_attempts,x.context_menu_attempts,x.fullscreen_exits,
  round(x.max_absence_seconds,1),round(x.avg_absence_seconds,1),x.burst_departures,round(x.attempt_minutes,1),
  x.distinct_signal_types,x.cheating_risk_pct,x.leakage_risk_pct,x.confidence_pct,
  jsonb_build_object(
    'departure_incidents',x.departure_incidents,
    'raw_integrity_signals',x.raw_integrity_signals,
    'return_events',x.return_events,
    'burst_departures',x.burst_departures,
    'max_absence_seconds',round(x.max_absence_seconds,1),
    'avg_absence_seconds',round(x.avg_absence_seconds,1),
    'copy_attempts',x.copy_attempts,
    'screen_capture_signals',x.screen_capture_signals,
    'devtools_attempts',x.devtools_attempts,
    'context_menu_attempts',x.context_menu_attempts,
    'fullscreen_exits',x.fullscreen_exits,
    'attempt_minutes',round(x.attempt_minutes,1),
    'external_camera_direct_detection',false,
    'external_capture_protection','TRACE_WATERMARK',
    'interpretation_notice','Behavioral risk estimate only; not proof of cheating or exam leakage.'
  ) as evidence
from scored x
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v2(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, live_status text, member_status text, join_code text, can_start boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_exam public.buklod_quiz_exams%rowtype;
  v_section public.buklod_quiz_sections%rowtype;
  v_profile public.profiles%rowtype;
  v_existing public.buklod_quiz_roster%rowtype;
  v_member_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.';
  end if;

  select s.* into v_session
  from public.buklod_quiz_live_sessions s
  where upper(s.join_code)=upper(trim(p_join_code))
    and s.status<>'ENDED'
    and s.section_id is not null
  order by s.created_at desc
  limit 1;

  if v_session.id is null then
    raise exception 'Live class code is invalid, legacy, or already ended.';
  end if;

  if exists (
    select 1
    from public.buklod_quiz_live_members lm
    where lm.session_id=v_session.id
      and lm.student_user_id=(select auth.uid())
      and lm.status='REMOVED'
  ) then
    raise exception 'Faculty removed you from this live class. Ask the faculty to admit you again before rejoining.';
  end if;

  if v_session.status in ('LIVE','PAUSED') and not v_session.allow_late_join then
    raise exception 'Late joining is closed for this class.';
  end if;

  select e.* into v_exam
  from public.buklod_quiz_exams e
  where e.id=v_session.exam_id;

  select s.* into v_section
  from public.buklod_quiz_sections s
  where s.id=v_session.section_id
    and s.exam_id=v_session.exam_id;

  if v_section.id is null then
    raise exception 'Live class section is invalid.';
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.id=(select auth.uid())
    and coalesce(p.is_active,true)=true;

  if v_profile.id is null then
    raise exception 'Active BUKLOD profile not found.';
  end if;

  select r.* into v_existing
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id
    and r.student_user_id=(select auth.uid())
  limit 1;

  if v_existing.id is not null
     and v_existing.section_id<>v_section.id
     and v_existing.status in ('ACTIVE','PENDING') then
    raise exception 'You are already assigned to a different class for this exam.';
  end if;

  if v_session.admission_mode='OPEN'
     or (v_existing.id is not null and v_existing.section_id=v_section.id and v_existing.status='ACTIVE') then
    v_member_status:='ADMITTED';
  else
    v_member_status:='WAITING';
  end if;

  insert into public.buklod_quiz_live_members(
    session_id,student_user_id,status,display_name,joined_at,admitted_at,removed_at,last_seen_at
  ) values (
    v_session.id,(select auth.uid()),v_member_status,
    coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
    now(),case when v_member_status='ADMITTED' then now() else null end,null,now()
  )
  on conflict on constraint buklod_quiz_live_members_session_id_student_user_id_key
  do update set
    status=case
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.status
      else v_member_status
    end,
    display_name=excluded.display_name,
    last_seen_at=now(),
    removed_at=case
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.removed_at
      else null
    end,
    admitted_at=case
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.admitted_at
      when v_member_status='ADMITTED'
        then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      else public.buklod_quiz_live_members.admitted_at
    end;

  insert into public.buklod_quiz_roster(
    exam_id,section_id,student_user_id,student_no,surname,first_name,display_name,status
  ) values (
    v_session.exam_id,v_section.id,(select auth.uid()),null,
    coalesce(v_profile.surname,''),coalesce(v_profile.first_name,''),
    coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
    case when v_member_status='ADMITTED' then 'ACTIVE' else 'PENDING' end
  )
  on conflict on constraint buklod_quiz_roster_exam_id_student_user_id_key
  do update set
    section_id=excluded.section_id,
    surname=excluded.surname,
    first_name=excluded.first_name,
    display_name=excluded.display_name,
    status=case
      when public.buklod_quiz_roster.status='REMOVED' then 'REMOVED'
      when excluded.status='ACTIVE' then 'ACTIVE'
      when public.buklod_quiz_roster.status='ACTIVE' then 'ACTIVE'
      else 'PENDING'
    end;

  return query
  select v_session.id,v_session.exam_id,v_section.id,v_section.name,v_exam.title,
         v_session.status,
         case when exists(
           select 1 from public.buklod_quiz_live_members lm
           where lm.session_id=v_session.id
             and lm.student_user_id=(select auth.uid())
             and lm.status='REMOVED'
         ) then 'REMOVED' else v_member_status end,
         v_session.join_code,
         (v_session.status='LIVE' and v_member_status='ADMITTED');
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_rule_usage_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(event_type text, violation_label text, event_count integer, affected_students integer, eligible_attempts integer, released_attempts integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with authorized as (
    select e.id
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections sx
      on sx.exam_id=e.id
     and sx.id=p_section_id
    where e.id=p_exam_id
      and e.owner_user_id=(select auth.uid())
      and public.buklod_quiz_is_examiner((select auth.uid()))
  ),
  kinds(event_type,violation_label,sort_order) as (
    values
      ('APP_EXIT_OR_BACKGROUND'::text,'Left / backgrounded / switched away from exam'::text,1),
      ('USER_LEFT_EXAM','Used Leave Exam',2),
      ('TAB_HIDDEN','Exam tab hidden / switched tab',3),
      ('WINDOW_BLUR','Exam window lost focus',4),
      ('FULLSCREEN_EXIT','Exited fullscreen',5),
      ('SCREENSHOT_ATTEMPT','Screenshot attempt',6),
      ('SCREEN_CAPTURE_DETECTED','Screen capture detected',7),
      ('COPY_ATTEMPT','Copy attempt',8),
      ('CONTEXT_MENU_ATTEMPT','Right-click / context-menu attempt',9),
      ('DEVTOOLS_SHORTCUT_ATTEMPT','Developer-tools shortcut attempt',10)
  ),
  latest as (
    select distinct on (a.student_user_id)
      a.id,
      a.student_user_id,
      a.status
    from public.buklod_quiz_attempts a
    join authorized z on z.id=a.exam_id
    join public.buklod_quiz_roster r
      on r.exam_id=a.exam_id
     and r.section_id=a.section_id
     and r.student_user_id=a.student_user_id
     and r.status='ACTIVE'
    where a.exam_id=p_exam_id
      and a.section_id=p_section_id
      and a.status<>'VOID'
    order by a.student_user_id,a.attempt_no desc
  ),
  agg as (
    select
      ev.event_type,
      count(*)::integer as event_count,
      count(distinct l.student_user_id)::integer as affected_students,
      count(distinct l.id) filter (where l.status in ('NEEDS_REVIEW','GRADED'))::integer as eligible_attempts,
      count(distinct l.id) filter (where l.status='RELEASED')::integer as released_attempts
    from public.buklod_quiz_events ev
    join latest l on l.id=ev.attempt_id
    group by ev.event_type
  )
  select
    k.event_type,
    k.violation_label,
    coalesce(a.event_count,0)::integer,
    coalesce(a.affected_students,0)::integer,
    coalesce(a.eligible_attempts,0)::integer,
    coalesce(a.released_attempts,0)::integer
  from kinds k
  left join agg a on a.event_type=k.event_type
  order by k.sort_order
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_integrity_v2_stamp_future_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.created_at >= timestamptz '2026-09-05 09:50:00+00' then
    new.settings_snapshot := coalesce(new.settings_snapshot,'{}'::jsonb)
      || jsonb_build_object('integrity_scoring_version',2);
  end if;
  return new;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_is_examiner(p_user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.buklod_quiz_is_system_admin()
    or (
      exists (
        select 1
        from public.buklod_quiz_examiner_roles r
        where r.user_id = p_user
          and r.is_active = true
      )
      and public.buklod_quiz_faculty_focus_admin_eligible_v1(p_user)
    );
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_issue_offline_lease_v1(p_attempt_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(lease_token text, lease_expires_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select * from public.buklod_quiz_issue_offline_lease_v2(p_attempt_id,p_device_token,null)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_issue_offline_lease_v2(p_attempt_id uuid, p_device_token text DEFAULT NULL::text, p_existing_lease_token text DEFAULT NULL::text)
 RETURNS TABLE(lease_token text, lease_expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  declare
    a public.buklod_quiz_attempts%rowtype;
    v_uid uuid := (select auth.uid());
    v_token text;
    v_existing_hash text;
    v_grace timestamptz;
  begin
    if v_uid is null then raise exception 'Sign in first.'; end if;

    select x.* into a
    from public.buklod_quiz_attempts x
    where x.id=p_attempt_id
      and x.student_user_id=v_uid
    for update;

    if a.id is null then raise exception 'Attempt not found.'; end if;
    if a.status <> 'STARTED' then raise exception 'Attempt is not active.'; end if;

    v_grace := a.expires_at + interval '15 minutes';

    if nullif(btrim(coalesce(p_existing_lease_token,'')),'') is not null then
      v_existing_hash := encode(extensions.digest(p_existing_lease_token,'sha256'),'hex');
      if exists(
        select 1
        from public.buklod_quiz_offline_leases l
        where l.attempt_id=a.id
          and l.student_user_id=v_uid
          and l.lease_token_hash=v_existing_hash
          and l.used_at is null
          and l.sync_grace_expires_at > now()
      ) then
        return query select p_existing_lease_token, v_grace;
        return;
      end if;
    end if;

    if a.expires_at <= now() then
      raise exception 'Offline lease cannot be issued after the attempt expires.';
    end if;

    v_token := encode(extensions.gen_random_bytes(32),'hex');

    insert into public.buklod_quiz_offline_leases(
      attempt_id,student_user_id,lease_token_hash,issued_at,
      attempt_expires_at,sync_grace_expires_at,used_at
    )
    values(
      a.id,v_uid,encode(extensions.digest(v_token,'sha256'),'hex'),now(),
      a.expires_at,v_grace,null
    )
    on conflict (attempt_id) do update
    set student_user_id=excluded.student_user_id,
        lease_token_hash=excluded.lease_token_hash,
        issued_at=excluded.issued_at,
        attempt_expires_at=excluded.attempt_expires_at,
        sync_grace_expires_at=excluded.sync_grace_expires_at,
        used_at=null;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,v_uid,'OFFLINE_LEASE_ISSUED_V2',
      jsonb_build_object(
        'attempt_expires_at',a.expires_at,
        'sync_grace_expires_at',v_grace
      )
    );

    return query select v_token, v_grace;
  end;
  $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v1(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, live_status text, member_status text, join_code text, can_start boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_exam public.buklod_quiz_exams%rowtype;
  v_profile public.profiles%rowtype;
  v_roster public.buklod_quiz_roster%rowtype;
  v_member_status text;
begin
  if v_actor is null then
    raise exception 'Sign in first.';
  end if;

  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx
    on sx.id = ls.section_id
   and sx.exam_id = ls.exam_id
   and sx.archived_at is null
  where ls.join_code = v_code
    and ls.status <> 'ENDED'
  limit 1;

  if v_session.id is null then
    raise exception 'Live class code is invalid, deleted, or already ended.';
  end if;

  if exists (
    select 1
    from public.buklod_quiz_live_members lm
    where lm.session_id=v_session.id
      and lm.student_user_id=v_actor
      and lm.status='REMOVED'
  ) then
    raise exception 'Faculty removed you from this live class. Ask the faculty to admit you again before rejoining.';
  end if;

  if v_session.status in ('LIVE','PAUSED') and not v_session.allow_late_join then
    raise exception 'Late joining is closed for this live class.';
  end if;

  select e.* into v_exam
  from public.buklod_quiz_exams e
  where e.id = v_session.exam_id;

  select p.* into v_profile
  from public.profiles p
  where p.id = v_actor
    and coalesce(p.is_active,true) = true;

  if v_profile.id is null then
    raise exception 'Active BUKLOD profile not found.';
  end if;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id = v_session.exam_id
    and r.student_user_id = v_actor
  limit 1;

  if v_roster.id is not null and v_roster.section_id <> v_session.section_id then
    if exists (
      select 1
      from public.buklod_quiz_attempts a
      join public.buklod_quiz_live_sessions old_ls
        on old_ls.id = a.live_session_id
       and old_ls.exam_id = a.exam_id
       and old_ls.section_id = a.section_id
       and old_ls.status <> 'ENDED'
      join public.buklod_quiz_sections old_s
        on old_s.id = a.section_id
       and old_s.exam_id = a.exam_id
       and old_s.archived_at is null
      where a.exam_id = v_session.exam_id
        and a.student_user_id = v_actor
        and a.section_id <> v_session.section_id
        and a.status = 'STARTED'
    ) then
      raise exception 'You already have a started attempt in another currently active class for this exam. Ask faculty to resolve that active attempt first.';
    end if;

    update public.buklod_quiz_live_members lm
    set status = 'LEFT',
        last_seen_at = now()
    where lm.student_user_id = v_actor
      and lm.session_id in (
        select old_ls.id
        from public.buklod_quiz_live_sessions old_ls
        join public.buklod_quiz_sections old_s
          on old_s.id = old_ls.section_id
         and old_s.exam_id = old_ls.exam_id
        where old_ls.exam_id = v_session.exam_id
          and old_ls.section_id <> v_session.section_id
          and old_ls.status <> 'ENDED'
      );

    update public.buklod_quiz_roster r
    set section_id = v_session.section_id,
        status = 'PENDING'
    where r.id = v_roster.id;

    v_roster.section_id := v_session.section_id;
    v_roster.status := 'PENDING';
  end if;

  if v_session.admission_mode = 'OPEN'
     or (v_roster.id is not null and v_roster.status = 'ACTIVE') then
    v_member_status := 'ADMITTED';
  else
    v_member_status := 'WAITING';
  end if;

  insert into public.buklod_quiz_live_members(
    session_id, student_user_id, status, display_name,
    joined_at, admitted_at, removed_at, last_seen_at
  ) values (
    v_session.id, v_actor, v_member_status,
    coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
    now(),
    case when v_member_status='ADMITTED' then now() else null end,
    null,
    now()
  )
  on conflict on constraint buklod_quiz_live_members_session_id_student_user_id_key
  do update set
    status = v_member_status,
    display_name = excluded.display_name,
    last_seen_at = now(),
    removed_at = null,
    admitted_at = case
      when v_member_status='ADMITTED'
        then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      else public.buklod_quiz_live_members.admitted_at
    end;

  insert into public.buklod_quiz_roster(
    exam_id, section_id, student_user_id, student_no,
    surname, first_name, display_name, status
  ) values (
    v_session.exam_id,
    v_session.section_id,
    v_actor,
    null,
    coalesce(v_profile.surname,''),
    coalesce(v_profile.first_name,''),
    coalesce(nullif(v_profile.full_name,''),nullif(v_profile.username,''),'BUKLOD Student'),
    case when v_member_status='ADMITTED' then 'ACTIVE' else 'PENDING' end
  )
  on conflict on constraint buklod_quiz_roster_exam_id_student_user_id_key
  do update set
    section_id = excluded.section_id,
    surname = excluded.surname,
    first_name = excluded.first_name,
    display_name = excluded.display_name,
    status = case
      when excluded.status='ACTIVE' then 'ACTIVE'
      when public.buklod_quiz_roster.status='ACTIVE'
           and public.buklod_quiz_roster.section_id=excluded.section_id then 'ACTIVE'
      else 'PENDING'
    end;

  return query
  select
    v_session.id,
    v_session.exam_id,
    v_exam.title,
    v_session.status,
    v_member_status,
    v_session.join_code,
    (v_session.status='LIVE' and v_member_status='ADMITTED');
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v3(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with j as (
    select * from public.buklod_quiz_join_live_class_v1(p_join_code)
  )
  select
    j.session_id,
    j.exam_id,
    ls.section_id,
    sec.name::text,
    j.exam_title,
    j.join_code,
    j.live_status,
    j.member_status,
    ls.admission_mode,
    ls.allow_late_join,
    j.can_start,
    ls.started_at,
    ls.ended_at
  from j
  join public.buklod_quiz_live_sessions ls on ls.id=j.session_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id and sec.exam_id=j.exam_id;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_join_live_class_v4(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_section_name text;
  v_profile_full_name text; v_profile_username text; v_surname text; v_first_name text;
  v_display text;
  v_roster_id uuid; v_roster_section uuid; v_roster_status text;
  v_policy text;
  v_member text;
  v_relive_only boolean:=false;
  v_has_final_attempt boolean:=false;
  v_conflicting_active_attempt boolean:=false;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;
  if length(v_code)<4 or length(v_code)>12 then raise exception 'Enter the live class code from your faculty.'; end if;

  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.join_code=v_code and ls.status<>'ENDED'
  limit 1;
  if s.id is null then raise exception 'Live class code is invalid, deleted, or already ended.'; end if;

  v_relive_only:=coalesce((s.settings_snapshot->>'relive_only_unattempted')::boolean,false);
  select exists(
    select 1 from public.buklod_quiz_attempts a
    where a.live_session_id=s.id
      and a.student_user_id=v_actor
      and (
        a.submitted_at is not null
        or a.status in ('SUBMITTED','NEEDS_REVIEW','GRADED','RELEASED')
      )
  ) into v_has_final_attempt;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||s.exam_id::text,0));

  if exists(
    select 1 from public.buklod_quiz_live_members m
    where m.session_id=s.id and m.student_user_id=v_actor and m.status='REMOVED'
  ) and not (v_relive_only and not v_has_final_attempt) then
    raise exception 'Faculty removed you from this live class. Ask the faculty before rejoining.';
  end if;

  if s.status in ('LIVE','PAUSED') and not s.allow_late_join and not v_relive_only then
    raise exception 'Late joining is closed for this live class.';
  end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  select sx.name into v_section_name from public.buklod_quiz_sections sx where sx.id=s.section_id and sx.exam_id=s.exam_id;
  select p.full_name,p.username,p.surname,p.first_name
    into v_profile_full_name,v_profile_username,v_surname,v_first_name
  from public.profiles p where p.id=v_actor and coalesce(p.is_active,true)=true;
  if not found then raise exception 'Active BUKLOD profile not found.'; end if;
  v_display:=coalesce(nullif(v_profile_full_name,''),nullif(v_profile_username,''),'BUKLOD Student');

  select r.id,r.section_id,r.status
    into v_roster_id,v_roster_section,v_roster_status
  from public.buklod_quiz_roster r
  where r.exam_id=s.exam_id and r.student_user_id=v_actor
  limit 1;

  v_policy:=upper(coalesce(nullif(s.join_policy,''),e.default_live_join_policy,'OPEN'));

  select exists(
    select 1
    from public.buklod_quiz_attempts a
    left join public.buklod_quiz_live_sessions als on als.id=a.live_session_id
    where a.exam_id=s.exam_id
      and a.student_user_id=v_actor
      and a.status='STARTED'
      and a.expires_at>now()
      and coalesce(a.section_id,als.section_id) is distinct from s.section_id
  ) into v_conflicting_active_attempt;

  if v_roster_id is not null
     and v_roster_section<>s.section_id
     and v_roster_status in ('ACTIVE','PENDING') then
    if v_conflicting_active_attempt then
      raise exception 'You still have an active exam attempt in another class for this exam. Ask faculty to finish or resolve that attempt before joining this class.';
    elsif v_policy not in ('OPEN','APPROVAL') then
      raise exception 'You are assigned to a different class for this exam. Ask faculty to verify your class assignment.';
    end if;
  end if;

  if v_policy in ('ROSTER_ONLY','ROSTER_APPROVAL') then
    if v_roster_id is null or v_roster_section<>s.section_id or v_roster_status<>'ACTIVE' then
      raise exception 'This live class is roster-only. Your account is not on the active class roster.';
    end if;
  end if;

  v_member:=case
    when v_relive_only and not v_has_final_attempt then 'ADMITTED'
    when v_policy in ('APPROVAL','ROSTER_APPROVAL') then 'WAITING'
    else 'ADMITTED'
  end;

  insert into public.buklod_quiz_live_members(session_id,student_user_id,status,display_name,joined_at,admitted_at,removed_at,last_seen_at)
  values(s.id,v_actor,v_member,v_display,now(),case when v_member='ADMITTED' then now() else null end,null,now())
  on conflict on constraint buklod_quiz_live_members_session_id_student_user_id_key
  do update set
    status=case
      when v_relive_only and not v_has_final_attempt then 'ADMITTED'
      when public.buklod_quiz_live_members.status='REMOVED' then 'REMOVED'
      when public.buklod_quiz_live_members.status='ADMITTED' then 'ADMITTED'
      else excluded.status end,
    display_name=excluded.display_name,last_seen_at=now(),
    removed_at=case
      when v_relive_only and not v_has_final_attempt then null
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.removed_at
      else null end,
    admitted_at=case
      when v_relive_only and not v_has_final_attempt then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      when public.buklod_quiz_live_members.status='REMOVED' then public.buklod_quiz_live_members.admitted_at
      when public.buklod_quiz_live_members.status='ADMITTED' then public.buklod_quiz_live_members.admitted_at
      when excluded.status='ADMITTED' then coalesce(public.buklod_quiz_live_members.admitted_at,now())
      else public.buklod_quiz_live_members.admitted_at end;

  select m.status into v_member
  from public.buklod_quiz_live_members m
  where m.session_id=s.id and m.student_user_id=v_actor;

  if v_policy in ('OPEN','APPROVAL') or (v_relive_only and not v_has_final_attempt) then
    insert into public.buklod_quiz_roster(exam_id,section_id,student_user_id,student_no,surname,first_name,display_name,status)
    values(s.exam_id,s.section_id,v_actor,null,coalesce(v_surname,''),coalesce(v_first_name,''),v_display,
           case when v_member='ADMITTED' then 'ACTIVE' else 'PENDING' end)
    on conflict on constraint buklod_quiz_roster_exam_id_student_user_id_key
    do update set
      section_id=excluded.section_id,
      surname=excluded.surname,
      first_name=excluded.first_name,
      display_name=excluded.display_name,
      status=case
        when v_relive_only and not v_has_final_attempt then 'ACTIVE'
        when public.buklod_quiz_roster.status='REMOVED' then 'REMOVED'
        when excluded.status='ACTIVE' then 'ACTIVE'
        when public.buklod_quiz_roster.status='ACTIVE' then 'ACTIVE'
        else 'PENDING'
      end;
  end if;

  return query
  select s.id,s.exam_id,s.section_id,v_section_name,e.title,s.join_code,s.status,v_member,
    s.admission_mode,s.allow_late_join,
    (s.status='LIVE' and v_member='ADMITTED' and not (v_relive_only and v_has_final_attempt)),
    s.started_at,s.ended_at;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v1(p_session_id uuid, p_action text, p_student_user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_action text := upper(trim(coalesce(p_action, '')));
  v_count integer := 0;
  v_row record;
begin
  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  where ls.id = p_session_id
    and ls.faculty_user_id = (select auth.uid());
  if v_session.id is null then raise exception 'Live class not found or unauthorized.'; end if;

  if v_action in ('ADMIT', 'ADMIT_ALL') then
    update public.buklod_quiz_live_members lm
    set status = 'ADMITTED', admitted_at = coalesce(admitted_at, now()),
        removed_at = null, last_seen_at = now()
    where lm.session_id = p_session_id
      and lm.status in ('WAITING', 'REMOVED', 'LEFT')
      and (p_student_user_ids is null or lm.student_user_id = any(p_student_user_ids));
    get diagnostics v_count = row_count;

    update public.buklod_quiz_roster r
    set status = 'ACTIVE'
    where r.exam_id = v_session.exam_id
      and r.section_id = v_session.section_id
      and exists (
        select 1 from public.buklod_quiz_live_members lm
        where lm.session_id = p_session_id
          and lm.student_user_id = r.student_user_id
          and lm.status = 'ADMITTED'
      )
      and (p_student_user_ids is null or r.student_user_id = any(p_student_user_ids));
    return v_count;

  elsif v_action in ('REMOVE', 'REMOVE_SELECTED') then
    update public.buklod_quiz_live_members lm
    set status = 'REMOVED', removed_at = now(), last_seen_at = now()
    where lm.session_id = p_session_id
      and lm.status <> 'REMOVED'
      and (p_student_user_ids is null or lm.student_user_id = any(p_student_user_ids));
    get diagnostics v_count = row_count;

    update public.buklod_quiz_roster r
    set status = 'REMOVED'
    where r.exam_id = v_session.exam_id
      and r.section_id = v_session.section_id
      and exists (
        select 1 from public.buklod_quiz_live_members lm
        where lm.session_id = p_session_id
          and lm.student_user_id = r.student_user_id
          and lm.status = 'REMOVED'
      )
      and (p_student_user_ids is null or r.student_user_id = any(p_student_user_ids));
    return v_count;

  elsif v_action in ('FORCE_SUBMIT', 'FORCE_SUBMIT_ALL') then
    for v_row in
      select a.id, a.student_user_id
      from public.buklod_quiz_attempts a
      where a.live_session_id = p_session_id
        and a.exam_id = v_session.exam_id
        and a.section_id = v_session.section_id
        and a.status = 'STARTED'
        and exists (
          select 1 from public.buklod_quiz_live_members lm
          where lm.session_id = p_session_id
            and lm.student_user_id = a.student_user_id
            and lm.status = 'ADMITTED'
        )
        and (p_student_user_ids is null or a.student_user_id = any(p_student_user_ids))
    loop
      insert into public.buklod_quiz_responses(attempt_id, question_id, student_user_id, answer)
      select v_row.id, q.id, v_row.student_user_id, null
      from public.buklod_quiz_questions q
      where q.exam_id = v_session.exam_id and q.is_active = true
      on conflict do nothing;
      perform public.buklod_quiz_compute_attempt_internal(v_row.id);
      insert into public.buklod_quiz_events(attempt_id, student_user_id, event_type, event_data)
      values (
        v_row.id, v_row.student_user_id, 'FACULTY_FORCE_SUBMIT',
        jsonb_build_object(
          'faculty_user_id', (select auth.uid()),
          'live_session_id', p_session_id,
          'section_id', v_session.section_id
        )
      );
      v_count := v_count + 1;
    end loop;
    return v_count;

  elsif v_action in ('RELEASE_RESULTS', 'RELEASE_ALL') then
    update public.buklod_quiz_attempts a
    set status = 'RELEASED', released_at = now(), updated_at = now()
    where a.live_session_id = p_session_id
      and a.exam_id = v_session.exam_id
      and a.section_id = v_session.section_id
      and a.status = 'GRADED'
      and (p_student_user_ids is null or a.student_user_id = any(p_student_user_ids));
    get diagnostics v_count = row_count;
    return v_count;

  elsif v_action in ('RESET_ATTEMPT', 'RESET_SELECTED') then
    for v_row in
      select distinct on (a.student_user_id) a.id, a.student_user_id
      from public.buklod_quiz_attempts a
      where a.live_session_id = p_session_id
        and a.exam_id = v_session.exam_id
        and a.section_id = v_session.section_id
        and a.status <> 'VOID'
        and (p_student_user_ids is null or a.student_user_id = any(p_student_user_ids))
      order by a.student_user_id, a.attempt_no desc
    loop
      update public.buklod_quiz_attempts
      set status = 'VOID', updated_at = now()
      where id = v_row.id;
      insert into public.buklod_quiz_events(attempt_id, student_user_id, event_type, event_data)
      values (
        v_row.id, v_row.student_user_id, 'FACULTY_RESET_ATTEMPT',
        jsonb_build_object(
          'faculty_user_id', (select auth.uid()),
          'live_session_id', p_session_id,
          'section_id', v_session.section_id
        )
      );
      v_count := v_count + 1;
    end loop;
    return v_count;
  else
    raise exception 'Unsupported bulk action.';
  end if;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_control_v1(p_session_id uuid, p_action text)
 RETURNS TABLE(session_id uuid, live_status text, join_code text, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select x.session_id,x.live_status,x.join_code,x.started_at,x.ended_at
  from public.buklod_quiz_live_control_v3(p_session_id,p_action) x
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_control_v2(p_session_id uuid, p_action text)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, live_status text, join_code text, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select * from public.buklod_quiz_live_control_v3(p_session_id,p_action)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v2(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select * from public.buklod_quiz_live_start_attempt_v3(p_session_id,null)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_bulk_action_v2(p_session_id uuid, p_action text, p_student_user_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.buklod_quiz_live_bulk_action_v1(p_session_id,p_action,p_student_user_ids);
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3_core(p_session_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  r public.buklod_quiz_roster%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  n integer;
  v_used integer;
  v_bonus integer:=0;
  v_max integer;
  v_duration integer;
  v_gap numeric;
  v_relive_only boolean:=false;
begin
  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_live_members m on m.session_id=ls.id
  where ls.id=p_session_id
    and ls.status='LIVE'
    and m.student_user_id=v_actor
    and m.status='ADMITTED';

  if s.id is null then raise exception 'Your class live session is not open for an exam attempt.'; end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id and x.status='PUBLISHED';
  if e.id is null then raise exception 'Exam is not published.'; end if;

  select x.* into r from public.buklod_quiz_roster x
  where x.exam_id=e.id and x.section_id=s.section_id and x.student_user_id=v_actor and x.status='ACTIVE';
  if r.id is null then raise exception 'You are not admitted to this class exam.'; end if;

  if not exists(select 1 from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id) then
    perform public.buklod_quiz_snapshot_live_session_v1(s.id);
    select x.* into s from public.buklod_quiz_live_sessions x where x.id=s.id;
  end if;

  v_relive_only:=coalesce((s.settings_snapshot->>'relive_only_unattempted')::boolean,false);

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=s.id and x.student_user_id=v_actor and x.status='STARTED'
  order by x.attempt_no desc limit 1;

  v_duration:=coalesce(s.duration_minutes,e.duration_minutes);
  v_max:=coalesce(s.max_attempts,e.max_attempts);

  select coalesce(al.bonus_attempts,0) into v_bonus
  from public.buklod_quiz_attempt_allowances al
  where al.live_session_id=s.id and al.student_user_id=v_actor;
  v_bonus:=coalesce(v_bonus,0);

  if a.id is not null and (a.expires_at>now() or v_relive_only) then
    if v_relive_only and a.expires_at<=now() then
      update public.buklod_quiz_attempts x
      set expires_at=now()+make_interval(mins=>v_duration),updated_at=now(),last_client_seen_at=now()
      where x.id=a.id
      returning * into a;

      insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
      values(a.id,v_actor,'RELIVE_UNFINISHED_ATTEMPT_RESUMED',
        jsonb_build_object('live_session_id',s.id,'section_id',s.section_id,'duration_minutes',v_duration));
    end if;

    perform public.buklod_quiz_seed_attempt_questions_v2(a.id);
    if coalesce(s.behavior_monitoring,e.behavior_monitoring,true) and a.last_client_seen_at is not null then
      v_gap:=extract(epoch from(now()-a.last_client_seen_at));
      if v_gap>30 then
        insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
        values(a.id,v_actor,'ATTEMPT_REENTERED',jsonb_build_object('gap_seconds',round(v_gap),'live_session_id',s.id));
      end if;
    end if;
    perform public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'LIVE_REENTRY');
    return query
    select a.id,a.status,a.expires_at,v_duration,
           coalesce(s.one_question_at_a_time,e.one_question_at_a_time),
           coalesce(s.no_backtracking,e.no_backtracking),
           s.section_id,
           (select sx.name from public.buklod_quiz_sections sx where sx.id=s.section_id);
    return;
  elsif a.id is not null then
    perform public.buklod_quiz_seed_attempt_questions_v2(a.id);
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer)
    select a.id,aq.question_id,v_actor,null
    from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id
    on conflict do nothing;
    perform public.buklod_quiz_compute_attempt_internal(a.id);
    a := null;
  end if;

  if v_relive_only and exists(
    select 1 from public.buklod_quiz_attempts x
    where x.live_session_id=s.id
      and x.student_user_id=v_actor
      and (
        x.submitted_at is not null
        or x.status in ('SUBMITTED','NEEDS_REVIEW','GRADED','RELEASED')
      )
  ) then
    raise exception 'This exam attempt is already submitted/finalized. If a retake is intended, ask the examiner to use RETAKE / RESET ATTEMPT.';
  end if;

  select count(*)::int into v_used
  from public.buklod_quiz_attempts x
  where x.live_session_id=s.id and x.student_user_id=v_actor and x.status<>'VOID';

  if v_used>=v_max+v_bonus then raise exception 'Maximum attempts reached for this live session.'; end if;

  select coalesce(max(x.attempt_no),0)+1 into n
  from public.buklod_quiz_attempts x where x.exam_id=e.id and x.student_user_id=v_actor;

  insert into public.buklod_quiz_attempts(
    exam_id,section_id,live_session_id,student_user_id,attempt_no,status,
    started_at,expires_at,max_score,security_snapshot,last_client_seen_at
  ) values(
    e.id,s.section_id,s.id,v_actor,n,'STARTED',now(),
    now()+make_interval(mins=>v_duration),coalesce(s.total_score_target,e.total_points),
    coalesce(s.settings_snapshot,'{}'::jsonb)||jsonb_build_object(
      'security_preset',coalesce(s.security_preset,e.security_preset),
      'device_policy',coalesce(s.device_policy,e.device_policy),
      'behavior_monitoring',coalesce(s.behavior_monitoring,e.behavior_monitoring),
      'offline_security_mode',coalesce(s.offline_security_mode,e.offline_security_mode),
      'snapshot_hash',s.question_snapshot_hash,
      'bonus_attempts',v_bonus
    ),now()
  ) returning * into a;

  perform public.buklod_quiz_seed_attempt_questions_v2(a.id);
  perform public.buklod_quiz_bind_attempt_device_v1(a.id,p_device_token,'LIVE_START');

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,v_actor,'LIVE_ATTEMPT_STARTED',jsonb_build_object(
    'live_session_id',s.id,'section_id',s.section_id,
    'security_preset',coalesce(s.security_preset,e.security_preset),'bonus_attempts',v_bonus
  ));

  update public.buklod_quiz_live_members m set last_seen_at=now()
  where m.session_id=s.id and m.student_user_id=v_actor;

  return query
  select a.id,a.status,a.expires_at,v_duration,
         coalesce(s.one_question_at_a_time,e.one_question_at_a_time),
         coalesce(s.no_backtracking,e.no_backtracking),
         s.section_id,
         (select sx.name from public.buklod_quiz_sections sx where sx.id=s.section_id);
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_student_action_v1(p_session_id uuid, p_student_user_id uuid, p_action text, p_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.buklod_quiz_live_sessions%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  v_action text:=upper(trim(coalesce(p_action,'')));
  v_minutes integer;
  v_voided integer:=0;
  v_missing_inserted integer:=0;
begin
  select x.* into s from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid());
  if s.id is null then raise exception 'Live session not found or unauthorized.'; end if;

  if not exists(select 1 from public.buklod_quiz_live_members m where m.session_id=s.id and m.student_user_id=p_student_user_id) then
    raise exception 'Student is not part of this live room.';
  end if;

  select x.* into a from public.buklod_quiz_attempts x
  where x.live_session_id=s.id and x.student_user_id=p_student_user_id and x.status<>'VOID'
  order by x.attempt_no desc limit 1;

  if v_action='READMIT' then
    update public.buklod_quiz_live_members m set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;
  elsif v_action='REMOVE' then
    update public.buklod_quiz_live_members m set status='REMOVED',removed_at=now(),last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r set status='REMOVED',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;
  elsif v_action='RESET_ATTEMPT' then
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select x.id,x.student_user_id,'FACULTY_RESET_ATTEMPT',jsonb_build_object(
      'faculty_user_id',(select auth.uid()),'live_session_id',s.id,'section_id',s.section_id,'exam_id',s.exam_id,
      'previous_status',x.status,'reason','Faculty reset/allowed clean retake; history preserved as VOID'
    )
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id and x.section_id=s.section_id and x.student_user_id=p_student_user_id and x.status<>'VOID';

    update public.buklod_quiz_attempts x set status='VOID',updated_at=now()
    where x.exam_id=s.exam_id and x.section_id=s.section_id and x.student_user_id=p_student_user_id and x.status<>'VOID';
    get diagnostics v_voided=row_count;

    update public.buklod_quiz_live_members m set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;
  elsif v_action='ALLOW_NEW_ATTEMPT' then
    insert into public.buklod_quiz_attempt_allowances(live_session_id,student_user_id,bonus_attempts,granted_by,updated_at)
    values(s.id,p_student_user_id,1,(select auth.uid()),now())
    on conflict(live_session_id,student_user_id) do update set
      bonus_attempts=least(50,public.buklod_quiz_attempt_allowances.bonus_attempts+1),
      granted_by=(select auth.uid()),updated_at=now();
    update public.buklod_quiz_live_members m set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;
  elsif v_action='REOPEN' then
    if a.id is null then raise exception 'No completed attempt to reopen.'; end if;
    if a.status='STARTED' then raise exception 'Attempt is already active.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reopen minutes must be 1 to 1440.'; end if;
    update public.buklod_quiz_attempts x set status='STARTED',released_at=null,submitted_at=null,expires_at=now()+make_interval(mins=>v_minutes),updated_at=now() where x.id=a.id;
  elsif v_action='ADD_TIME' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for extra time.'; end if;
    v_minutes:=coalesce(p_minutes,5);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Extra minutes must be 1 to 1440.'; end if;
    update public.buklod_quiz_attempts x set expires_at=x.expires_at+make_interval(mins=>v_minutes),updated_at=now() where x.id=a.id;
  elsif v_action='RESET_TIMER' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for timer reset.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Timer minutes must be 1 to 1440.'; end if;
    update public.buklod_quiz_attempts x set expires_at=now()+make_interval(mins=>v_minutes),updated_at=now() where x.id=a.id;
  elsif v_action='FORCE_SUBMIT' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt to submit.'; end if;

    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id
      and q.is_active=true
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      )
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
    get diagnostics v_missing_inserted=row_count;

    perform public.buklod_quiz_compute_attempt_internal(a.id);

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,p_student_user_id,'FACULTY_FORCE_SUBMIT_COMPLETE',
      jsonb_build_object(
        'faculty_user_id',(select auth.uid()),
        'live_session_id',s.id,
        'unanswered_inserted_count',v_missing_inserted,
        'incomplete_submission_allowed',true
      )
    );
  else
    raise exception 'Unsupported student action.';
  end if;

  return jsonb_build_object(
    'ok',true,'action',v_action,'student_user_id',p_student_user_id,'attempt_id',a.id,'voided_attempts',v_voided,
    'unanswered_inserted_count',v_missing_inserted,
    'examiner_next_instruction',case when v_action='RESET_ATTEMPT' then 'Tell the student: close the current exam page, reopen BUKLOD Quiz, enter the SAME class/exam code, then wait for the new secure attempt to open. Do not reset again unless the student is still blocked.' else null end
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_clock_v1(p_session_id uuid)
 RETURNS TABLE(session_id uuid, live_status text, started_at timestamp with time zone, ended_at timestamp with time zone, duration_minutes integer, reference_ends_at timestamp with time zone, relive_only_unattempted boolean, relive_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id,s.status,s.started_at,s.ended_at,s.duration_minutes,
         case when s.started_at is not null then s.started_at + make_interval(mins=>coalesce(s.duration_minutes,0)) else null end,
         coalesce((s.settings_snapshot->>'relive_only_unattempted')::boolean,false),
         case when coalesce(s.settings_snapshot->>'relive_count','') ~ '^[0-9]+$' then (s.settings_snapshot->>'relive_count')::int else 0 end
  from public.buklod_quiz_live_sessions s
  where s.id=p_session_id and (
    s.faculty_user_id=(select auth.uid()) or exists(
      select 1 from public.buklod_quiz_live_members m where m.session_id=s.id and m.student_user_id=(select auth.uid())
    )
  )
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_control_v3(p_session_id uuid, p_action text)
 RETURNS TABLE(session_id uuid, section_id uuid, section_name text, live_status text, join_code text, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.buklod_quiz_live_sessions%rowtype; v_action text:=upper(trim(coalesce(p_action,''))); r record;
begin
  select x.* into s from public.buklod_quiz_live_sessions x where x.id=p_session_id and x.faculty_user_id=(select auth.uid()) for update;
  if s.id is null then raise exception 'Live session not found or unauthorized.'; end if;
  if v_action in ('START','PAUSE','RESUME','END','RELIVE') then
    select * into r from public.buklod_quiz_live_control_v1(p_session_id,v_action) limit 1;
    if v_action in ('START','RELIVE') then update public.buklod_quiz_live_sessions x set config_locked_at=coalesce(x.config_locked_at,now()) where x.id=p_session_id; end if;
  elsif v_action='NEW_CODE' then
    if s.status<>'WAITING' then raise exception 'Join code can only be changed before START.'; end if;
    update public.buklod_quiz_live_sessions x set join_code=public.buklod_quiz_make_live_code_v1(),updated_at=now() where x.id=p_session_id;
  elsif v_action='RESET_ROOM' then
    if s.status<>'WAITING' then raise exception 'Room can only be reset before START.'; end if;
    delete from public.buklod_quiz_live_members m where m.session_id=p_session_id;
    update public.buklod_quiz_live_sessions x set config_locked_at=null,updated_at=now() where x.id=p_session_id;
  else raise exception 'Unsupported class live action.';
  end if;
  select x.* into s from public.buklod_quiz_live_sessions x where x.id=p_session_id;
  return query select s.id,s.section_id,(select sx.name from public.buklod_quiz_sections sx where sx.id=s.section_id),s.status,s.join_code,s.started_at,s.ended_at;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_join_preflight_v1(p_join_code text)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, code_section_id uuid, code_section_name text, roster_section_id uuid, roster_section_name text, section_state text, override_granted boolean, can_join boolean, notice text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_code text := upper(trim(coalesce(p_join_code,'')));
  v_session public.buklod_quiz_live_sessions%rowtype;
  v_exam_title text;
  v_code_section_name text;
  v_roster public.buklod_quiz_roster%rowtype;
  v_roster_section_name text;
  v_same_label boolean := false;
  v_override boolean := false;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;

  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx
    on sx.id=ls.section_id and sx.exam_id=ls.exam_id and sx.archived_at is null
  where ls.join_code=v_code and ls.status<>'ENDED'
  order by ls.created_at desc
  limit 1;

  if v_session.id is null then raise exception 'Live class code is invalid, deleted, or already ended.'; end if;

  select e.title into v_exam_title from public.buklod_quiz_exams e where e.id=v_session.exam_id;
  select s.name into v_code_section_name from public.buklod_quiz_sections s where s.id=v_session.section_id;

  select r.* into v_roster
  from public.buklod_quiz_roster r
  where r.exam_id=v_session.exam_id and r.student_user_id=v_actor
  limit 1;

  if v_roster.id is not null then
    select s.name into v_roster_section_name from public.buklod_quiz_sections s where s.id=v_roster.section_id;

    v_same_label :=
      lower(trim(regexp_replace(coalesce(v_roster_section_name,''),'\s+',' ','g'))) =
      lower(trim(regexp_replace(coalesce(v_code_section_name,''),'\s+',' ','g')));

    select exists(
      select 1
      from public.buklod_quiz_section_join_overrides o
      where o.session_id=v_session.id
        and o.student_user_id=v_actor
        and (o.expires_at is null or o.expires_at>now())
    ) into v_override;
  end if;

  return query
  select
    v_session.id,
    v_session.exam_id,
    v_exam_title,
    v_session.section_id,
    v_code_section_name,
    case when v_roster.id is null then null else v_roster.section_id end,
    v_roster_section_name,
    case
      when v_roster.id is null then 'NO_ROSTER'
      when v_roster.section_id=v_session.section_id then 'MATCH'
      when v_same_label then 'SAME_LABEL'
      when v_override then 'MISMATCH_OVERRIDDEN'
      else 'MISMATCH_BLOCKED'
    end,
    v_override,
    case
      when v_roster.id is null then true
      when v_roster.section_id=v_session.section_id then true
      when v_same_label then true
      when v_override then true
      else false
    end,
    case
      when v_roster.id is null then
        'No existing roster section was found for this exam. The normal join flow may create the roster entry.'
      when v_roster.section_id=v_session.section_id then
        'Your roster section matches this live class code.'
      when v_same_label then
        'Your roster uses a duplicate section record with the same class label. Joining is allowed.'
      when v_override then
        'Faculty override is active. Your roster is '||coalesce(v_roster_section_name,'Unknown')||
        ' while this code is for '||coalesce(v_code_section_name,'Unknown')||'.'
      else
        'Wrong live class code: your roster is '||coalesce(v_roster_section_name,'Unknown')||
        ' but this code is for '||coalesce(v_code_section_name,'Unknown')||
        '. Ask faculty for the correct code or an intentional override.'
    end;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_settings_v1(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, duration_minutes integer, max_attempts integer, pass_percent numeric, question_count integer, total_score_target numeric, randomize_questions boolean, randomize_choices boolean, one_question_at_a_time boolean, no_backtracking boolean, admission_mode text, allow_late_join boolean, late_join_minutes integer, require_fullscreen_web boolean, block_screen_capture boolean, integrity_mode text, result_release_mode text, show_answers_after_release boolean, show_correct_after_release boolean, show_explanations_after_release boolean, settings_locked boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id,s.exam_id,s.section_id,sec.name,e.title,s.join_code,s.status,
         s.duration_minutes,s.max_attempts,s.pass_percent,s.question_count,s.total_score_target,
         s.randomize_questions,s.randomize_choices,s.one_question_at_a_time,s.no_backtracking,
         s.admission_mode,s.allow_late_join,s.late_join_minutes,s.require_fullscreen_web,
         s.block_screen_capture,s.integrity_mode,s.result_release_mode,
         s.show_answers_after_release,s.show_correct_after_release,
         s.show_explanations_after_release,(s.config_locked_at is not null)
  from public.buklod_quiz_live_sessions s
  join public.buklod_quiz_exams e on e.id=s.exam_id
  join public.buklod_quiz_sections sec on sec.id=s.section_id
  where s.id=p_session_id
    and (
      s.faculty_user_id=(select auth.uid())
      or exists(select 1 from public.buklod_quiz_live_members m where m.session_id=s.id and m.student_user_id=(select auth.uid()))
    )
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v1(p_session_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  r public.buklod_quiz_roster%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  n integer;
  v_active_attempt_count integer;
begin
  select ls.* into v_session
  from public.buklod_quiz_live_sessions ls
  join public.buklod_quiz_sections sx
    on sx.id = ls.section_id
   and sx.exam_id = ls.exam_id
   and sx.archived_at is null
  join public.buklod_quiz_live_members lm on lm.session_id = ls.id
  where ls.id = p_session_id
    and ls.status = 'LIVE'
    and lm.student_user_id = (select auth.uid())
    and lm.status = 'ADMITTED';

  if v_session.id is null then
    raise exception 'Live class is not open for your exam attempt.';
  end if;

  select x.* into e
  from public.buklod_quiz_exams x
  where x.id = v_session.exam_id and x.status = 'PUBLISHED';

  if e.id is null then
    raise exception 'Exam is not published.';
  end if;

  select rr.* into r
  from public.buklod_quiz_roster rr
  join public.buklod_quiz_sections sx
    on sx.id = rr.section_id
   and sx.exam_id = rr.exam_id
   and sx.archived_at is null
  where rr.exam_id = e.id
    and rr.section_id = v_session.section_id
    and rr.student_user_id = (select auth.uid())
    and rr.status = 'ACTIVE';

  if r.id is null then
    raise exception 'You are not admitted to this exact active class.';
  end if;

  if exists (
    select 1
    from public.buklod_quiz_attempts aa
    join public.buklod_quiz_sections sx
      on sx.id = aa.section_id
     and sx.exam_id = aa.exam_id
     and sx.archived_at is null
    where aa.exam_id = e.id
      and aa.student_user_id = (select auth.uid())
      and aa.status = 'STARTED'
      and aa.live_session_id is distinct from p_session_id
  ) then
    raise exception 'Another active attempt already exists for this exam.';
  end if;

  select aa.* into a
  from public.buklod_quiz_attempts aa
  where aa.exam_id = e.id
    and aa.section_id = v_session.section_id
    and aa.student_user_id = (select auth.uid())
    and aa.live_session_id = p_session_id
    and aa.status = 'STARTED'
  order by aa.attempt_no desc
  limit 1;

  if a.id is not null and a.expires_at > now() then
    return query select a.id, a.status, a.expires_at, e.duration_minutes,
                        e.one_question_at_a_time, e.no_backtracking;
    return;
  elsif a.id is not null then
    insert into public.buklod_quiz_responses(attempt_id, question_id, student_user_id, answer)
    select a.id, q.id, (select auth.uid()), null
    from public.buklod_quiz_questions q
    where q.exam_id = e.id and q.is_active = true
    on conflict do nothing;
    perform public.buklod_quiz_compute_attempt_internal(a.id);
  end if;

  select count(*)::integer into v_active_attempt_count
  from public.buklod_quiz_attempts aa
  join public.buklod_quiz_sections sx
    on sx.id = aa.section_id
   and sx.exam_id = aa.exam_id
   and sx.archived_at is null
  where aa.exam_id = e.id
    and aa.student_user_id = (select auth.uid())
    and aa.status <> 'VOID';

  if v_active_attempt_count >= e.max_attempts then
    raise exception 'Maximum attempts reached.';
  end if;

  select coalesce(max(aa.attempt_no), 0) + 1 into n
  from public.buklod_quiz_attempts aa
  where aa.exam_id = e.id
    and aa.student_user_id = (select auth.uid());

  insert into public.buklod_quiz_attempts(
    exam_id, section_id, live_session_id, student_user_id, attempt_no,
    status, started_at, expires_at, max_score
  ) values (
    e.id, v_session.section_id, v_session.id, (select auth.uid()), n,
    'STARTED', now(), now() + make_interval(mins => e.duration_minutes), e.total_points
  ) returning * into a;

  insert into public.buklod_quiz_events(attempt_id, student_user_id, event_type, event_data)
  values (
    a.id, (select auth.uid()), 'LIVE_ATTEMPT_STARTED',
    jsonb_build_object('live_session_id', p_session_id, 'section_id', v_session.section_id)
  );

  update public.buklod_quiz_live_members lm
  set last_seen_at = now()
  where lm.session_id = p_session_id
    and lm.student_user_id = (select auth.uid());

  return query select a.id, a.status, a.expires_at, e.duration_minutes,
                      e.one_question_at_a_time, e.no_backtracking;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_start_attempt_v3(p_session_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean, section_id uuid, section_name text, question_count integer, total_score_target numeric, randomize_choices boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=p_session_id
    and x.student_user_id=(select auth.uid())
    and x.status='STARTED'
  order by x.attempt_no desc
  limit 1;

  if a.id is not null
     and a.expires_at <= now()
     and (
       now() <= a.expires_at + interval '2 minutes'
       or exists(
         select 1
         from public.buklod_quiz_offline_leases l
         where l.attempt_id=a.id
           and l.student_user_id=(select auth.uid())
           and l.used_at is null
           and l.sync_grace_expires_at > now()
       )
     )
  then
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select a.id,a.student_user_id,'EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN',
           jsonb_build_object(
             'expires_at',a.expires_at,
             'opened_at',now(),
             'source','LIVE_START_V3'
           )
    where not exists(
      select 1 from public.buklod_quiz_events e
      where e.attempt_id=a.id
        and e.event_type='EXPIRED_ATTEMPT_RECOVERY_WINDOW_OPEN'
    );

    return query
    select
      a.id,
      a.status,
      a.expires_at,
      e.duration_minutes,
      e.one_question_at_a_time,
      e.no_backtracking,
      ls.section_id,
      sec.name::text,
      (select count(*)::integer
       from public.buklod_quiz_questions q
       where q.exam_id=ls.exam_id and q.is_active=true),
      e.total_points::numeric,
      false
    from public.buklod_quiz_live_sessions ls
    join public.buklod_quiz_sections sec
      on sec.id=ls.section_id and sec.exam_id=ls.exam_id
    join public.buklod_quiz_exams e
      on e.id=ls.exam_id
    where ls.id=p_session_id;
    return;
  end if;

  return query
  with started as (
    select * from public.buklod_quiz_live_start_attempt_v1(p_session_id)
  )
  select
    started.attempt_id,
    started.status,
    started.expires_at,
    started.duration_minutes,
    started.one_question_at_a_time,
    started.no_backtracking,
    ls.section_id,
    sec.name::text,
    (select count(*)::integer
       from public.buklod_quiz_questions q
      where q.exam_id=ls.exam_id
        and q.is_active=true),
    e.total_points::numeric,
    false
  from started
  join public.buklod_quiz_live_sessions ls on ls.id=p_session_id
  join public.buklod_quiz_sections sec on sec.id=ls.section_id and sec.exam_id=ls.exam_id
  join public.buklod_quiz_exams e on e.id=ls.exam_id;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_make_live_code_v1()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_code text;
begin
    loop
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        exit when not exists (
            select 1 from public.buklod_quiz_live_sessions s where s.join_code = v_code
        );
    end loop;
    return v_code;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_active_attempt_security_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, integrity_mode text, integrity_violation_limit integer, integrity_auto_submit boolean, require_fullscreen_web boolean, block_screen_capture boolean, integrity_violation_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,e.integrity_mode,e.integrity_violation_limit,e.integrity_auto_submit,
    e.require_fullscreen_web,e.block_screen_capture,
    private.buklod_quiz_canonical_integrity_count_v1(a.id)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_sections sx on sx.id=a.section_id and sx.archived_at is null
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.exam_id=p_exam_id
    and a.student_user_id=(select auth.uid())
    and a.status='STARTED'
  order by a.attempt_no desc
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_student_action_v2(p_session_id uuid, p_student_user_id uuid, p_action text, p_minutes integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  v_action text:=upper(trim(coalesce(p_action,'')));
  v_minutes integer;
  v_voided integer:=0;
  v_attempt_no integer;
  v_new_attempt_id uuid;
  v_expires_at timestamptz;
  v_expected_count integer:=0;
  v_saved_count integer:=0;
  v_answered_count integer:=0;
  v_prior_answered_attempt_id uuid;
  v_missing_question_ids jsonb:='[]'::jsonb;
  v_missing_inserted integer:=0;
begin
  select x.* into s
  from public.buklod_quiz_live_sessions x
  where x.id=p_session_id and x.faculty_user_id=(select auth.uid());
  if s.id is null then raise exception 'Live session not found or unauthorized.'; end if;
  IF s.status='ENDED' AND v_action IN ('READMIT','REMOVE','RESET_ATTEMPT','ALLOW_NEW_ATTEMPT','REOPEN','SET_TIME','RESET_TIMER','ADD_TIME') THEN
    RAISE EXCEPTION 'Live class has ended. Use a new session to readmit, reset, or adjust a timer.';
  END IF;


  if not exists(
    select 1 from public.buklod_quiz_live_members m
    where m.session_id=s.id and m.student_user_id=p_student_user_id
  ) then
    raise exception 'Student is not part of this live room.';
  end if;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.live_session_id=s.id
    and x.student_user_id=p_student_user_id
    and x.status<>'VOID'
  order by x.attempt_no desc
  limit 1;

  if v_action='READMIT' then
    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='REMOVE' then
    update public.buklod_quiz_live_members m
      set status='REMOVED',removed_at=now(),last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='REMOVED',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='RESET_ATTEMPT' then
    if a.id is null then raise exception 'There is no current attempt to reset.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reset minutes must be 1 to 1440.'; end if;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select x.id,x.student_user_id,'FACULTY_RESET_ATTEMPT',jsonb_build_object(
      'faculty_user_id',(select auth.uid()),
      'live_session_id',s.id,
      'section_id',s.section_id,
      'exam_id',s.exam_id,
      'previous_status',x.status,
      'reason','Faculty reset with immediate fresh attempt; history preserved as VOID'
    )
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id
      and x.section_id=s.section_id
      and x.student_user_id=p_student_user_id
      and x.status<>'VOID';

    update public.buklod_quiz_attempts x
      set status='VOID',updated_at=now()
    where x.exam_id=s.exam_id
      and x.section_id=s.section_id
      and x.student_user_id=p_student_user_id
      and x.status<>'VOID';
    get diagnostics v_voided=row_count;

    select coalesce(max(x.attempt_no),0)+1 into v_attempt_no
    from public.buklod_quiz_attempts x
    where x.exam_id=s.exam_id and x.student_user_id=p_student_user_id;

    v_expires_at:=now()+make_interval(mins=>v_minutes);
    insert into public.buklod_quiz_attempts(
      exam_id,section_id,live_session_id,student_user_id,attempt_no,status,started_at,expires_at,max_score
    ) values(
      s.exam_id,s.section_id,s.id,p_student_user_id,v_attempt_no,'STARTED',now(),v_expires_at,e.total_points
    ) returning id into v_new_attempt_id;

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      v_new_attempt_id,p_student_user_id,'FACULTY_RESET_STARTED',
      jsonb_build_object('faculty_user_id',(select auth.uid()),'live_session_id',s.id,'section_id',s.section_id,'exam_id',s.exam_id,'attempt_no',v_attempt_no,'duration_minutes',v_minutes)
    );

    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='ALLOW_NEW_ATTEMPT' then
    insert into public.buklod_quiz_attempt_allowances(live_session_id,student_user_id,bonus_attempts,granted_by,updated_at)
    values(s.id,p_student_user_id,1,(select auth.uid()),now())
    on conflict(live_session_id,student_user_id) do update set
      bonus_attempts=least(50,public.buklod_quiz_attempt_allowances.bonus_attempts+1),
      granted_by=(select auth.uid()),updated_at=now();

    update public.buklod_quiz_live_members m
      set status='ADMITTED',admitted_at=coalesce(m.admitted_at,now()),removed_at=null,last_seen_at=now()
    where m.session_id=s.id and m.student_user_id=p_student_user_id;
    update public.buklod_quiz_roster r
      set status='ACTIVE',updated_at=now()
    where r.exam_id=s.exam_id and r.section_id=s.section_id and r.student_user_id=p_student_user_id;

  elsif v_action='REOPEN' then
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Reopen minutes must be 1 to 1440.'; end if;
    v_expires_at:=now()+make_interval(mins=>v_minutes);
    if a.id is null then
      -- Recover an orphaned, zero-answer STARTED attempt from an ENDED room.
      -- Explicit faculty REOPEN only: never silently VOID, erase, or duplicate it.
      if s.status<>'LIVE' then
        raise exception 'Recovery requires an active LIVE room. No records changed.';
      end if;
      if not exists(
        select 1 from public.buklod_quiz_live_members m
        where m.session_id=s.id and m.student_user_id=p_student_user_id and m.status='ADMITTED'
      ) then raise exception 'Student must be admitted to the current room before recovery.'; end if;

      select ax.* into a
      from public.buklod_quiz_attempts ax
      join public.buklod_quiz_live_sessions old_ls on old_ls.id=ax.live_session_id
      where ax.exam_id=s.exam_id and ax.section_id=s.section_id
        and ax.student_user_id=p_student_user_id and ax.status='STARTED'
        and ax.live_session_id<>s.id and old_ls.status='ENDED'
        and old_ls.exam_id=s.exam_id and old_ls.section_id=s.section_id
        and old_ls.question_count=s.question_count
        and coalesce(old_ls.settings_snapshot->>'question_selection_mode','')
            =coalesce(s.settings_snapshot->>'question_selection_mode','')
      order by ax.attempt_no desc,ax.created_at desc
      limit 1
      for update of ax;

      if a.id is null then raise exception 'No safe unfinished attempt to recover. Use Troubleshoot to review prior attempts.'; end if;
      if exists(
        select 1 from public.buklod_quiz_responses rr where rr.attempt_id=a.id
      ) then
        raise exception 'This earlier attempt has saved responses. Automatic transfer blocked: review it before reopening.';
      end if;
      if private.buklod_quiz_attempt_question_count_r1(a.id)<>s.question_count
         or coalesce(a.max_score,0)<>coalesce(s.total_score_target,0) then
        raise exception 'Question count or maximum score differs between rooms. Recovery blocked.';
      end if;
      if exists(
        select 1 from public.buklod_quiz_attempts other
        where other.exam_id=s.exam_id and other.student_user_id=p_student_user_id
          and other.status='STARTED' and other.id<>a.id
      ) then
        raise exception 'Another unfinished attempt needs separate review; no records changed.';
      end if;
      update public.buklod_quiz_attempts x
        set live_session_id=s.id,expires_at=v_expires_at,updated_at=now()
      where x.id=a.id and x.status='STARTED' and x.live_session_id<>s.id;
      if not found then raise exception 'The attempt changed before recovery; refresh and retry.'; end if;
      insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
      values(
        a.id,p_student_user_id,'FACULTY_REOPEN_ORPHANED_ZERO_ANSWER_ATTEMPT',
        jsonb_build_object('faculty_user_id',(select auth.uid()),'old_live_session_id',a.live_session_id,
           'new_live_session_id',s.id,'exam_id',s.exam_id,'section_id',s.section_id,
           'attempt_no',a.attempt_no,'duration_minutes',v_minutes,
           'saved_answer_count',0,'source','REOPEN_EXISTING_ATTEMPT')
      );
      v_new_attempt_id:=a.id;
      v_attempt_no:=a.attempt_no;
    else
      if a.status='STARTED' then raise exception 'Attempt is already active.'; end if;
      update public.buklod_quiz_attempts x
        set status='STARTED',released_at=null,submitted_at=null,expires_at=v_expires_at,updated_at=now()
      where x.id=a.id;
      v_new_attempt_id:=a.id;
      v_attempt_no:=a.attempt_no;
    end if;

  elsif v_action in ('SET_TIME','RESET_TIMER') then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for timer update.'; end if;
    v_minutes:=coalesce(p_minutes,s.duration_minutes,e.duration_minutes,30);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Timer minutes must be 1 to 1440.'; end if;
    v_expires_at:=now()+make_interval(mins=>v_minutes);
    update public.buklod_quiz_attempts x set expires_at=v_expires_at,updated_at=now() where x.id=a.id;
    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  elsif v_action='ADD_TIME' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt for extra time.'; end if;
    v_minutes:=coalesce(p_minutes,5);
    if v_minutes<1 or v_minutes>1440 then raise exception 'Extra minutes must be 1 to 1440.'; end if;
    update public.buklod_quiz_attempts x
      set expires_at=greatest(x.expires_at,now())+make_interval(mins=>v_minutes),updated_at=now()
    where x.id=a.id
    returning x.expires_at into v_expires_at;
    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  elsif v_action='FORCE_SUBMIT' then
    if a.id is null or a.status<>'STARTED' then raise exception 'No active attempt to submit.'; end if;

    select private.buklod_quiz_attempt_question_count_r1(a.id) into v_expected_count;

    select
      count(distinct r.question_id)::integer,
      count(distinct r.question_id) filter (
        where r.answer is not null
          and nullif(trim(case
            when jsonb_typeof(r.answer)='string' then r.answer #>> '{}'
            else r.answer::text
          end),'') is not null
      )::integer
    into v_saved_count,v_answered_count
    from public.buklod_quiz_responses r
    join public.buklod_quiz_questions q on q.id=r.question_id
    where r.attempt_id=a.id
      and q.exam_id=s.exam_id
      and q.is_active=true;

    if v_answered_count=0 then
      raise exception 'Force Submit blocked: this active attempt has 0 server-saved answers. Use recovery/resume; no 0-score record was created.';
    end if;

    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.sort_order), '[]'::jsonb)
      into v_missing_question_ids
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id
      and q.is_active=true
      and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
      and not exists(
        select 1
        from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      );

    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id
      and q.is_active=true
      and private.buklod_quiz_attempt_question_allowed_r1(a.id,q.id)
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      )
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
    get diagnostics v_missing_inserted=row_count;

    perform public.buklod_quiz_compute_attempt_internal(a.id);

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,
      p_student_user_id,
      'FACULTY_FORCE_SUBMIT_COMPLETE',
      jsonb_build_object(
        'faculty_user_id',(select auth.uid()),
        'live_session_id',s.id,
        'section_id',s.section_id,
        'exam_id',s.exam_id,
        'expected_count',v_expected_count,
        'saved_count_before',v_saved_count,
        'answered_count_before',v_answered_count,
        'unanswered_inserted_count',v_missing_inserted,
        'missing_question_ids',v_missing_question_ids,
        'incomplete_submission_allowed',true
      )
    );

    v_new_attempt_id:=a.id;
    v_attempt_no:=a.attempt_no;

  else
    raise exception 'Unsupported student action.';
  end if;

  if v_new_attempt_id is not null and v_expires_at is null then
    select x.expires_at into v_expires_at
    from public.buklod_quiz_attempts x
    where x.id=v_new_attempt_id;
  end if;

  return jsonb_build_object(
    'ok',true,
    'action',v_action,
    'student_user_id',p_student_user_id,
    'attempt_id',coalesce(v_new_attempt_id,a.id),
    'attempt_no',coalesce(v_attempt_no,a.attempt_no),
    'expires_at',v_expires_at,
    'voided_attempts',v_voided,
    'unanswered_inserted_count',v_missing_inserted
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_live_touch_v1(p_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    update public.buklod_quiz_live_members
    set last_seen_at=now()
    where session_id=p_session_id
      and student_user_id=(select auth.uid())
      and status in ('WAITING','ADMITTED');
    return found;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_results_v1()
 RETURNS TABLE(exam_title text, section_name text, attempt_no integer, total_score numeric, max_score numeric, released_at timestamp with time zone, pass_percent numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select e.title,s.name,a.attempt_no,a.total_score,a.max_score,a.released_at,e.pass_percent from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id join public.buklod_quiz_sections s on s.id=a.section_id where a.student_user_id=auth.uid() and a.status='RELEASED' order by a.released_at desc $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_log_exam_event_v1(p_attempt_id uuid, p_event_type text, p_event_data jsonb DEFAULT '{}'::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_type text := upper(coalesce(nullif(trim(p_event_type),''),'EVENT'));
begin
  if v_type in (
    'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
    'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
  ) then
    perform *
    from public.buklod_quiz_integrity_event_v1(
      p_attempt_id,
      v_type,
      coalesce(p_event_data,'{}'::jsonb)
        || jsonb_build_object('source_rpc','buklod_quiz_log_exam_event_v1')
    );
    return true;
  end if;

  if not exists(
    select 1
    from public.buklod_quiz_attempts
    where id=p_attempt_id
      and student_user_id=auth.uid()
      and status='STARTED'
  ) then
    raise exception 'Attempt is not active.';
  end if;

  insert into public.buklod_quiz_events(
    attempt_id,student_user_id,event_type,event_data
  ) values(
    p_attempt_id,auth.uid(),v_type,coalesce(p_event_data,'{}'::jsonb)
  );

  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_attempt_start_info_v1(p_attempt_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=(select auth.uid()) and x.status='STARTED';
  if a.id is null then raise exception 'Active attempt not found.'; end if;
  perform public.buklod_quiz_seed_attempt_questions_v1(a.id);
  return query
  select a.id,a.status,a.expires_at,
         coalesce(ls.duration_minutes,e.duration_minutes,30),
         coalesce(ls.one_question_at_a_time,e.one_question_at_a_time,true),
         coalesce(ls.no_backtracking,e.no_backtracking,false)
  from public.buklod_quiz_exams e
  left join public.buklod_quiz_live_sessions ls on ls.id=a.live_session_id
  where e.id=a.exam_id;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_available_exams_v1()
 RETURNS TABLE(exam_id uuid, title text, exam_type text, instructions text, duration_minutes integer, max_attempts integer, total_points numeric, section_name text, last_attempt_status text, released_score numeric, released_max_score numeric, attempts_used integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with assigned as (
    select e.*, r.section_id, s.name as section_name
    from public.buklod_quiz_roster r
    join public.buklod_quiz_exams e on e.id=r.exam_id
    join public.buklod_quiz_sections s
      on s.id=r.section_id
     and s.exam_id=r.exam_id
     and s.archived_at is null
    where r.student_user_id=(select auth.uid())
      and r.status='ACTIVE'
      and e.status='PUBLISHED'
      and (e.available_from is null or e.available_from<=now())
      and (e.available_until is null or e.available_until>=now())
  ), gated as (
    select x.*
    from assigned x
    left join lateral (
      select ls.id, ls.status
      from public.buklod_quiz_live_sessions ls
      where ls.exam_id=x.id
        and ls.section_id=x.section_id
        and ls.status<>'ENDED'
      order by ls.created_at desc
      limit 1
    ) current_live on true
    where current_live.id is null
       or (
         current_live.status='LIVE'
         and exists (
           select 1
           from public.buklod_quiz_live_members lm
           where lm.session_id=current_live.id
             and lm.student_user_id=(select auth.uid())
             and lm.status='ADMITTED'
         )
       )
  ), latest as (
    select distinct on(a.exam_id)
      a.exam_id,a.status,a.total_score,a.max_score
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_sections s
      on s.id=a.section_id
     and s.exam_id=a.exam_id
     and s.archived_at is null
    where a.student_user_id=(select auth.uid())
    order by a.exam_id,a.attempt_no desc
  ), cnt as (
    select a.exam_id,count(*) filter(where a.status<>'VOID')::int as n
    from public.buklod_quiz_attempts a
    join public.buklod_quiz_sections s
      on s.id=a.section_id
     and s.exam_id=a.exam_id
     and s.archived_at is null
    where a.student_user_id=(select auth.uid())
    group by a.exam_id
  )
  select x.id,x.title,x.exam_type,x.instructions,x.duration_minutes,x.max_attempts,x.total_points,x.section_name,l.status,
         case when l.status='RELEASED' then l.total_score end,
         case when l.status='RELEASED' then l.max_score end,
         coalesce(c.n,0)
  from gated x
  left join latest l on l.exam_id=x.id
  left join cnt c on c.exam_id=x.id
  order by x.created_at desc;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_capabilities_v1()
 RETURNS TABLE(can_conduct boolean, is_system_admin boolean, display_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_examiner_role boolean := false;
  v_faculty_admin boolean := false;
  v_admin boolean := false;
  v_name text := null;
begin
  if v_uid is null then
    return query select false, false, null::text;
    return;
  end if;

  select exists(
    select 1
    from public.buklod_quiz_examiner_roles r
    where r.user_id = v_uid
      and r.is_active = true
  ) into v_examiner_role;

  v_faculty_admin := public.buklod_quiz_faculty_focus_admin_eligible_v1(v_uid);
  v_admin := public.buklod_quiz_is_system_admin();

  select coalesce(
    nullif(to_jsonb(p)->>'display_name',''),
    nullif(to_jsonb(p)->>'full_name',''),
    nullif(to_jsonb(p)->>'username','')
  )
  into v_name
  from public.profiles p
  where p.id = v_uid;

  return query
  select (v_admin or (v_examiner_role and v_faculty_admin)), v_admin, v_name;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_live_class_v1(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
    select s.id, s.exam_id, e.title, s.join_code, s.status, m.status,
           s.admission_mode, s.allow_late_join,
           (s.status='LIVE' and m.status='ADMITTED') as can_start,
           s.started_at, s.ended_at
    from public.buklod_quiz_live_sessions s
    join public.buklod_quiz_sections sx
      on sx.id=s.section_id
     and sx.exam_id=s.exam_id
     and sx.archived_at is null
    join public.buklod_quiz_live_members m on m.session_id=s.id
    join public.buklod_quiz_exams e on e.id=s.exam_id
    where s.id=p_session_id
      and m.student_user_id=(select auth.uid())
    limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_live_class_v2(p_session_id uuid)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, member_status text, admission_mode text, allow_late_join boolean, can_start boolean, started_at timestamp with time zone, ended_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id,s.exam_id,sec.id,sec.name::text,e.title::text,s.join_code,s.status,m.status,s.admission_mode,s.allow_late_join,
    (s.status='LIVE' and m.status='ADMITTED' and not (
      coalesce((s.settings_snapshot->>'relive_only_unattempted')::boolean,false)
      and exists(
        select 1 from public.buklod_quiz_attempts a
        where a.live_session_id=s.id
          and a.student_user_id=(select auth.uid())
          and (
            a.submitted_at is not null
            or a.status in ('SUBMITTED','NEEDS_REVIEW','GRADED','RELEASED')
          )
      )
    )) as can_start,
    s.started_at,s.ended_at
  from public.buklod_quiz_live_sessions s
  join public.buklod_quiz_live_members m on m.session_id=s.id
  join public.buklod_quiz_exams e on e.id=s.exam_id
  join public.buklod_quiz_sections sec on sec.id=s.section_id and sec.exam_id=s.exam_id
  where s.id=p_session_id and m.student_user_id=(select auth.uid())
  limit 1
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(p_attempt_id uuid)
 RETURNS TABLE(question_no integer, question_type text, prompt text, options jsonb, points numeric, answer_text text, correct_answer_text text, awarded_score numeric, feedback text, explanation text, show_correct boolean, show_explanation boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype; s public.buklod_quiz_live_sessions%rowtype; v_show_answers boolean; v_show_correct boolean; v_show_explanations boolean;
begin
  select x.* into a from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=(select auth.uid()) and x.status='RELEASED';
  if a.id is null then raise exception 'Released result not found.'; end if;
  if a.live_session_id is not null then select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id; end if;
  v_show_answers:=coalesce(s.show_answers_after_release,true);
  v_show_correct:=coalesce(s.show_correct_after_release,false);
  v_show_explanations:=coalesce(s.show_explanations_after_release,false);
  if not v_show_answers then raise exception 'Faculty did not enable answer review for this released result.'; end if;
  perform public.buklod_quiz_seed_attempt_questions_v1(a.id);
  return query
  select aq.display_order,q.question_type,q.prompt,q.options,aq.points,
    case when r.answer is null then '' when jsonb_typeof(r.answer)='string' then r.answer#>>'{}' else r.answer::text end,
    case when v_show_correct then case when q.correct_answer is null then '' when jsonb_typeof(q.correct_answer)='string' then q.correct_answer#>>'{}' else q.correct_answer::text end else '' end,
    coalesce(r.manual_score,r.objective_score,0),r.feedback,
    case when v_show_explanations then q.explanation else null end,
    v_show_correct,v_show_explanations
  from public.buklod_quiz_attempt_questions aq
  join public.buklod_quiz_questions q on q.id=aq.question_id
  left join public.buklod_quiz_responses r on r.attempt_id=aq.attempt_id and r.question_id=aq.question_id
  where aq.attempt_id=a.id order by aq.display_order;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_record_diagnostics_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(student_user_id uuid, attempt_id uuid, response_count integer, pending_review_count integer, event_row_count integer, supported_event_count integer, integrity_incident_count integer, legacy_integrity_count integer, legacy_score_only boolean, score_available boolean, item_data_available boolean, integrity_detail_available boolean, release_eligible boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  return query
  with roster as (
    select r.student_user_id from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), latest as (
    select r.student_user_id as roster_student_user_id,
           a.id as attempt_id,a.status,a.total_score,a.max_score,a.integrity_violation_count
    from roster r left join lateral (
      select ax.id,ax.status,ax.total_score,ax.max_score,ax.integrity_violation_count
      from public.buklod_quiz_attempts ax
      where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc limit 1
    ) a on true
  ), counts as (
    select l.roster_student_user_id,l.attempt_id,l.status,l.total_score,l.max_score,coalesce(l.integrity_violation_count,0)::integer legacy_integrity_count,
      coalesce((select count(*)::integer from public.buklod_quiz_responses r where r.attempt_id=l.attempt_id),0) response_count,
      coalesce((select count(*)::integer from public.buklod_quiz_responses r where r.attempt_id=l.attempt_id and r.needs_review=true and r.manual_score is null),0) pending_review_count,
      coalesce((select count(*)::integer from public.buklod_quiz_events ev where ev.attempt_id=l.attempt_id),0) event_row_count,
      coalesce((select count(*)::integer from public.buklod_quiz_events ev where ev.attempt_id=l.attempt_id and ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT')),0) supported_event_count
    from latest l
  )
  select c.roster_student_user_id,c.attempt_id,c.response_count,c.pending_review_count,c.event_row_count,c.supported_event_count,
    case when c.attempt_id is null or c.event_row_count=0 then 0 else coalesce(m.departure_incidents,0)+coalesce(m.copy_attempts,0)+coalesce(m.screen_capture_signals,0)+coalesce(m.devtools_attempts,0)+coalesce(m.context_menu_attempts,0) end::integer,
    c.legacy_integrity_count,
    (c.attempt_id is not null and c.response_count=0 and c.total_score is not null and coalesce(c.max_score,0)>0 and c.status in ('NEEDS_REVIEW','GRADED')),
    (c.total_score is not null and coalesce(c.max_score,0)>0),
    (c.response_count>0),(c.event_row_count>0),
    (c.attempt_id is not null and c.status in ('GRADED','NEEDS_REVIEW') and c.pending_review_count=0 and (c.response_count>0 or (c.total_score is not null and coalesce(c.max_score,0)>0)))
  from counts c left join lateral public.buklod_quiz_integrity_metrics_v1(c.attempt_id) m on c.attempt_id is not null and c.event_row_count>0;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_release_attempt_v1(p_attempt_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=(select auth.uid()); v_owner uuid; v_status text; v_pending integer;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id,a.status into v_owner,v_status
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.id=p_attempt_id for update of a;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  if v_status='RELEASED' then return true; end if;
  if v_status='STARTED' then raise exception 'The student is still taking this attempt. Submit or end the attempt before release.'; end if;
  if v_status='VOID' then raise exception 'A VOID attempt cannot be released.'; end if;

  perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
  select count(*)::int into v_pending
  from public.buklod_quiz_responses r
  where r.attempt_id=p_attempt_id and r.needs_review=true and r.manual_score is null;
  if v_pending>0 then raise exception 'Faculty review is still incomplete for % response(s), including non-exact short-text answers.',v_pending; end if;

  update public.buklod_quiz_attempts
  set status='RELEASED',released_at=coalesce(released_at,now()),updated_at=now()
  where id=p_attempt_id and status<>'VOID';
  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  select a.id,a.student_user_id,'FACULTY_MANUAL_RELEASE',jsonb_build_object('faculty_user_id',v_actor,'released_at',now())
  from public.buklod_quiz_attempts a where a.id=p_attempt_id;
  return true;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_my_results_v2()
 RETURNS TABLE(attempt_id uuid, exam_title text, section_name text, attempt_no integer, earned_score numeric, integrity_deduction_total numeric, total_score numeric, max_score numeric, released_at timestamp with time zone, pass_percent numeric, violation_count integer, violations jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select a.id,e.title::text,s.name::text,a.attempt_no,
    (coalesce(a.objective_score,0)+coalesce(a.manual_score,0))::numeric,
    coalesce((select sum(d.deduction_points) from public.buklod_quiz_integrity_deductions d where d.attempt_id=a.id),0)::numeric,
    a.total_score,a.max_score,a.released_at,coalesce(ls.pass_percent,e.pass_percent),
    public.buklod_quiz_integrity_incident_count_v1(a.id),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type',i.event_type,'label',i.violation_label,'count',i.event_count,
        'first_at',i.first_event_at,'last_at',i.last_event_at,
        'deduction_points',coalesce(d.deduction_points,0),'deduction_note',d.deduction_note
      ) order by i.last_event_at desc,i.event_type)
      from public.buklod_quiz_integrity_incident_rows_v1(a.id) i
      left join lateral(
        select sum(x.deduction_points)::numeric deduction_points,
          nullif(string_agg(x.note,' | ' order by x.event_type) filter(where x.note is not null),'') deduction_note
        from public.buklod_quiz_integrity_deductions x
        where x.attempt_id=a.id and (
          (i.event_type='TAB_HIDDEN' and x.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND'))
          or (i.event_type<>'TAB_HIDDEN' and x.event_type=i.event_type)
        )
      ) d on true
    ),'[]'::jsonb)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id
  left join public.buklod_quiz_live_sessions ls on ls.id=a.live_session_id
  where a.student_user_id=(select auth.uid()) and a.status='RELEASED'
  order by a.released_at desc
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_normalize_short_text_v1(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select trim(regexp_replace(lower(coalesce(p_text,'')), '[^a-z0-9]+', ' ', 'g'));
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_release_attempt_v2(p_attempt_id uuid, p_show_violations boolean DEFAULT false, p_show_answers boolean DEFAULT false, p_show_rationale boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid()); v_owner uuid; v_status text; v_pending integer:=0; v_response_count integer:=0; v_event_count integer:=0;
  v_total numeric; v_max numeric; v_legacy_score_only boolean:=false; v_show_answers boolean:=false; v_show_rationale boolean:=false; v_show_violations boolean:=false;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  select e.owner_user_id,a.status,a.total_score,a.max_score into v_owner,v_status,v_total,v_max
  from public.buklod_quiz_attempts a join public.buklod_quiz_exams e on e.id=a.exam_id where a.id=p_attempt_id for update of a;
  if v_owner is null then raise exception 'Attempt not found.'; end if;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  if v_status='STARTED' then raise exception 'The student is still taking this attempt.'; end if;
  if v_status='VOID' then raise exception 'A VOID attempt cannot be released.'; end if;
  select count(*)::integer,count(*) filter(where r.needs_review=true and r.manual_score is null)::integer into v_response_count,v_pending
  from public.buklod_quiz_responses r where r.attempt_id=p_attempt_id;
  select count(*)::integer into v_event_count from public.buklod_quiz_events ev where ev.attempt_id=p_attempt_id and ev.event_type in ('APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT');
  if v_pending>0 then raise exception 'Faculty review is still incomplete for % response(s).',v_pending; end if;
  if v_status<>'RELEASED' then
    if v_response_count>0 then
      perform public.buklod_quiz_compute_attempt_internal(p_attempt_id);
      select a.status,a.total_score,a.max_score into v_status,v_total,v_max from public.buklod_quiz_attempts a where a.id=p_attempt_id;
      if v_status<>'GRADED' then raise exception 'Only a submitted result with no pending review can be released.'; end if;
    else
      v_legacy_score_only := v_status in ('NEEDS_REVIEW','GRADED') and v_total is not null and coalesce(v_max,0)>0;
      if not v_legacy_score_only then raise exception 'No reviewable response data or valid recorded score is available for release.'; end if;
    end if;
  else v_legacy_score_only := v_response_count=0 and v_total is not null and coalesce(v_max,0)>0; end if;
  v_show_answers := (coalesce(p_show_answers,false) or coalesce(p_show_rationale,false)) and v_response_count>0;
  v_show_rationale := coalesce(p_show_rationale,false) and v_response_count>0;
  v_show_violations := coalesce(p_show_violations,false) and v_event_count>0;
  insert into public.buklod_quiz_release_preferences(attempt_id,show_score,show_violations,show_answers,show_rationale,released_by,created_at,updated_at)
  values(p_attempt_id,true,v_show_violations,v_show_answers,v_show_rationale,v_actor,now(),now())
  on conflict(attempt_id) do update set show_score=true,show_violations=excluded.show_violations,show_answers=excluded.show_answers,show_rationale=excluded.show_rationale,released_by=excluded.released_by,updated_at=now();
  if v_status<>'RELEASED' then
    update public.buklod_quiz_attempts set status='RELEASED',released_at=coalesce(released_at,now()),updated_at=now() where id=p_attempt_id and status in ('GRADED','NEEDS_REVIEW');
    if not found then raise exception 'Attempt changed before release. Refresh and try again.'; end if;
    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    select a.id,a.student_user_id,'FACULTY_MANUAL_RELEASE',jsonb_build_object('faculty_user_id',v_actor,'released_at',now(),'release_mode',case when v_legacy_score_only then 'LEGACY_SCORE_ONLY' else 'STANDARD' end,'release_visibility',jsonb_build_object('score',true,'violations',v_show_violations,'answers',v_show_answers,'rationale',v_show_rationale),'unavailable_requested',jsonb_build_object('violations',coalesce(p_show_violations,false) and not v_show_violations,'answers',(coalesce(p_show_answers,false) or coalesce(p_show_rationale,false)) and not v_show_answers,'rationale',coalesce(p_show_rationale,false) and not v_show_rationale))
    from public.buklod_quiz_attempts a where a.id=p_attempt_id;
  end if;
  return true;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_prepare_live_session_v1(p_exam_id uuid, p_section_id uuid, p_settings jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, duration_minutes integer, max_attempts integer, pass_percent numeric, question_count integer, bank_question_count integer, total_score_target numeric, randomize_questions boolean, randomize_choices boolean, one_question_at_a_time boolean, no_backtracking boolean, admission_mode text, allow_late_join boolean, late_join_minutes integer, require_fullscreen_web boolean, block_screen_capture boolean, integrity_mode text, result_release_mode text, show_answers_after_release boolean, show_correct_after_release boolean, show_explanations_after_release boolean, settings_locked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  e public.buklod_quiz_exams%rowtype;
  sx public.buklod_quiz_sections%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  v_bank integer; v_qcount integer; v_duration integer; v_attempts integer;
  v_pass numeric; v_target numeric; v_admission text; v_allow_late boolean;
  v_late_minutes integer; v_random_q boolean; v_random_choices boolean;
  v_one boolean; v_noback boolean; v_fullscreen boolean; v_capture boolean;
  v_integrity text; v_release text; v_show_answers boolean; v_show_correct boolean;
  v_show_explanations boolean; v_selected uuid[]; v_reshuffle boolean;
begin
  if v_actor is null then raise exception 'Sign in first.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text||':'||p_exam_id::text||':'||p_section_id::text,0)
  );

  select x.* into e
  from public.buklod_quiz_exams x
  where x.id=p_exam_id and x.owner_user_id=v_actor and x.archived_at is null;
  if e.id is null then raise exception 'Exam not found, archived, or unauthorized.'; end if;

  select x.* into sx
  from public.buklod_quiz_sections x
  where x.id=p_section_id and x.exam_id=p_exam_id and x.archived_at is null;
  if sx.id is null then raise exception 'Class/section not found.'; end if;

  select count(*)::int into v_bank
  from public.buklod_quiz_questions q
  where q.exam_id=p_exam_id and q.is_active=true;
  if v_bank<1 then raise exception 'Add at least one active question before preparing live exam.'; end if;

  v_duration:=coalesce(nullif(p_settings->>'duration_minutes','')::int,e.duration_minutes,30);
  v_attempts:=coalesce(nullif(p_settings->>'max_attempts','')::int,e.max_attempts,1);
  v_pass:=coalesce(nullif(p_settings->>'pass_percent','')::numeric,e.pass_percent,75);
  v_qcount:=coalesce(nullif(p_settings->>'question_count','')::int,v_bank);
  v_target:=coalesce(nullif(p_settings->>'total_score_target','')::numeric,nullif(e.total_points,0),100);
  v_admission:=upper(coalesce(nullif(p_settings->>'admission_mode',''),'OPEN'));
  v_allow_late:=coalesce((p_settings->>'allow_late_join')::boolean,true);
  v_late_minutes:=coalesce(nullif(p_settings->>'late_join_minutes','')::int,0);
  v_random_q:=coalesce((p_settings->>'randomize_questions')::boolean,e.randomize_questions,false);
  v_random_choices:=coalesce((p_settings->>'randomize_choices')::boolean,e.randomize_choices,false);
  v_one:=coalesce((p_settings->>'one_question_at_a_time')::boolean,e.one_question_at_a_time,true);
  v_noback:=coalesce((p_settings->>'no_backtracking')::boolean,e.no_backtracking,false);
  v_fullscreen:=coalesce((p_settings->>'require_fullscreen_web')::boolean,e.require_fullscreen_web,false);
  v_capture:=coalesce((p_settings->>'block_screen_capture')::boolean,e.block_screen_capture,true);
  v_integrity:=upper(coalesce(nullif(p_settings->>'integrity_mode',''),e.integrity_mode,'MONITOR'));
  v_release:=upper(coalesce(nullif(p_settings->>'result_release_mode',''),'MANUAL'));
  v_show_answers:=coalesce((p_settings->>'show_answers_after_release')::boolean,true);
  v_show_correct:=coalesce((p_settings->>'show_correct_after_release')::boolean,false);
  v_show_explanations:=coalesce((p_settings->>'show_explanations_after_release')::boolean,false);
  v_reshuffle:=coalesce((p_settings->>'reshuffle_questions')::boolean,false);

  if v_duration<1 or v_duration>1440 then raise exception 'Duration must be 1 to 1440 minutes.'; end if;
  if v_attempts<1 or v_attempts>20 then raise exception 'Max attempts must be 1 to 20.'; end if;
  if v_pass<0 or v_pass>100 then raise exception 'Passing grade must be 0 to 100.'; end if;
  if v_qcount<1 or v_qcount>v_bank then raise exception 'Question count must be 1 to %.',v_bank; end if;
  if v_target<=0 or v_target>10000 then raise exception 'Total score target must be greater than 0 and at most 10000.'; end if;
  if v_admission not in ('OPEN','APPROVAL') then raise exception 'Admission mode must be OPEN or APPROVAL.'; end if;
  if v_late_minutes<0 or v_late_minutes>1440 then raise exception 'Late-join window must be 0 to 1440 minutes.'; end if;
  if v_integrity not in ('OFF','MONITOR','STRICT') then raise exception 'Invalid integrity mode.'; end if;
  if v_release<>'MANUAL' then raise exception 'BUKLOD Quiz results use manual faculty release.'; end if;

  select x.* into s
  from public.buklod_quiz_live_sessions x
  where x.exam_id=p_exam_id and x.section_id=p_section_id
    and x.faculty_user_id=v_actor and x.status<>'ENDED'
  order by x.created_at desc limit 1 for update;

  if s.id is not null and s.status in ('LIVE','PAUSED') then
    raise exception 'Live settings are locked after START. End this session and prepare or clone a new one for different settings.';
  end if;

  if s.id is null then
    insert into public.buklod_quiz_live_sessions(
      exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join
    ) values(
      p_exam_id,p_section_id,v_actor,public.buklod_quiz_make_live_code_v1(),'WAITING',v_admission,v_allow_late
    ) returning * into s;
  end if;

  if coalesce((p_settings->>'regenerate_join_code')::boolean,false) then
    s.join_code:=public.buklod_quiz_make_live_code_v1();
  end if;

  if not v_reshuffle and coalesce(array_length(s.selected_question_ids,1),0)=v_qcount then
    v_selected:=s.selected_question_ids;
  elsif v_qcount=v_bank then
    select array_agg(q.id order by q.sort_order,q.id) into v_selected
    from public.buklod_quiz_questions q
    where q.exam_id=p_exam_id and q.is_active=true;
  else
    select array_agg(z.id order by z.pick_order) into v_selected
    from (
      select q.id,random() as pick_order
      from public.buklod_quiz_questions q
      where q.exam_id=p_exam_id and q.is_active=true
      order by random()
      limit v_qcount
    ) z;
  end if;

  update public.buklod_quiz_live_sessions x
  set join_code=s.join_code,status='WAITING',admission_mode=v_admission,
      allow_late_join=v_allow_late,duration_minutes=v_duration,max_attempts=v_attempts,
      pass_percent=v_pass,question_count=v_qcount,total_score_target=v_target,
      randomize_questions=v_random_q,randomize_choices=v_random_choices,
      one_question_at_a_time=v_one,no_backtracking=v_noback,
      late_join_minutes=v_late_minutes,require_fullscreen_web=v_fullscreen,
      block_screen_capture=v_capture,integrity_mode=v_integrity,
      result_release_mode='MANUAL',show_answers_after_release=v_show_answers,
      show_correct_after_release=v_show_correct,
      show_explanations_after_release=v_show_explanations,
      selected_question_ids=v_selected,
      settings_snapshot=jsonb_build_object(
        'duration_minutes',v_duration,'max_attempts',v_attempts,'pass_percent',v_pass,
        'question_count',v_qcount,'bank_question_count',v_bank,'total_score_target',v_target,
        'randomize_questions',v_random_q,'randomize_choices',v_random_choices,
        'one_question_at_a_time',v_one,'no_backtracking',v_noback,
        'admission_mode',v_admission,'allow_late_join',v_allow_late,
        'late_join_minutes',v_late_minutes,'require_fullscreen_web',v_fullscreen,
        'block_screen_capture',v_capture,'integrity_mode',v_integrity,
        'result_release_mode','MANUAL','show_answers_after_release',v_show_answers,
        'show_correct_after_release',v_show_correct,
        'show_explanations_after_release',v_show_explanations,
        'integrity_auto_submit',false
      ),
      config_locked_at=null,updated_at=now()
  where x.id=s.id
  returning * into s;

  insert into public.buklod_quiz_faculty_actions(
    actor_user_id,exam_id,section_id,live_session_id,action,action_data
  ) values(v_actor,p_exam_id,p_section_id,s.id,'LIVE_SETTINGS_PREPARED',s.settings_snapshot);

  return query
  select s.id,s.exam_id,s.section_id,sx.name,e.title,s.join_code,s.status,
         s.duration_minutes,s.max_attempts,s.pass_percent,s.question_count,v_bank,
         s.total_score_target,s.randomize_questions,s.randomize_choices,
         s.one_question_at_a_time,s.no_backtracking,s.admission_mode,s.allow_late_join,
         s.late_join_minutes,s.require_fullscreen_web,s.block_screen_capture,s.integrity_mode,
         s.result_release_mode,s.show_answers_after_release,s.show_correct_after_release,
         s.show_explanations_after_release,(s.config_locked_at is not null);
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_override_response_score_v1(p_response_id uuid, p_score numeric, p_feedback text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, attempt_status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid:=(select auth.uid());
  r public.buklod_quiz_responses%rowtype;
  a public.buklod_quiz_attempts%rowtype;
  v_owner uuid; v_points numeric; v_original_status text;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  select rr.* into r from public.buklod_quiz_responses rr where rr.id=p_response_id;
  if r.id is null then raise exception 'Response not found.'; end if;

  select aa.* into a from public.buklod_quiz_attempts aa where aa.id=r.attempt_id;
  if a.id is null then raise exception 'Attempt not found.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_exams e where e.id=a.exam_id;
  if v_owner<>v_actor then raise exception 'Exam owner access required.'; end if;
  if a.status in ('STARTED','VOID') then raise exception 'Score correction is available only after submission.'; end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(a.id);
  select aq.points into v_points
  from public.buklod_quiz_attempt_questions aq
  where aq.attempt_id=a.id and aq.question_id=r.question_id;
  if v_points is null then raise exception 'This response is not part of the attempt question set.'; end if;
  if p_score<0 or p_score>v_points then raise exception 'Score must be from 0 to %.',v_points; end if;

  v_original_status:=a.status;
  update public.buklod_quiz_responses rr
  set manual_score=p_score,objective_score=0,
      is_correct=case when p_score>=v_points then true when p_score<=0 then false else null end,
      needs_review=false,feedback=nullif(trim(coalesce(p_feedback,'')),''),
      reviewed_by=v_actor,reviewed_at=now()
  where rr.id=r.id;

  perform public.buklod_quiz_compute_attempt_internal(a.id);
  if v_original_status='RELEASED' then
    update public.buklod_quiz_attempts aa
    set status='RELEASED',released_at=coalesce(aa.released_at,now()),updated_at=now()
    where aa.id=a.id;
  end if;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,a.student_user_id,'FACULTY_SCORE_OVERRIDE',
         jsonb_build_object('faculty_user_id',v_actor,'response_id',r.id,'question_id',r.question_id,
                            'new_score',p_score,'max_points',v_points,'feedback',p_feedback,
                            'preserved_released',v_original_status='RELEASED'));

  return query select aa.id,aa.status,aa.total_score,aa.max_score
  from public.buklod_quiz_attempts aa where aa.id=a.id;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_profile_display_name_v1(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(
    case
      when nullif(trim(p.surname), '') is not null
       and nullif(trim(p.first_name), '') is not null
      then trim(p.surname) || ', ' || trim(p.first_name)
        || case
             when nullif(trim(p.middle_name), '') is not null
             then ' ' || upper(left(trim(p.middle_name), 1)) || '.'
             else ''
           end
        || case
             when nullif(trim(p.suffix), '') is not null
             then ' ' || trim(p.suffix)
             else ''
           end
      else null
    end,
    nullif(trim(p.full_name), ''),
    nullif(trim(p.username), ''),
    'BUKLOD Student'
  )::text
  from public.profiles p
  where p.id = p_user_id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_publish_exam_v1(p_exam_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare pts numeric; begin
 if not exists(select 1 from public.buklod_quiz_exams where id=p_exam_id and owner_user_id=auth.uid()) then raise exception 'Exam not found or unauthorized.'; end if;
 select coalesce(sum(points),0) into pts from public.buklod_quiz_questions where exam_id=p_exam_id and is_active=true; if pts<=0 then raise exception 'Add at least one active question before publishing.'; end if;
 update public.buklod_quiz_exams set total_points=pts,status='PUBLISHED',published_at=now(),updated_at=now() where id=p_exam_id; return true; end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_records_mark_retake_v1(p_exam_id uuid, p_section_id uuid, p_student_user_id uuid, p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_attempt public.buklod_quiz_attempts%rowtype;
  v_voided integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  if not exists (
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then
    raise exception 'Exam/class not found or unauthorized.';
  end if;

  if not exists (
    select 1 from public.buklod_quiz_roster r
    where r.exam_id=p_exam_id and r.section_id=p_section_id
      and r.student_user_id=p_student_user_id and r.status='ACTIVE'
  ) then
    raise exception 'Student is not ACTIVE in this exam section.';
  end if;

  select a.* into v_attempt
  from public.buklod_quiz_attempts a
  where a.id=p_attempt_id and a.exam_id=p_exam_id and a.section_id=p_section_id
    and a.student_user_id=p_student_user_id
  for update;

  if v_attempt.id is null then raise exception 'Attempt not found in this exact Exam + Section.'; end if;
  if v_attempt.status='RELEASED' then
    raise exception 'This result is already RELEASED. RETAKE cannot withdraw an already released academic result.';
  end if;

  if v_attempt.status='VOID' then
    if exists (
      select 1 from public.buklod_quiz_events ev
      where ev.attempt_id=v_attempt.id and ev.event_type='FACULTY_RETAKE_REQUESTED'
    ) then
      return jsonb_build_object(
        'ok',true,'already_pending',true,'student_user_id',p_student_user_id,
        'source_attempt_id',v_attempt.id,'source_attempt_no',v_attempt.attempt_no,
        'voided_attempts',0,'retake_pending',true
      );
    end if;
    raise exception 'This attempt is already VOID and is not the active RETAKE source.';
  end if;

  if v_attempt.status not in ('STARTED','NEEDS_REVIEW','GRADED') then
    raise exception 'Attempt status % is not eligible for RETAKE.',v_attempt.status;
  end if;

  if exists (
    select 1 from public.buklod_quiz_attempts newer
    where newer.exam_id=p_exam_id and newer.section_id=p_section_id
      and newer.student_user_id=p_student_user_id and newer.status<>'VOID'
      and (
        newer.attempt_no>v_attempt.attempt_no
        or (newer.attempt_no=v_attempt.attempt_no and newer.created_at>v_attempt.created_at)
      )
  ) then
    raise exception 'The record changed. Refresh Exam Record before marking RETAKE.';
  end if;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values (
    v_attempt.id,p_student_user_id,'FACULTY_RETAKE_REQUESTED',
    jsonb_build_object(
      'faculty_user_id',v_actor,'exam_id',p_exam_id,'section_id',p_section_id,
      'source_attempt_id',v_attempt.id,'source_attempt_no',v_attempt.attempt_no,
      'previous_status',v_attempt.status,'previous_total_score',v_attempt.total_score,
      'reason','Faculty marked the current Exam Record for a fresh retake; unreleased attempts are excluded from release and preserved as VOID history'
    )
  );

  update public.buklod_quiz_attempts a
     set status='VOID',updated_at=now()
   where a.exam_id=p_exam_id and a.section_id=p_section_id
     and a.student_user_id=p_student_user_id
     and a.status in ('STARTED','NEEDS_REVIEW','GRADED')
     and a.released_at is null;
  get diagnostics v_voided=row_count;

  update public.buklod_quiz_roster r
     set status='ACTIVE',updated_at=now()
   where r.exam_id=p_exam_id and r.section_id=p_section_id
     and r.student_user_id=p_student_user_id;

  return jsonb_build_object(
    'ok',true,'already_pending',false,'student_user_id',p_student_user_id,
    'source_attempt_id',v_attempt.id,'source_attempt_no',v_attempt.attempt_no,
    'voided_attempts',v_voided,'retake_pending',true
  );
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(p_exam_id uuid, p_section_id uuid, p_student_user_id uuid)
 RETURNS TABLE(student_user_id uuid, voided_attempts integer, reentry_session_id uuid, reentry_ready boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_session uuid;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  if not exists(
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then raise exception 'Exam/class not found or unauthorized.'; end if;

  if not exists(
    select 1 from public.buklod_quiz_roster r
    where r.exam_id=p_exam_id and r.section_id=p_section_id and r.student_user_id=p_student_user_id
  ) then raise exception 'Student is not part of this exam section.'; end if;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  select a.id,a.student_user_id,'FACULTY_RECORD_REMOVED_FOR_REENTRY',
    jsonb_build_object(
      'faculty_user_id',v_actor,'exam_id',p_exam_id,'section_id',p_section_id,
      'previous_status',a.status,'previous_total_score',a.total_score,
      'record_merge_key',p_exam_id::text||':'||p_section_id::text,
      'reason','Faculty removed current record and allowed a future re-entry'
    )
  from public.buklod_quiz_attempts a
  where a.exam_id=p_exam_id and a.section_id=p_section_id
    and a.student_user_id=p_student_user_id and a.status<>'VOID';

  update public.buklod_quiz_attempts a
     set status='VOID',updated_at=now()
   where a.exam_id=p_exam_id and a.section_id=p_section_id
     and a.student_user_id=p_student_user_id and a.status<>'VOID';
  get diagnostics v_count = row_count;

  update public.buklod_quiz_roster r
     set status='REMOVED',updated_at=now()
   where r.exam_id=p_exam_id and r.section_id=p_section_id
     and r.student_user_id=p_student_user_id;

  update public.buklod_quiz_live_members m
     set status='REMOVED',removed_at=now(),last_seen_at=now()
   where m.student_user_id=p_student_user_id
     and exists (
       select 1 from public.buklod_quiz_live_sessions ls
       where ls.id=m.session_id and ls.exam_id=p_exam_id and ls.section_id=p_section_id
     );

  select ls.id into v_session
  from public.buklod_quiz_live_sessions ls
  where ls.exam_id=p_exam_id and ls.section_id=p_section_id and ls.faculty_user_id=v_actor
  order by case ls.status when 'LIVE' then 0 when 'PAUSED' then 1 when 'WAITING' then 2 when 'ENDED' then 3 else 4 end,
           ls.created_at desc
  limit 1;

  return query select p_student_user_id,v_count,v_session,true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_records_retake_state_v1(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(student_user_id uuid, retake_pending boolean, requested_at timestamp with time zone, source_attempt_id uuid, source_attempt_no integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;

  if not exists (
    select 1
    from public.buklod_quiz_exams e
    join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id
    where e.id=p_exam_id and e.owner_user_id=v_actor
  ) then raise exception 'Exam/class not found or unauthorized.'; end if;

  return query
  select
    r.student_user_id,
    (
      rt.requested_at is not null
      and (current_attempt.created_at is null or current_attempt.created_at<=rt.requested_at)
    ) as retake_pending,
    rt.requested_at,
    rt.source_attempt_id,
    rt.source_attempt_no
  from public.buklod_quiz_roster r
  left join lateral (
    select ev.created_at as requested_at,src.id as source_attempt_id,src.attempt_no as source_attempt_no
    from public.buklod_quiz_events ev
    join public.buklod_quiz_attempts src on src.id=ev.attempt_id
    where ev.event_type='FACULTY_RETAKE_REQUESTED'
      and ev.student_user_id=r.student_user_id
      and src.exam_id=p_exam_id and src.section_id=p_section_id
      and src.student_user_id=r.student_user_id
    order by ev.created_at desc,ev.id desc
    limit 1
  ) rt on true
  left join lateral (
    select a.created_at
    from public.buklod_quiz_attempts a
    where a.exam_id=p_exam_id and a.section_id=p_section_id
      and a.student_user_id=r.student_user_id and a.status<>'VOID'
    order by a.attempt_no desc,a.created_at desc
    limit 1
  ) current_attempt on true
  where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  order by r.student_user_id;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_queue_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select a.id,r.id,a.student_user_id,ro.display_name,s.name,q.id,q.prompt,q.question_type,q.points,r.answer#>>'{}',r.manual_score,r.feedback from public.buklod_quiz_attempts a join public.buklod_quiz_responses r on r.attempt_id=a.id join public.buklod_quiz_questions q on q.id=r.question_id join public.buklod_quiz_roster ro on ro.exam_id=a.exam_id and ro.student_user_id=a.student_user_id join public.buklod_quiz_sections s on s.id=ro.section_id join public.buklod_quiz_exams e on e.id=a.exam_id where a.exam_id=p_exam_id and e.owner_user_id=auth.uid() and r.needs_review=true and a.status in('NEEDS_REVIEW','GRADED') order by s.sort_order,lower(ro.surname),lower(ro.first_name),a.attempt_no,q.sort_order $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_saved_answers_v1(p_attempt_id uuid)
 RETURNS TABLE(question_id uuid, answer_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select r.question_id,r.answer #>> '{}'
  from public.buklod_quiz_responses r
  join public.buklod_quiz_attempts a on a.id=r.attempt_id
  where r.attempt_id=p_attempt_id and a.student_user_id=(select auth.uid())
  order by r.saved_at,r.question_id
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_restore_exam_v1(p_exam_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.buklod_quiz_exams e
  set archived_at=null,archived_by=null,updated_at=now()
  where e.id=p_exam_id and e.owner_user_id=(select auth.uid());
  if not found then raise exception 'Exam not found or unauthorized.'; end if;
  insert into public.buklod_quiz_faculty_actions(actor_user_id,exam_id,action)
  values((select auth.uid()),p_exam_id,'EXAM_RESTORED');
  return true;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_job_start_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS buklod_quiz_review_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_job public.buklod_quiz_review_jobs;
  v_attempts uuid[];
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e where e.id=p_exam_id and e.owner_user_id=v_actor) then
    raise exception 'Exam owner access required.';
  end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id) then
    raise exception 'Section not found.';
  end if;

  select j.* into v_job
  from public.buklod_quiz_review_jobs j
  where j.exam_id=p_exam_id
    and j.section_id=p_section_id
    and j.created_by=v_actor
    and j.status in ('QUEUED','RUNNING')
  order by j.created_at desc
  limit 1;
  if found then return v_job; end if;

  select coalesce(array_agg(distinct a.id order by a.id), '{}') into v_attempts
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=r.question_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status='NEEDS_REVIEW'
    and r.manual_score is null
    and coalesce(r.needs_review,false)=true
    and upper(q.question_type) in ('SHORT_TEXT','ESSAY','ENUMERATION','MANUAL');

  insert into public.buklod_quiz_review_jobs(
    exam_id,section_id,created_by,status,attempt_ids,total_attempts,started_at,heartbeat_at
  ) values (
    p_exam_id,p_section_id,v_actor,
    case when coalesce(array_length(v_attempts,1),0)=0 then 'COMPLETED' else 'QUEUED' end,
    v_attempts,coalesce(array_length(v_attempts,1),0),
    case when coalesce(array_length(v_attempts,1),0)>0 then now() end,
    now()
  ) returning * into v_job;

  if v_job.total_attempts=0 then
    update public.buklod_quiz_review_jobs
    set completed_at=now(),updated_at=now()
    where id=v_job.id
    returning * into v_job;
  end if;

  return v_job;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_queue_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, surname text, first_name text, section_id uuid, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    a.id,
    r.id,
    a.student_user_id,
    ro.display_name,
    ro.surname,
    ro.first_name,
    s.id,
    s.name,
    q.id,
    q.prompt,
    q.question_type,
    q.points,
    r.answer#>>'{}',
    r.manual_score,
    r.feedback
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_responses r on r.attempt_id=a.id
  join public.buklod_quiz_questions q on q.id=r.question_id
  join public.buklod_quiz_roster ro
    on ro.exam_id=a.exam_id
   and ro.section_id=a.section_id
   and ro.student_user_id=a.student_user_id
  join public.buklod_quiz_sections s
    on s.id=a.section_id
   and s.exam_id=a.exam_id
  join public.buklod_quiz_exams e on e.id=a.exam_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and e.owner_user_id=(select auth.uid())
    and r.needs_review=true
    and a.status in ('NEEDS_REVIEW','GRADED')
  order by lower(coalesce(nullif(ro.surname,''),nullif(ro.display_name,''),'zzzz')),
           lower(coalesce(ro.first_name,'')),
           lower(coalesce(ro.display_name,'')),
           a.attempt_no,
           q.sort_order
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_review_response_v1(p_response_id uuid, p_manual_score numeric, p_feedback text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare pts numeric; v_attempt uuid;
begin
  select r.attempt_id,aq.points into v_attempt,pts
  from public.buklod_quiz_responses r
  join public.buklod_quiz_attempts a on a.id=r.attempt_id
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_attempt_questions aq on aq.attempt_id=a.id and aq.question_id=r.question_id
  where r.id=p_response_id and e.owner_user_id=auth.uid()
    and a.status in ('NEEDS_REVIEW','GRADED') and r.needs_review=true;
  if pts is null then raise exception 'Response not found, not reviewable, or unauthorized.'; end if;
  if p_manual_score<0 or p_manual_score>pts then raise exception 'Manual score must be from 0 to %.',pts; end if;
  update public.buklod_quiz_responses
  set manual_score=p_manual_score,feedback=nullif(trim(coalesce(p_feedback,'')),''),
      reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_response_id;
  return true;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v1(p_attempt_id uuid, p_answers jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype; v_count integer; v_len integer;
begin
  if jsonb_typeof(p_answers)<>'array' then raise exception 'Answers payload must be an array.'; end if;
  v_len:=jsonb_array_length(p_answers);
  if v_len<1 then return 0; end if;
  if v_len>50 then raise exception 'Maximum 50 answers per batch.'; end if;

  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id and x.student_user_id=(select auth.uid());
  if a.id is null then raise exception 'Attempt not found.'; end if;
  if a.status<>'STARTED' then
    if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then return 0; end if;
    raise exception 'Attempt is not active.';
  end if;
  if a.expires_at<=now() then perform public.buklod_quiz_compute_attempt_internal(a.id); raise exception 'Time limit has ended.'; end if;
  if a.live_session_id is not null and not exists(select 1 from public.buklod_quiz_live_sessions ls where ls.id=a.live_session_id and ls.status='LIVE') then raise exception 'Live class is paused or ended.'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_answers) j
    where not exists(
      select 1 from public.buklod_quiz_questions q
      where q.id=(j->>'question_id')::uuid and q.exam_id=a.exam_id and q.is_active=true
    )
  ) then raise exception 'One or more question IDs are invalid for this exam.'; end if;

  with payload as (
    select (j->>'question_id')::uuid question_id,j->'answer' answer
    from jsonb_array_elements(p_answers) j
  ), up as (
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
    select a.id,p.question_id,(select auth.uid()),p.answer,now(),now() from payload p
    on conflict(attempt_id,question_id) do update set answer=excluded.answer,student_user_id=excluded.student_user_id,saved_at=now(),updated_at=now()
    returning 1
  ) select count(*) into v_count from up;
  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v1(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.buklod_quiz_attempts%rowtype;
begin
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id and x.student_user_id=(select auth.uid());
  if a.id is null then raise exception 'Attempt not found.'; end if;
  if a.status<>'STARTED' then
    if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then return true; end if;
    raise exception 'Attempt is not active.';
  end if;
  if a.expires_at<=now() then perform public.buklod_quiz_compute_attempt_internal(a.id); raise exception 'Time limit has ended.'; end if;
  if a.live_session_id is not null and not exists(select 1 from public.buklod_quiz_live_sessions ls where ls.id=a.live_session_id and ls.status='LIVE') then raise exception 'Live class is paused or ended.'; end if;
  if not exists(select 1 from public.buklod_quiz_questions q where q.id=p_question_id and q.exam_id=a.exam_id and q.is_active=true) then raise exception 'Question is not part of this exam.'; end if;
  insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
  values(a.id,p_question_id,(select auth.uid()),p_answer,now(),now())
  on conflict(attempt_id,question_id) do update set answer=excluded.answer,student_user_id=excluded.student_user_id,saved_at=now(),updated_at=now();
  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answer_v2(p_attempt_id uuid, p_question_id uuid, p_answer jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.buklod_quiz_save_answer_v1(p_attempt_id,p_question_id,p_answer);
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_save_answers_batch_v2(p_attempt_id uuid, p_answers jsonb, p_device_token text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.buklod_quiz_save_answers_batch_v1(p_attempt_id, p_answers);
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_search_people_v1(p_query text, p_limit integer DEFAULT 50)
 RETURNS TABLE(user_id uuid, display_name text, username text, surname text, first_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_q text := lower(trim(coalesce(p_query,'')));
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if length(v_q) < 2 then return; end if;

  return query
  select
    p.id,
    coalesce(nullif(trim(p.full_name),''), nullif(trim(concat_ws(' ',p.first_name,p.surname)),''), p.username, p.email, 'BUKLOD User')::text,
    p.username::text,
    coalesce(p.surname,'')::text,
    coalesce(p.first_name,'')::text
  from public.profiles p
  where p.is_active = true
    and (
      lower(coalesce(p.full_name,'')) like '%'||v_q||'%'
      or lower(coalesce(p.username,'')) like '%'||v_q||'%'
      or lower(coalesce(p.email,'')) like '%'||v_q||'%'
      or lower(coalesce(p.mobile,'')) like '%'||v_q||'%'
      or lower(coalesce(p.surname,'')) like '%'||v_q||'%'
      or lower(coalesce(p.first_name,'')) like '%'||v_q||'%'
    )
  order by lower(coalesce(nullif(p.surname,''), p.full_name, p.username, p.email, '')), lower(coalesce(p.first_name,'')), p.id
  limit v_limit;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_section_analytics_v2(p_exam_id uuid, p_section_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid := (select auth.uid()); v_result jsonb;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if not public.buklod_quiz_is_examiner(v_actor) then raise exception 'Examiner access required.'; end if;
  if not exists(select 1 from public.buklod_quiz_exams e join public.buklod_quiz_sections s on s.exam_id=e.id and s.id=p_section_id where e.id=p_exam_id and e.owner_user_id=v_actor) then raise exception 'Exam owner access required.'; end if;
  with roster as (
    select r.student_user_id from public.buklod_quiz_roster r where r.exam_id=p_exam_id and r.section_id=p_section_id and r.status='ACTIVE'
  ), latest as (
    select r.student_user_id,a.id attempt_id,a.status,a.total_score,a.max_score
    from roster r left join lateral (
      select ax.id,ax.status,ax.total_score,ax.max_score from public.buklod_quiz_attempts ax
      where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc limit 1
    ) a on true
  ), diag as (
    select * from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id)
  ), enriched as (
    select l.*,coalesce(d.response_count,0) response_count,coalesce(d.pending_review_count,0) pending_review_count,
      coalesce(d.legacy_score_only,false) legacy_score_only,coalesce(d.score_available,false) score_available,
      coalesce(d.item_data_available,false) item_data_available,coalesce(d.release_eligible,false) release_eligible
    from latest l left join diag d on d.student_user_id=l.student_user_id
  ), exam_cfg as (
    select e.pass_percent from public.buklod_quiz_exams e where e.id=p_exam_id
  ), score_finalish as (
    select e.* from enriched e where e.score_available=true and (e.status in ('GRADED','RELEASED') or e.legacy_score_only=true or (e.status='NEEDS_REVIEW' and e.pending_review_count=0 and e.response_count>0))
  ), item_attempts as (
    select e.* from enriched e where e.attempt_id is not null and e.response_count>0 and e.status in ('NEEDS_REVIEW','GRADED','RELEASED')
  ), questions as (
    select q.*,row_number() over(order by q.sort_order,q.id)::integer question_no from public.buklod_quiz_questions q where q.exam_id=p_exam_id and q.is_active=true
  ), item_rows as (
    select q.id question_id,q.question_no,q.question_type,q.prompt,q.options,q.points,
      count(ia.attempt_id)::integer submitted_count,
      count(*) filter(where ia.attempt_id is not null and r.answer is not null and nullif(trim(case when jsonb_typeof(r.answer)='string' then r.answer#>>'{}' else r.answer::text end),'') is not null)::integer answered_count,
      count(*) filter(where ia.attempt_id is not null and (r.is_correct=true or (r.is_correct is null and coalesce(r.manual_score,r.objective_score,0)>=q.points and q.points>0)))::integer correct_count,
      count(*) filter(where ia.attempt_id is not null and (r.is_correct=false or (r.is_correct is null and r.manual_score is not null and coalesce(r.manual_score,0)=0)))::integer incorrect_count,
      count(*) filter(where ia.attempt_id is not null and r.is_correct is null and r.manual_score is not null and r.manual_score>0 and r.manual_score<q.points)::integer partial_count,
      count(*) filter(where ia.attempt_id is not null and r.needs_review=true and r.manual_score is null)::integer pending_review_count,
      count(*) filter(where ia.attempt_id is not null and (r.answer is null or nullif(trim(case when jsonb_typeof(r.answer)='string' then r.answer#>>'{}' else r.answer::text end),'') is null))::integer unanswered_count
    from questions q left join item_attempts ia on true left join public.buklod_quiz_responses r on r.attempt_id=ia.attempt_id and r.question_id=q.id
    group by q.id,q.question_no,q.question_type,q.prompt,q.options,q.points
  ), items as (
    select case when (select count(*) from item_attempts)=0 then '[]'::jsonb else coalesce(jsonb_agg(
      jsonb_build_object(
        'question_id',i.question_id,'question_no',i.question_no,'question_type',i.question_type,'prompt',i.prompt,
        'submitted_count',i.submitted_count,'answered_count',i.answered_count,'correct_count',i.correct_count,
        'incorrect_count',i.incorrect_count,'partial_count',i.partial_count,'pending_review_count',i.pending_review_count,'unanswered_count',i.unanswered_count,
        'option_counts',case when i.question_type='MCQ' and jsonb_typeof(i.options)='array' then (
          select coalesce(jsonb_agg(jsonb_build_object('label',chr(64+opt.ord::integer),'option',opt.option_text,'count',(
            select count(*)::integer from item_attempts ia2 join public.buklod_quiz_responses r2 on r2.attempt_id=ia2.attempt_id and r2.question_id=i.question_id
            where lower(trim(case when jsonb_typeof(r2.answer)='string' then r2.answer#>>'{}' else r2.answer::text end))=lower(trim(opt.option_text))
          )) order by opt.ord),'[]'::jsonb)
          from jsonb_array_elements_text(i.options) with ordinality opt(option_text,ord)
        ) else '[]'::jsonb end
      ) order by i.question_no
    ),'[]'::jsonb) end value from item_rows i
  )
  select jsonb_build_object(
    'ok',true,
    'summary',jsonb_build_object(
      'active_students',(select count(*) from enriched),
      'submitted',(select count(*) from enriched where attempt_id is not null and status<>'STARTED'),
      'pending_review',(select count(*) from enriched where pending_review_count>0),
      'review_complete_stale',(select count(*) from enriched where status='NEEDS_REVIEW' and pending_review_count=0 and response_count>0),
      'legacy_score_only',(select count(*) from enriched where legacy_score_only=true),
      'in_progress',(select count(*) from enriched where status='STARTED'),
      'not_started',(select count(*) from enriched where attempt_id is null),
      'release_eligible',(select count(*) from enriched where release_eligible=true),
      'item_analyzed_attempts',(select count(*) from item_attempts),
      'item_data_available',((select count(*) from item_attempts)>0),
      'score_analyzed_attempts',(select count(*) from score_finalish),
      'passed',(select count(*) from score_finalish s cross join exam_cfg e where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)>=e.pass_percent),
      'not_passed',(select count(*) from score_finalish s cross join exam_cfg e where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)<e.pass_percent),
      'pass_percent',(select pass_percent from exam_cfg)
    ),
    'items',(select value from items),
    'notice',case
      when (select count(*) from item_attempts)=0 then 'No item-level response data is retained for this section. Recorded scores remain available; item answers and item statistics will not be fabricated.'
      when (select count(*) from item_attempts)<(select count(*) from enriched where attempt_id is not null and status<>'STARTED') then 'Item analytics includes only attempts with retained response data. Some historical score-only records are excluded from item statistics.'
      else 'Item analytics uses retained response rows from the latest official attempts.' end
  ) into v_result;
  return v_result;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_seed_attempt_questions_v1(p_attempt_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.buklod_quiz_seed_attempt_questions_v2(p_attempt_id)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_student_questions_v1(p_attempt_id uuid)
 RETURNS TABLE(question_id uuid, question_type text, prompt text, options jsonb, points numeric, display_order integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with a as (
    select x.id,x.exam_id,e.randomize_questions
    from public.buklod_quiz_attempts x
    join public.buklod_quiz_sections sx on sx.id=x.section_id and sx.archived_at is null
    join public.buklod_quiz_exams e on e.id=x.exam_id
    where x.id=p_attempt_id and x.student_user_id=(select auth.uid()) and x.status='STARTED'
  ), ordered as (
    select q.id,q.question_type,q.prompt,q.options,q.points,
      row_number() over(order by
        case when a.randomize_questions then md5(q.id::text || ':' || a.id::text) else lpad(q.sort_order::text,10,'0') end,
        q.id::text
      )::integer display_order
    from a join public.buklod_quiz_questions q on q.exam_id=a.exam_id and q.is_active=true
  )
  select id,question_type,prompt,options,points,display_order from ordered order by display_order
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_section_records_v2(p_exam_id uuid, p_section_id uuid, p_sort text DEFAULT 'SCORE_DESC'::text)
 RETURNS TABLE(section_id uuid, section_name text, student_user_id uuid, surname text, first_name text, display_name text, student_no text, attempt_no integer, attempt_status text, total_score numeric, max_score numeric, score_percent numeric, rank_no integer, released_at timestamp with time zone, integrity_events integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with base as (
    select
      s.id as section_id,
      s.name as section_name,
      r.student_user_id,
      r.surname,
      r.first_name,
      r.display_name,
      r.student_no,
      a.attempt_no,
      a.status as attempt_status,
      a.total_score,
      a.max_score,
      case when coalesce(a.max_score,0)>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end as score_percent,
      a.released_at,
      coalesce(a.integrity_violation_count,0)::int as integrity_events
    from public.buklod_quiz_sections s
    join public.buklod_quiz_exams e
      on e.id=s.exam_id
     and e.owner_user_id=(select auth.uid())
    join public.buklod_quiz_roster r
      on r.exam_id=s.exam_id
     and r.section_id=s.id
     and r.status='ACTIVE'
    left join lateral (
      select x.*
      from public.buklod_quiz_attempts x
      where x.exam_id=r.exam_id
        and x.section_id=r.section_id
        and x.student_user_id=r.student_user_id
        and x.status<>'VOID'
      order by x.attempt_no desc
      limit 1
    ) a on true
    where s.exam_id=p_exam_id
      and s.id=p_section_id
  ), ranked as (
    select b.*,
      case
        when b.total_score is null then null
        else dense_rank() over(order by b.total_score desc nulls last)::int
      end as rank_no
    from base b
  )
  select
    r.section_id,r.section_name,r.student_user_id,r.surname,r.first_name,r.display_name,
    r.student_no,r.attempt_no,r.attempt_status,r.total_score,r.max_score,r.score_percent,
    r.rank_no,r.released_at,r.integrity_events
  from ranked r
  order by
    case when upper(coalesce(p_sort,'SCORE_DESC'))='SCORE_DESC' then r.total_score end desc nulls last,
    lower(coalesce(nullif(r.surname,''),nullif(r.display_name,''),'zzzz')),
    lower(coalesce(r.first_name,'')),
    lower(coalesce(r.display_name,''))
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_seed_attempt_questions_v2(p_attempt_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_count integer; v_raw numeric; v_target numeric; v_sum numeric; v_last integer;
begin
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id;
  if a.id is null then raise exception 'Attempt not found.'; end if;
  select count(*)::int into v_count from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id;
  if v_count>0 then return v_count; end if;
  select x.* into e from public.buklod_quiz_exams x where x.id=a.exam_id;

  if a.live_session_id is not null then
    select x.* into s from public.buklod_quiz_live_sessions x where x.id=a.live_session_id and x.exam_id=a.exam_id and x.section_id=a.section_id;
    if exists(select 1 from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id) then
      select coalesce(sum(x.points),0) into v_raw from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
      v_target:=coalesce(nullif(s.total_score_target,0),nullif(v_raw,0),1);
      insert into public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points)
      select a.id,x.question_id,
        row_number() over(order by case when coalesce(s.randomize_questions,false) then md5(a.id::text||':'||x.question_id::text) end,x.snapshot_order,x.question_id)::int,
        x.points,
        case when v_raw>0 then round((x.points*v_target/v_raw)::numeric,6)
             else round((v_target/greatest(count(*) over(),1))::numeric,6) end
      from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id
      on conflict do nothing;
    else
      -- Compatibility for a room that started before R10 snapshotting existed.
      select coalesce(sum(q.points),0) into v_raw from public.buklod_quiz_questions q
      where q.exam_id=a.exam_id and q.is_active=true
        and (coalesce(array_length(s.selected_question_ids,1),0)=0 or q.id=any(s.selected_question_ids));
      v_target:=coalesce(nullif(s.total_score_target,0),nullif(v_raw,0),1);
      insert into public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points)
      select a.id,q.id,
        row_number() over(order by case when coalesce(s.randomize_questions,false) then md5(a.id::text||':'||q.id::text) end,q.sort_order,q.id)::int,
        q.points,case when v_raw>0 then round((q.points*v_target/v_raw)::numeric,6) else q.points end
      from public.buklod_quiz_questions q
      where q.exam_id=a.exam_id and q.is_active=true
        and (coalesce(array_length(s.selected_question_ids,1),0)=0 or q.id=any(s.selected_question_ids))
      on conflict do nothing;
    end if;
  else
    insert into public.buklod_quiz_attempt_questions(attempt_id,question_id,display_order,source_points,points)
    select a.id,q.id,
      row_number() over(order by case when coalesce(e.randomize_questions,false) then md5(a.id::text||':'||q.id::text) end,q.sort_order,q.id)::int,
      q.points,q.points
    from public.buklod_quiz_questions q where q.exam_id=a.exam_id and q.is_active=true
    on conflict do nothing;
  end if;

  select count(*)::int,coalesce(sum(aq.points),0),max(aq.display_order)
    into v_count,v_sum,v_last from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id;
  if a.live_session_id is not null and v_last is not null and v_sum is distinct from v_target then
    update public.buklod_quiz_attempt_questions aq set points=aq.points+(v_target-v_sum)
    where aq.attempt_id=a.id and aq.display_order=v_last;
  end if;
  update public.buklod_quiz_attempts x set max_score=coalesce((select sum(aq.points) from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id),0),updated_at=now()
  where x.id=a.id;
  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_set_exam_security_custom_v1(p_exam_id uuid, p_device_policy text, p_behavior_monitoring boolean, p_offline_security_mode text, p_live_join_policy text, p_require_fullscreen_web boolean, p_block_screen_capture boolean, p_randomize_questions boolean, p_randomize_choices boolean, p_one_question_at_a_time boolean, p_no_backtracking boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_device text := upper(btrim(coalesce(p_device_policy,'')));
  v_offline text := upper(btrim(coalesce(p_offline_security_mode,'')));
  v_join text := upper(btrim(coalesce(p_live_join_policy,'')));
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if v_device not in ('MONITOR','LOCK') then raise exception 'Invalid device policy.'; end if;
  if v_offline not in ('DISABLED','SIGNED_LEASE') then raise exception 'Invalid offline security mode.'; end if;
  if v_join not in ('OPEN','ROSTER_ONLY','APPROVAL','ROSTER_APPROVAL') then raise exception 'Invalid live join policy.'; end if;

  update public.buklod_quiz_exams e set
    security_preset='CUSTOM',device_policy=v_device,
    behavior_monitoring=coalesce(p_behavior_monitoring,true),
    offline_security_mode=v_offline,default_live_join_policy=v_join,
    require_fullscreen_web=coalesce(p_require_fullscreen_web,true),
    block_screen_capture=coalesce(p_block_screen_capture,true),
    randomize_questions=coalesce(p_randomize_questions,true),
    randomize_choices=coalesce(p_randomize_choices,false),
    one_question_at_a_time=coalesce(p_one_question_at_a_time,true),
    no_backtracking=coalesce(p_no_backtracking,false),updated_at=now()
  where e.id=p_exam_id and e.owner_user_id=v_actor
    and public.buklod_quiz_is_examiner(v_actor);

  if not found then raise exception 'Exam not found or unauthorized.'; end if;

  perform public.buklod_quiz_audit_write_v1(
    p_exam_id,null,null,null,'SECURITY_CUSTOM_UPDATED',
    jsonb_build_object(
      'device_policy',v_device,'behavior_monitoring',coalesce(p_behavior_monitoring,true),
      'offline_security_mode',v_offline,'live_join_policy',v_join,
      'require_fullscreen_web',coalesce(p_require_fullscreen_web,true),
      'block_screen_capture',coalesce(p_block_screen_capture,true),
      'randomize_questions',coalesce(p_randomize_questions,true),
      'randomize_choices',coalesce(p_randomize_choices,false),
      'one_question_at_a_time',coalesce(p_one_question_at_a_time,true),
      'no_backtracking',coalesce(p_no_backtracking,false)
    ),v_actor
  );
  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_set_integrity_deduction_rules_v1(p_rules jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  v_item jsonb;
  v_type text;
  v_points numeric;
  v_note text;
  v_enabled boolean;
  v_count integer := 0;
begin
  if v_actor is null then raise exception 'Authentication required.'; end if;
  if jsonb_typeof(p_rules) is distinct from 'array' then raise exception 'Rules must be a JSON array.'; end if;

  for v_item in select value from jsonb_array_elements(p_rules)
  loop
    v_type := upper(btrim(coalesce(v_item->>'event_type','')));
    begin
      v_points := coalesce((v_item->>'points_per_occurrence')::numeric,0);
      v_enabled := coalesce((v_item->>'is_enabled')::boolean,false);
    exception when others then
      raise exception 'Invalid integrity auto-set rule.';
    end;
    v_note := nullif(btrim(coalesce(v_item->>'note_template','')), '');

    if v_type not in (
      'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
      'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
    ) then raise exception 'Unsupported integrity violation type: %',v_type; end if;
    if v_points < 0 then raise exception 'Auto-set points cannot be negative.'; end if;

    insert into public.buklod_quiz_integrity_deduction_rules(
      owner_user_id,event_type,points_per_occurrence,note_template,is_enabled,updated_at
    ) values (
      v_actor,v_type,v_points,v_note,v_enabled,now()
    )
    on conflict(owner_user_id,event_type)
    do update set
      points_per_occurrence=excluded.points_per_occurrence,
      note_template=excluded.note_template,
      is_enabled=excluded.is_enabled,
      updated_at=now();

    v_count := v_count + 1;
  end loop;

  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v1(p_exam_id uuid, p_section_id uuid, p_deductions jsonb)
 RETURNS TABLE(saved_count integer, total_deduction numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owner uuid;
  v_item jsonb;
  v_attempt_id uuid;
  v_event_type text;
  v_points numeric;
  v_note text;
  v_saved integer:=0;
  v_total numeric:=0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required.'; end if;
  select e.owner_user_id into v_owner from public.buklod_quiz_exams e where e.id=p_exam_id;
  if v_owner is null or v_owner<>(select auth.uid()) then raise exception 'Exam not found or unauthorized.'; end if;
  if not exists(select 1 from public.buklod_quiz_sections s where s.id=p_section_id and s.exam_id=p_exam_id) then
    raise exception 'Class / section not found for this exam.';
  end if;
  if p_deductions is null or jsonb_typeof(p_deductions)<>'array' then raise exception 'p_deductions must be a JSON array.'; end if;

  for v_item in select value from jsonb_array_elements(p_deductions)
  loop
    begin
      v_attempt_id:=nullif(v_item->>'attempt_id','')::uuid;
      v_event_type:=upper(btrim(coalesce(v_item->>'event_type','')));
      v_points:=coalesce((v_item->>'deduction_points')::numeric,0);
    exception when others then
      raise exception 'Each deduction needs valid attempt_id, event_type, and numeric deduction_points.';
    end;
    v_note:=nullif(btrim(coalesce(v_item->>'note','')),'');

    if v_event_type not in (
      'APP_EXIT_OR_BACKGROUND','USER_LEFT_EXAM','TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT',
      'SCREENSHOT_ATTEMPT','SCREEN_CAPTURE_DETECTED','COPY_ATTEMPT','CONTEXT_MENU_ATTEMPT','DEVTOOLS_SHORTCUT_ATTEMPT'
    ) then raise exception 'Unsupported integrity violation type: %',v_event_type; end if;
    if v_points<0 then raise exception 'Deduction cannot be negative.'; end if;

    if not exists(
      select 1 from public.buklod_quiz_attempts a
      where a.id=v_attempt_id and a.exam_id=p_exam_id and a.section_id=p_section_id and a.status in ('NEEDS_REVIEW','GRADED')
    ) then raise exception 'Attempt is stale, released, or not part of this class.'; end if;

    if not exists(
      select 1 from public.buklod_quiz_events ev
      where ev.attempt_id=v_attempt_id
        and (
          (v_event_type='TAB_HIDDEN' and ev.event_type in ('TAB_HIDDEN','APP_EXIT_OR_BACKGROUND'))
          or (v_event_type<>'TAB_HIDDEN' and ev.event_type=v_event_type)
        )
    ) then raise exception 'This violation was not recorded for the attempt.'; end if;

    if v_event_type='TAB_HIDDEN' then
      delete from public.buklod_quiz_integrity_deductions d
      where d.attempt_id=v_attempt_id and d.event_type='APP_EXIT_OR_BACKGROUND';
    end if;

    if v_points=0 and v_note is null then
      delete from public.buklod_quiz_integrity_deductions d where d.attempt_id=v_attempt_id and d.event_type=v_event_type;
    else
      insert into public.buklod_quiz_integrity_deductions(attempt_id,event_type,deduction_points,note,applied_by,created_at,updated_at)
      values(v_attempt_id,v_event_type,v_points,v_note,(select auth.uid()),pg_catalog.now(),pg_catalog.now())
      on conflict(attempt_id,event_type) do update set
        deduction_points=excluded.deduction_points,note=excluded.note,applied_by=excluded.applied_by,updated_at=pg_catalog.now();
    end if;
    v_saved:=v_saved+1;
  end loop;

  select coalesce(sum(d.deduction_points),0) into v_total
  from public.buklod_quiz_integrity_deductions d
  join public.buklod_quiz_attempts a on a.id=d.attempt_id
  where a.exam_id=p_exam_id and a.section_id=p_section_id and a.status in ('NEEDS_REVIEW','GRADED');

  return query select v_saved,v_total;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v2(p_exam_id uuid, p_section_id uuid, p_deductions jsonb)
 RETURNS TABLE(saved_count integer, total_deduction numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_saved integer;
  v_total numeric;
  v_attempt_id uuid;
begin
  select x.saved_count,x.total_deduction
    into v_saved,v_total
  from public.buklod_quiz_set_integrity_deductions_batch_v1(
    p_exam_id,p_section_id,p_deductions
  ) x;

  for v_attempt_id in
    select distinct nullif(x->>'attempt_id','')::uuid
    from jsonb_array_elements(p_deductions) x
    where nullif(x->>'attempt_id','') is not null
  loop
    if exists(
      select 1 from public.buklod_quiz_attempts a
      where a.id=v_attempt_id
        and a.exam_id=p_exam_id
        and a.section_id=p_section_id
        and a.status in ('NEEDS_REVIEW','GRADED')
    ) then
      perform public.buklod_quiz_compute_attempt_internal(v_attempt_id);
    end if;
  end loop;

  select coalesce(sum(d.deduction_points),0)
    into v_total
  from public.buklod_quiz_integrity_deductions d
  join public.buklod_quiz_attempts a on a.id=d.attempt_id
  where a.exam_id=p_exam_id
    and a.section_id=p_section_id
    and a.status in ('NEEDS_REVIEW','GRADED');

  return query select coalesce(v_saved,0),coalesce(v_total,0);
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_snapshot_live_session_v1(p_session_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid());
  s public.buklod_quiz_live_sessions%rowtype;
  e public.buklod_quiz_exams%rowtype;
  v_selected uuid[];
  v_expected integer;
  v_count integer;
  v_hash text;
  v_pts numeric;
  v_actor_kind text;
begin
  select ls.* into s
  from public.buklod_quiz_live_sessions ls
  where ls.id=p_session_id
    and (
      ls.faculty_user_id=v_actor
      or (
        ls.status='LIVE'
        and exists(
          select 1 from public.buklod_quiz_live_members m
          where m.session_id=ls.id and m.student_user_id=v_actor and m.status='ADMITTED'
        )
      )
    )
  for update;
  if s.id is null then raise exception 'Live class not found or unauthorized.'; end if;
  v_actor_kind:=case when s.faculty_user_id=v_actor then 'FACULTY' else 'ADMITTED_STUDENT_LEGACY_RECOVERY' end;

  select x.* into e from public.buklod_quiz_exams x where x.id=s.exam_id;
  if e.id is null then raise exception 'Exam not found.'; end if;

  select count(*)::int into v_count
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count>0 then return v_count; end if;

  v_selected:=s.selected_question_ids;
  if coalesce(array_length(v_selected,1),0)=0 then
    select array_agg(q.id order by q.sort_order,q.id) into v_selected
    from public.buklod_quiz_questions q
    where q.exam_id=s.exam_id and q.is_active=true;
  end if;
  v_expected:=coalesce(array_length(v_selected,1),0);
  if v_expected<1 then raise exception 'Add at least one active question before starting.'; end if;

  if exists(
    select 1 from unnest(v_selected) x(question_id)
    where not exists(
      select 1 from public.buklod_quiz_questions q
      where q.id=x.question_id and q.exam_id=s.exam_id and q.is_active=true
    )
  ) then raise exception 'One or more selected live questions are missing or inactive.'; end if;

  insert into public.buklod_quiz_live_question_snapshots(
    session_id,question_id,question_type,prompt,options,correct_answer,points,sort_order,
    source_pages,rubric,explanation,snapshot_order
  )
  select s.id,q.id,q.question_type,q.prompt,q.options,q.correct_answer,q.points,q.sort_order,
         q.source_pages,q.rubric,q.explanation,
         coalesce(array_position(v_selected,q.id),row_number() over(order by q.sort_order,q.id)::int)
  from public.buklod_quiz_questions q
  where q.exam_id=s.exam_id and q.id=any(v_selected) and q.is_active=true
  order by coalesce(array_position(v_selected,q.id),q.sort_order),q.id;

  select count(*)::int,coalesce(sum(x.points),0),
         md5(string_agg(
           x.question_id::text||'|'||x.question_type||'|'||x.prompt||'|'||
           coalesce(x.options::text,'')||'|'||coalesce(x.correct_answer::text,'')||'|'||
           x.points::text||'|'||x.snapshot_order::text,
           '||' order by x.snapshot_order,x.question_id
         ))
    into v_count,v_pts,v_hash
  from public.buklod_quiz_live_question_snapshots x where x.session_id=s.id;
  if v_count<>v_expected then raise exception 'Live question snapshot is incomplete.'; end if;

  update public.buklod_quiz_live_sessions ls set
    selected_question_ids=v_selected,question_count=v_count,
    total_score_target=coalesce(nullif(ls.total_score_target,0),v_pts),
    duration_minutes=coalesce(ls.duration_minutes,e.duration_minutes),
    max_attempts=coalesce(ls.max_attempts,e.max_attempts),
    pass_percent=coalesce(ls.pass_percent,e.pass_percent),
    randomize_questions=coalesce(ls.randomize_questions,e.randomize_questions),
    randomize_choices=coalesce(ls.randomize_choices,e.randomize_choices),
    one_question_at_a_time=coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
    no_backtracking=coalesce(ls.no_backtracking,e.no_backtracking),
    require_fullscreen_web=coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
    block_screen_capture=coalesce(ls.block_screen_capture,e.block_screen_capture),
    integrity_mode=coalesce(ls.integrity_mode,e.integrity_mode),
    security_preset=coalesce(ls.security_preset,e.security_preset),
    device_policy=coalesce(ls.device_policy,e.device_policy),
    behavior_monitoring=coalesce(ls.behavior_monitoring,e.behavior_monitoring),
    offline_security_mode=coalesce(ls.offline_security_mode,e.offline_security_mode),
    join_policy=coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
    settings_snapshot=jsonb_build_object(
      'duration_minutes',coalesce(ls.duration_minutes,e.duration_minutes),
      'max_attempts',coalesce(ls.max_attempts,e.max_attempts),
      'pass_percent',coalesce(ls.pass_percent,e.pass_percent),
      'randomize_questions',coalesce(ls.randomize_questions,e.randomize_questions),
      'randomize_choices',coalesce(ls.randomize_choices,e.randomize_choices),
      'one_question_at_a_time',coalesce(ls.one_question_at_a_time,e.one_question_at_a_time),
      'no_backtracking',coalesce(ls.no_backtracking,e.no_backtracking),
      'require_fullscreen_web',coalesce(ls.require_fullscreen_web,e.require_fullscreen_web),
      'block_screen_capture',coalesce(ls.block_screen_capture,e.block_screen_capture),
      'integrity_mode',coalesce(ls.integrity_mode,e.integrity_mode),
      'security_preset',coalesce(ls.security_preset,e.security_preset),
      'device_policy',coalesce(ls.device_policy,e.device_policy),
      'behavior_monitoring',coalesce(ls.behavior_monitoring,e.behavior_monitoring),
      'offline_security_mode',coalesce(ls.offline_security_mode,e.offline_security_mode),
      'join_policy',coalesce(nullif(ls.join_policy,''),e.default_live_join_policy),
      'snapshot_hash',v_hash,'snapshot_question_count',v_count
    ),
    question_snapshot_hash=v_hash,config_locked_at=coalesce(ls.config_locked_at,now()),updated_at=now()
  where ls.id=s.id;

  perform public.buklod_quiz_audit_write_v1(
    s.exam_id,s.section_id,s.id,null,'LIVE_SNAPSHOT_LOCKED',
    jsonb_build_object('question_count',v_count,'snapshot_hash',v_hash,'total_points',v_pts,'actor_kind',v_actor_kind),v_actor
  );
  return v_count;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select * from public.buklod_quiz_start_attempt_v2(p_exam_id,null)
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_start_attempt_v2(p_exam_id uuid, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(attempt_id uuid, status text, expires_at timestamp with time zone, duration_minutes integer, one_question_at_a_time boolean, no_backtracking boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select *
  from public.buklod_quiz_start_attempt_v1(p_exam_id);
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v1(p_attempt_id uuid)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype; v_status text; v_live_status text;
begin
  select x.* into a from public.buklod_quiz_attempts x
  where x.id=p_attempt_id and x.student_user_id=(select auth.uid()) for update;
  if a.id is null then raise exception 'Attempt not found.'; end if;
  if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    return query select x.status,x.total_score,x.max_score from public.buklod_quiz_attempts x where x.id=a.id; return;
  end if;
  if a.status<>'STARTED' then raise exception 'Attempt is not active.'; end if;

  if a.live_session_id is not null then
    select ls.status into v_live_status
    from public.buklod_quiz_live_sessions ls
    join public.buklod_quiz_live_members lm
      on lm.session_id=ls.id and lm.student_user_id=(select auth.uid()) and lm.status='ADMITTED'
    where ls.id=a.live_session_id;
    if v_live_status='PAUSED' then raise exception 'Live class is paused by faculty.';
    elsif v_live_status='ENDED' then raise exception 'Live class has ended.';
    elsif v_live_status is distinct from 'LIVE' then raise exception 'This live class is not active.'; end if;
  end if;

  perform public.buklod_quiz_seed_attempt_questions_v1(a.id);
  insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer)
  select a.id,aq.question_id,(select auth.uid()),null
  from public.buklod_quiz_attempt_questions aq where aq.attempt_id=a.id
  on conflict do nothing;

  v_status:=public.buklod_quiz_compute_attempt_internal(a.id);
  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,(select auth.uid()),'ATTEMPT_SUBMITTED',
         jsonb_build_object('status',v_status,'live_session_id',a.live_session_id,'section_id',a.section_id));
  return query select x.status,x.total_score,x.max_score from public.buklod_quiz_attempts x where x.id=a.id;
end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_update_exam_v2(p_exam_id uuid, p_patch jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.buklod_quiz_exams%rowtype;
  v_title text;
  v_duration integer;
  v_attempts integer;
  v_pass numeric;
  v_language text;
begin
  if (select auth.uid()) is null then raise exception 'Sign in first.'; end if;

  select x.* into e
  from public.buklod_quiz_exams x
  where x.id=p_exam_id
    and x.owner_user_id=(select auth.uid());

  if e.id is null or not public.buklod_quiz_is_examiner((select auth.uid())) then
    raise exception 'Exam not found or unauthorized.';
  end if;

  v_title:=coalesce(nullif(trim(p_patch->>'title'),''),e.title);
  v_duration:=coalesce(nullif(p_patch->>'duration_minutes','')::int,e.duration_minutes);
  v_attempts:=coalesce(nullif(p_patch->>'max_attempts','')::int,e.max_attempts);
  v_pass:=coalesce(nullif(p_patch->>'pass_percent','')::numeric,e.pass_percent);
  v_language:=upper(coalesce(nullif(p_patch->>'exam_language',''),e.exam_language,'ENGLISH'));

  if v_duration<1 or v_duration>1440 then raise exception 'Duration must be 1 to 1440 minutes.'; end if;
  if v_attempts<1 or v_attempts>20 then raise exception 'Max attempts must be 1 to 20.'; end if;
  if v_pass<0 or v_pass>100 then raise exception 'Passing grade must be 0 to 100.'; end if;
  if v_language not in ('ENGLISH','TAGLISH','FILIPINO') then raise exception 'Exam language must be ENGLISH, TAGLISH, or FILIPINO.'; end if;

  update public.buklod_quiz_exams x
  set title=v_title,
      instructions=case when p_patch ? 'instructions' then nullif(p_patch->>'instructions','') else x.instructions end,
      duration_minutes=v_duration,
      max_attempts=v_attempts,
      pass_percent=v_pass,
      randomize_questions=coalesce((p_patch->>'randomize_questions')::boolean,x.randomize_questions),
      randomize_choices=coalesce((p_patch->>'randomize_choices')::boolean,x.randomize_choices),
      one_question_at_a_time=coalesce((p_patch->>'one_question_at_a_time')::boolean,x.one_question_at_a_time),
      no_backtracking=coalesce((p_patch->>'no_backtracking')::boolean,x.no_backtracking),
      require_fullscreen_web=coalesce((p_patch->>'require_fullscreen_web')::boolean,x.require_fullscreen_web),
      block_screen_capture=coalesce((p_patch->>'block_screen_capture')::boolean,x.block_screen_capture),
      integrity_mode=coalesce(nullif(upper(p_patch->>'integrity_mode'),''),x.integrity_mode),
      exam_language=v_language,
      integrity_auto_submit=false,
      updated_at=now()
  where x.id=p_exam_id;

  return true;
end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v4(p_attempt_id uuid, p_answers jsonb, p_client_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offline boolean DEFAULT false, p_offline_lease_token text DEFAULT NULL::text, p_device_token text DEFAULT NULL::text)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  declare
    a public.buklod_quiz_attempts%rowtype;
    v_uid uuid := (select auth.uid());
    v_len integer;
    v_expected integer;
    v_payload integer;
    v_status text;
    v_valid_lease boolean := false;
    v_basic_grace boolean := false;
    v_late_by numeric := 0;
  begin
    if v_uid is null then raise exception 'Sign in first.'; end if;
    if jsonb_typeof(coalesce(p_answers,'[]'::jsonb)) <> 'array' then raise exception 'Answers payload must be an array.'; end if;

    select x.* into a
    from public.buklod_quiz_attempts x
    where x.id=p_attempt_id and x.student_user_id=v_uid
    for update;

    if a.id is null then raise exception 'Attempt not found.'; end if;

    if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
      return query select a.status,a.total_score,a.max_score;
      return;
    end if;

    if a.status <> 'STARTED' then raise exception 'Attempt is not active.'; end if;

    if a.expires_at > now() then
      return query
      select x.status,x.total_score,x.max_score
      from public.buklod_quiz_submit_attempt_v2(p_attempt_id,p_answers) x;
      return;
    end if;

    if p_client_completed_at is null
       or p_client_completed_at < a.started_at - interval '1 minute'
       or p_client_completed_at > a.expires_at + interval '2 seconds'
    then
      raise exception 'Late submission proof is invalid. Attempt remains in recovery handling.';
    end if;

    if nullif(btrim(coalesce(p_offline_lease_token,'')),'') is not null then
      select exists(
        select 1
        from public.buklod_quiz_offline_leases l
        where l.attempt_id=a.id
          and l.student_user_id=v_uid
          and l.lease_token_hash=encode(extensions.digest(p_offline_lease_token,'sha256'),'hex')
          and l.used_at is null
          and l.sync_grace_expires_at >= now()
      ) into v_valid_lease;
    end if;

    v_basic_grace := now() <= a.expires_at + interval '2 minutes';

    if not v_valid_lease and not v_basic_grace then
      raise exception 'Offline recovery window expired. Attempt remains under server expiry handling.';
    end if;

    v_len := jsonb_array_length(coalesce(p_answers,'[]'::jsonb));
    if v_len > 500 then raise exception 'Too many answers in submit payload.'; end if;

    if exists(
      select 1
      from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
      where nullif(j->>'question_id','') is null
         or not exists(
           select 1
           from public.buklod_quiz_questions q
           where q.id=(j->>'question_id')::uuid
             and q.exam_id=a.exam_id
             and q.is_active=true
         )
    ) then
      raise exception 'One or more question IDs are invalid for this exam.';
    end if;

    select count(*)::integer into v_expected
    from public.buklod_quiz_questions q
    where q.exam_id=a.exam_id and q.is_active=true;

    select count(distinct (j->>'question_id'))::integer into v_payload
    from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j;

    if v_payload <> v_expected then
      raise exception 'Submission snapshot incomplete: received % of % question IDs. Recovery remains active.',v_payload,v_expected;
    end if;

    if a.live_session_id is not null
       and exists(select 1 from public.buklod_quiz_live_sessions ls where ls.id=a.live_session_id and ls.status='PAUSED')
    then
      raise exception 'Live class is paused. Wait for faculty to resume before submitting.';
    end if;

    with payload as (
      select distinct on ((j->>'question_id')::uuid)
             (j->>'question_id')::uuid as question_id,
             j->'answer' as answer
      from jsonb_array_elements(p_answers) j
      order by (j->>'question_id')::uuid
    )
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
    select a.id,p.question_id,v_uid,p.answer,now(),now()
    from payload p
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key
    do update set
      answer=excluded.answer,
      student_user_id=excluded.student_user_id,
      saved_at=now(),
      updated_at=now();

    v_status := public.buklod_quiz_compute_attempt_internal(a.id);

    if v_valid_lease then
      update public.buklod_quiz_offline_leases l
      set used_at=now()
      where l.attempt_id=a.id and l.student_user_id=v_uid;
    end if;

    v_late_by := greatest(0,extract(epoch from (now()-a.expires_at)));

    insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
    values(
      a.id,v_uid,'ATOMIC_SUBMIT_V4_RECOVERY',
      jsonb_build_object(
        'offline',coalesce(p_offline,false),
        'lease_valid',v_valid_lease,
        'basic_grace_used',not v_valid_lease,
        'client_completed_at',p_client_completed_at,
        'server_received_at',now(),
        'late_by_seconds',v_late_by,
        'answer_payload_count',v_len,
        'result_status',v_status
      )
    );

    select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id;
    return query select a.status,a.total_score,a.max_score;
  end;
  $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_transmuted_percent_v1(p_score numeric, p_max numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_score is null or coalesce(p_max,0)<=0 then null::numeric
    else round((p_score/p_max)*50+50,2)
  end
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_unpublish_exam_v1(p_exam_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ begin update public.buklod_quiz_exams set status='DRAFT',updated_at=now() where id=p_exam_id and owner_user_id=auth.uid(); if not found then raise exception 'Exam not found or unauthorized.'; end if; return true; end $function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v2(p_attempt_id uuid, p_answers jsonb)
 RETURNS TABLE(attempt_id uuid, status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  a public.buklod_quiz_attempts%rowtype;
  v_len integer;
  v_status text;
  v_expected_count integer:=0;
  v_payload_count integer:=0;
  v_missing_inserted integer:=0;
begin
  if jsonb_typeof(coalesce(p_answers,'[]'::jsonb)) <> 'array' then
    raise exception 'Answers payload must be an array.';
  end if;

  v_len := jsonb_array_length(coalesce(p_answers,'[]'::jsonb));
  if v_len > 500 then raise exception 'Too many answers in submit payload.'; end if;

  select x.* into a
  from public.buklod_quiz_attempts x
  where x.id = p_attempt_id
    and x.student_user_id = (select auth.uid())
  for update;

  if a.id is null then raise exception 'Attempt not found.'; end if;

  if a.status in ('NEEDS_REVIEW','GRADED','RELEASED') then
    return query select a.id,a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.status <> 'STARTED' then raise exception 'Attempt is not active.'; end if;

  if exists(
    select 1
    from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j
    where nullif(j->>'question_id','') is null
       or not exists(
         select 1 from public.buklod_quiz_questions q
         where q.id=(j->>'question_id')::uuid
           and q.exam_id=a.exam_id
           and q.is_active=true
       )
  ) then
    raise exception 'One or more question IDs are invalid for this exam.';
  end if;

  select count(*)::integer
    into v_expected_count
  from public.buklod_quiz_questions q
  where q.exam_id=a.exam_id
    and q.is_active=true;

  select count(distinct (j->>'question_id'))::integer
    into v_payload_count
  from jsonb_array_elements(coalesce(p_answers,'[]'::jsonb)) j;

  if v_payload_count <> v_expected_count then
    raise exception 'Submission snapshot incomplete: received % of % question IDs. Exam remains active; retry from the same device so no answers are lost.',
      v_payload_count, v_expected_count;
  end if;

  if a.expires_at <= now() then
    insert into public.buklod_quiz_responses(
      attempt_id,question_id,student_user_id,answer,saved_at,updated_at
    )
    select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
    from public.buklod_quiz_questions q
    where q.exam_id=a.exam_id
      and q.is_active=true
      and not exists(
        select 1 from public.buklod_quiz_responses r
        where r.attempt_id=a.id and r.question_id=q.id
      )
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
    get diagnostics v_missing_inserted=row_count;

    v_status := public.buklod_quiz_compute_attempt_internal(a.id);
    select x.* into a from public.buklod_quiz_attempts x where x.id = p_attempt_id;

    insert into public.buklod_quiz_events(attempt_id, student_user_id, event_type, event_data)
    select a.id, a.student_user_id, 'AUTO_SUBMIT_TIME_EXPIRED',
           jsonb_build_object(
             'expires_at', a.expires_at,
             'processed_at', now(),
             'result_status', v_status,
             'source', 'LATE_SUBMIT_GUARD',
             'rejected_late_payload_count', v_len,
             'unanswered_inserted_count',v_missing_inserted,
             'incomplete_submission_allowed',true
           )
    where not exists (
      select 1 from public.buklod_quiz_events e
      where e.attempt_id = a.id
        and e.event_type = 'AUTO_SUBMIT_TIME_EXPIRED'
    );

    return query select a.id,a.status,a.total_score,a.max_score;
    return;
  end if;

  if a.live_session_id is not null
     and exists(
       select 1 from public.buklod_quiz_live_sessions ls
       where ls.id=a.live_session_id and ls.status='PAUSED'
     ) then
    raise exception 'Live class is paused. Wait for faculty to resume before submitting.';
  end if;

  if v_len > 0 then
    with payload as (
      select distinct on ((j->>'question_id')::uuid)
             (j->>'question_id')::uuid question_id,
             j->'answer' answer
      from jsonb_array_elements(p_answers) j
      order by (j->>'question_id')::uuid
    )
    insert into public.buklod_quiz_responses(attempt_id,question_id,student_user_id,answer,saved_at,updated_at)
    select a.id,p.question_id,(select auth.uid()),p.answer,now(),now()
    from payload p
    on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key
    do update set
      answer=excluded.answer,
      student_user_id=excluded.student_user_id,
      saved_at=now(),
      updated_at=now();
  end if;

  insert into public.buklod_quiz_responses(
    attempt_id,question_id,student_user_id,answer,saved_at,updated_at
  )
  select a.id,q.id,a.student_user_id,null::jsonb,now(),now()
  from public.buklod_quiz_questions q
  where q.exam_id=a.exam_id
    and q.is_active=true
    and not exists(
      select 1 from public.buklod_quiz_responses r
      where r.attempt_id=a.id and r.question_id=q.id
    )
  on conflict on constraint buklod_quiz_responses_attempt_id_question_id_key do nothing;
  get diagnostics v_missing_inserted=row_count;

  v_status := public.buklod_quiz_compute_attempt_internal(a.id);
  select x.* into a from public.buklod_quiz_attempts x where x.id=p_attempt_id;

  insert into public.buklod_quiz_events(attempt_id,student_user_id,event_type,event_data)
  values(a.id,(select auth.uid()),'ATOMIC_SUBMIT_V2',jsonb_build_object(
    'answer_payload_count',v_len,
    'distinct_payload_count',v_payload_count,
    'expected_question_count',v_expected_count,
    'unanswered_inserted_count',v_missing_inserted,
    'incomplete_submission_allowed',true,
    'status',v_status
  ));

  return query select a.id,a.status,a.total_score,a.max_score;
end;
$function$;
CREATE OR REPLACE FUNCTION public.buklod_quiz_submit_attempt_v3(p_attempt_id uuid, p_answers jsonb, p_client_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_offline boolean DEFAULT false)
 RETURNS TABLE(status text, total_score numeric, max_score numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if coalesce(p_offline,false) then
    raise exception 'Secure offline submit requires a signed offline lease from the current BUKLOD Quiz client.';
  end if;
  return query select * from public.buklod_quiz_submit_attempt_v4(p_attempt_id,p_answers,p_client_completed_at,false,null,null);
end
$function$;
ALTER TABLE public."buklod_quiz_attempt_allowances" ADD CONSTRAINT "buklod_quiz_attempt_allowances_pkey" PRIMARY KEY (live_session_id, student_user_id);
ALTER TABLE public."buklod_quiz_attempt_questions" ADD CONSTRAINT "buklod_quiz_attempt_questions_attempt_id_display_order_key" UNIQUE (attempt_id, display_order);
ALTER TABLE public."buklod_quiz_attempt_questions" ADD CONSTRAINT "buklod_quiz_attempt_questions_pkey" PRIMARY KEY (attempt_id, question_id);
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_exam_id_student_user_id_attempt_no_key" UNIQUE (exam_id, student_user_id, attempt_no);
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_audit_log" ADD CONSTRAINT "buklod_quiz_audit_log_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_documents" ADD CONSTRAINT "buklod_quiz_documents_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_documents" ADD CONSTRAINT "buklod_quiz_documents_storage_path_key" UNIQUE (storage_path);
ALTER TABLE public."buklod_quiz_events" ADD CONSTRAINT "buklod_quiz_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_examiner_roles" ADD CONSTRAINT "buklod_quiz_examiner_roles_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."buklod_quiz_exams" ADD CONSTRAINT "buklod_quiz_exams_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_faculty_actions" ADD CONSTRAINT "buklod_quiz_faculty_actions_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_faculty_entitlements" ADD CONSTRAINT "buklod_quiz_faculty_entitlements_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."buklod_quiz_integrity_deduction_rules" ADD CONSTRAINT "buklod_quiz_integrity_deduction_rules_pkey" PRIMARY KEY (owner_user_id, event_type);
ALTER TABLE public."buklod_quiz_integrity_deductions" ADD CONSTRAINT "buklod_quiz_integrity_deductions_attempt_id_event_type_key" UNIQUE (attempt_id, event_type);
ALTER TABLE public."buklod_quiz_integrity_deductions" ADD CONSTRAINT "buklod_quiz_integrity_deductions_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_live_members" ADD CONSTRAINT "buklod_quiz_live_members_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_live_members" ADD CONSTRAINT "buklod_quiz_live_members_session_id_student_user_id_key" UNIQUE (session_id, student_user_id);
ALTER TABLE public."buklod_quiz_live_question_snapshots" ADD CONSTRAINT "buklod_quiz_live_question_snapshots_pkey" PRIMARY KEY (session_id, question_id);
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_id_exam_section_key" UNIQUE (id, exam_id, section_id);
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_join_code_key" UNIQUE (join_code);
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_main_entry_gate" ADD CONSTRAINT "buklod_quiz_main_entry_gate_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."buklod_quiz_offline_leases" ADD CONSTRAINT "buklod_quiz_offline_leases_pkey" PRIMARY KEY (attempt_id);
ALTER TABLE public."buklod_quiz_questions" ADD CONSTRAINT "buklod_quiz_questions_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_r13_quarantine" ADD CONSTRAINT "buklod_quiz_r13_quarantine_pkey" PRIMARY KEY (source_table, source_pk);
ALTER TABLE public."buklod_quiz_release_preferences" ADD CONSTRAINT "buklod_quiz_release_preferences_pkey" PRIMARY KEY (attempt_id);
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_attempt_id_question_id_key" UNIQUE (attempt_id, question_id);
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_review_jobs" ADD CONSTRAINT "buklod_quiz_review_jobs_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_review_suggestions" ADD CONSTRAINT "buklod_quiz_review_suggestions_pkey" PRIMARY KEY (response_id);
ALTER TABLE public."buklod_quiz_roster" ADD CONSTRAINT "buklod_quiz_roster_exam_id_student_user_id_key" UNIQUE (exam_id, student_user_id);
ALTER TABLE public."buklod_quiz_roster" ADD CONSTRAINT "buklod_quiz_roster_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_section_join_overrides" ADD CONSTRAINT "buklod_quiz_section_join_overrides_pkey" PRIMARY KEY (session_id, student_user_id);
ALTER TABLE public."buklod_quiz_sections" ADD CONSTRAINT "buklod_quiz_sections_exam_id_id_key" UNIQUE (exam_id, id);
ALTER TABLE public."buklod_quiz_sections" ADD CONSTRAINT "buklod_quiz_sections_pkey" PRIMARY KEY (id);
ALTER TABLE public."buklod_quiz_attempt_allowances" ADD CONSTRAINT "buklod_quiz_attempt_allowances_live_session_id_fkey" FOREIGN KEY (live_session_id) REFERENCES buklod_quiz_live_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_attempt_questions" ADD CONSTRAINT "buklod_quiz_attempt_questions_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_attempt_questions" ADD CONSTRAINT "buklod_quiz_attempt_questions_question_id_fkey" FOREIGN KEY (question_id) REFERENCES buklod_quiz_questions(id) ON DELETE RESTRICT;
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_live_session_scope_fkey" FOREIGN KEY (live_session_id, exam_id, section_id) REFERENCES buklod_quiz_live_sessions(id, exam_id, section_id) ON DELETE SET NULL (live_session_id);
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_section_id_fkey" FOREIGN KEY (section_id) REFERENCES buklod_quiz_sections(id) ON DELETE RESTRICT;
ALTER TABLE public."buklod_quiz_attempts" ADD CONSTRAINT "buklod_quiz_attempts_student_user_id_fkey" FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_documents" ADD CONSTRAINT "buklod_quiz_documents_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_documents" ADD CONSTRAINT "buklod_quiz_documents_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_events" ADD CONSTRAINT "buklod_quiz_events_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_events" ADD CONSTRAINT "buklod_quiz_events_student_user_id_fkey" FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_examiner_roles" ADD CONSTRAINT "buklod_quiz_examiner_roles_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_examiner_roles" ADD CONSTRAINT "buklod_quiz_examiner_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_exams" ADD CONSTRAINT "buklod_quiz_exams_owner_user_id_fkey" FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_integrity_deductions" ADD CONSTRAINT "buklod_quiz_integrity_deductions_applied_by_fkey" FOREIGN KEY (applied_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_integrity_deductions" ADD CONSTRAINT "buklod_quiz_integrity_deductions_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_live_members" ADD CONSTRAINT "buklod_quiz_live_members_session_id_fkey" FOREIGN KEY (session_id) REFERENCES buklod_quiz_live_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_live_question_snapshots" ADD CONSTRAINT "buklod_quiz_live_question_snapshots_session_id_fkey" FOREIGN KEY (session_id) REFERENCES buklod_quiz_live_sessions(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_exam_section_fkey" FOREIGN KEY (exam_id, section_id) REFERENCES buklod_quiz_sections(exam_id, id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_live_sessions" ADD CONSTRAINT "buklod_quiz_live_sessions_section_id_fkey" FOREIGN KEY (section_id) REFERENCES buklod_quiz_sections(id) ON DELETE RESTRICT;
ALTER TABLE public."buklod_quiz_offline_leases" ADD CONSTRAINT "buklod_quiz_offline_leases_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_questions" ADD CONSTRAINT "buklod_quiz_questions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_questions" ADD CONSTRAINT "buklod_quiz_questions_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_questions" ADD CONSTRAINT "buklod_quiz_questions_source_document_id_fkey" FOREIGN KEY (source_document_id) REFERENCES buklod_quiz_documents(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_release_preferences" ADD CONSTRAINT "buklod_quiz_release_preferences_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id);
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_question_id_fkey" FOREIGN KEY (question_id) REFERENCES buklod_quiz_questions(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public."buklod_quiz_responses" ADD CONSTRAINT "buklod_quiz_responses_student_user_id_fkey" FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_review_jobs" ADD CONSTRAINT "buklod_quiz_review_jobs_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id);
ALTER TABLE public."buklod_quiz_review_jobs" ADD CONSTRAINT "buklod_quiz_review_jobs_section_id_fkey" FOREIGN KEY (section_id) REFERENCES buklod_quiz_sections(id);
ALTER TABLE public."buklod_quiz_review_suggestions" ADD CONSTRAINT "buklod_quiz_review_suggestions_attempt_id_fkey" FOREIGN KEY (attempt_id) REFERENCES buklod_quiz_attempts(id);
ALTER TABLE public."buklod_quiz_review_suggestions" ADD CONSTRAINT "buklod_quiz_review_suggestions_job_id_fkey" FOREIGN KEY (job_id) REFERENCES buklod_quiz_review_jobs(id);
ALTER TABLE public."buklod_quiz_review_suggestions" ADD CONSTRAINT "buklod_quiz_review_suggestions_response_id_fkey" FOREIGN KEY (response_id) REFERENCES buklod_quiz_responses(id);
ALTER TABLE public."buklod_quiz_roster" ADD CONSTRAINT "buklod_quiz_roster_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_roster" ADD CONSTRAINT "buklod_quiz_roster_section_id_fkey" FOREIGN KEY (section_id) REFERENCES buklod_quiz_sections(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_roster" ADD CONSTRAINT "buklod_quiz_roster_student_user_id_fkey" FOREIGN KEY (student_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."buklod_quiz_section_join_overrides" ADD CONSTRAINT "buklod_quiz_section_join_overrides_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES auth.users(id);
ALTER TABLE public."buklod_quiz_section_join_overrides" ADD CONSTRAINT "buklod_quiz_section_join_overrides_session_id_fkey" FOREIGN KEY (session_id) REFERENCES buklod_quiz_live_sessions(id);
ALTER TABLE public."buklod_quiz_section_join_overrides" ADD CONSTRAINT "buklod_quiz_section_join_overrides_student_user_id_fkey" FOREIGN KEY (student_user_id) REFERENCES auth.users(id);
ALTER TABLE public."buklod_quiz_sections" ADD CONSTRAINT "buklod_quiz_sections_exam_id_fkey" FOREIGN KEY (exam_id) REFERENCES buklod_quiz_exams(id) ON DELETE CASCADE;
SET check_function_bodies=on;
SET search_path=public;
