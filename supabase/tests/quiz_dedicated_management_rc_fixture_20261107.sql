-- ISOLATED CI ONLY. Synthetic identifiers and no production/user data.
-- PostgreSQL service mimics only the Dedicated schema contracts required by
-- the five pending management RPCs. Not a substitute for full Supabase RC.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
 AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;

CREATE TABLE public.quiz_faculty_users(user_id uuid PRIMARY KEY);
CREATE FUNCTION public.buklod_quiz_is_examiner(p_user_id uuid) RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.quiz_faculty_users f WHERE f.user_id=p_user_id)
 $$;

CREATE TABLE public.buklod_quiz_exams(
 id uuid PRIMARY KEY,
 owner_user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT',
 archived_at timestamptz,
 archived_by uuid,
 total_points numeric NOT NULL DEFAULT 0,
 published_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.buklod_quiz_questions(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE,
 points numeric NOT NULL DEFAULT 0,
 is_active boolean NOT NULL DEFAULT true
);
CREATE TABLE public.buklod_quiz_attempts(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE
);
CREATE TABLE public.buklod_quiz_live_sessions(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE,
 status text NOT NULL,
 ended_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.buklod_quiz_sections(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE
);
CREATE TABLE public.buklod_quiz_roster(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE
);
CREATE TABLE public.buklod_quiz_documents(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE
);
CREATE TABLE public.buklod_quiz_review_jobs(
 id uuid PRIMARY KEY,
 exam_id uuid NOT NULL REFERENCES public.buklod_quiz_exams(id) ON DELETE CASCADE
);
CREATE TABLE public.buklod_quiz_audit_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 exam_id uuid,
 actor_user_id uuid,
 action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE FUNCTION public.buklod_quiz_audit_write_v1(
 p_exam_id uuid, p_section_id uuid, p_live_session_id uuid, p_attempt_id uuid,
 p_action text, p_details jsonb DEFAULT '{}'::jsonb, p_actor uuid DEFAULT NULL::uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $audit$
 BEGIN
  INSERT INTO public.buklod_quiz_audit_log(exam_id,actor_user_id,action,details)
  VALUES(p_exam_id,coalesce(p_actor,auth.uid()),p_action,coalesce(p_details,'{}'::jsonb));
 END $audit$;

-- Synthetic faculty, outsider, two exam drafts, plus a scored question.
INSERT INTO public.quiz_faculty_users VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.buklod_quiz_exams(id,owner_user_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111');
