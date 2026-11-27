-- MAIN Quiz ACL/RLS catalog capture only, no production rows. Apply to disposable fixture BEFORE R1–R23.
-- Auth gateway, profiles policies and unrelated services are not represented.
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
ALTER ROLE service_role BYPASSRLS;
ALTER TABLE public."buklod_quiz_attempt_allowances" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_attempt_allowances" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_attempt_allowances" TO service_role;
ALTER TABLE public."buklod_quiz_attempt_questions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_attempt_questions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_attempt_questions" TO service_role;
ALTER TABLE public."buklod_quiz_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_attempts" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_attempts" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_attempts" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_attempts" TO service_role;
ALTER TABLE public."buklod_quiz_audit_log" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_audit_log" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_audit_log" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_audit_log" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_audit_log" TO service_role;
ALTER TABLE public."buklod_quiz_documents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_documents" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_documents" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_documents" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_documents" TO service_role;
ALTER TABLE public."buklod_quiz_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_events" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_events" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_events" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_events" TO service_role;
ALTER TABLE public."buklod_quiz_examiner_roles" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_examiner_roles" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_examiner_roles" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_examiner_roles" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_examiner_roles" TO service_role;
ALTER TABLE public."buklod_quiz_exams" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_exams" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_exams" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_exams" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_exams" TO service_role;
ALTER TABLE public."buklod_quiz_faculty_actions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_faculty_actions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_faculty_actions" TO service_role;
ALTER TABLE public."buklod_quiz_faculty_entitlements" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_faculty_entitlements" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_faculty_entitlements" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_faculty_entitlements" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_faculty_entitlements" TO service_role;
ALTER TABLE public."buklod_quiz_integrity_deduction_rules" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_integrity_deduction_rules" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_integrity_deduction_rules" TO service_role;
ALTER TABLE public."buklod_quiz_integrity_deductions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_integrity_deductions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_integrity_deductions" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_integrity_deductions" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_integrity_deductions" TO service_role;
ALTER TABLE public."buklod_quiz_live_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_live_members" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_members" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_members" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_live_members" TO service_role;
ALTER TABLE public."buklod_quiz_live_question_snapshots" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_live_question_snapshots" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_question_snapshots" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_question_snapshots" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_live_question_snapshots" TO service_role;
ALTER TABLE public."buklod_quiz_live_sessions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_live_sessions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_sessions" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_live_sessions" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_live_sessions" TO service_role;
ALTER TABLE public."buklod_quiz_main_entry_gate" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_main_entry_gate" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_main_entry_gate" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_main_entry_gate" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_main_entry_gate" TO service_role;
ALTER TABLE public."buklod_quiz_offline_leases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_offline_leases" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_offline_leases" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_offline_leases" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_offline_leases" TO service_role;
ALTER TABLE public."buklod_quiz_questions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_questions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_questions" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_questions" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_questions" TO service_role;
ALTER TABLE public."buklod_quiz_r13_quarantine" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_r13_quarantine" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_r13_quarantine" TO service_role;
ALTER TABLE public."buklod_quiz_release_preferences" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_release_preferences" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_release_preferences" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_release_preferences" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_release_preferences" TO service_role;
ALTER TABLE public."buklod_quiz_responses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_responses" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_responses" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_responses" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_responses" TO service_role;
ALTER TABLE public."buklod_quiz_review_jobs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_review_jobs" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_review_jobs" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_review_jobs" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_review_jobs" TO service_role;
ALTER TABLE public."buklod_quiz_review_suggestions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_review_suggestions" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_review_suggestions" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_review_suggestions" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_review_suggestions" TO service_role;
ALTER TABLE public."buklod_quiz_roster" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_roster" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_roster" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_roster" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_roster" TO service_role;
ALTER TABLE public."buklod_quiz_section_join_overrides" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_section_join_overrides" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_section_join_overrides" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_section_join_overrides" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_section_join_overrides" TO service_role;
ALTER TABLE public."buklod_quiz_sections" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."buklod_quiz_sections" FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_sections" TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public."buklod_quiz_sections" TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public."buklod_quiz_sections" TO service_role;
CREATE POLICY "buklod_quiz_attempt_owner_select" ON public."buklod_quiz_attempts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((student_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_attempts.exam_id) AND (e.owner_user_id = auth.uid()))))));
CREATE POLICY "buklod_quiz_audit_faculty_select" ON public."buklod_quiz_audit_log" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_audit_log.exam_id) AND (e.owner_user_id = auth.uid()) AND buklod_quiz_is_examiner(auth.uid())))));
CREATE POLICY "buklod_quiz_docs_owner_all" ON public."buklod_quiz_documents" AS PERMISSIVE FOR ALL TO "authenticated" USING ((owner_user_id = auth.uid())) WITH CHECK (((owner_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_documents.exam_id) AND (e.owner_user_id = auth.uid()))))));
CREATE POLICY "buklod_quiz_events_owner_select" ON public."buklod_quiz_events" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (buklod_quiz_attempts a
     JOIN buklod_quiz_exams e ON ((e.id = a.exam_id)))
  WHERE ((a.id = buklod_quiz_events.attempt_id) AND (e.owner_user_id = auth.uid())))));
CREATE POLICY "buklod_quiz_examiner_admin_all" ON public."buklod_quiz_examiner_roles" AS PERMISSIVE FOR ALL TO "authenticated" USING (buklod_quiz_is_system_admin()) WITH CHECK (buklod_quiz_is_system_admin());
CREATE POLICY "buklod_quiz_examiner_self_read" ON public."buklod_quiz_examiner_roles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((user_id = auth.uid()) OR buklod_quiz_is_system_admin()));
CREATE POLICY "buklod_quiz_exam_assigned_select" ON public."buklod_quiz_exams" AS PERMISSIVE FOR SELECT TO "authenticated" USING (buklod_quiz_current_user_assigned_to_exam(id));
CREATE POLICY "buklod_quiz_exam_owner_all" ON public."buklod_quiz_exams" AS PERMISSIVE FOR ALL TO "authenticated" USING ((owner_user_id = auth.uid())) WITH CHECK (((owner_user_id = auth.uid()) AND buklod_quiz_is_examiner(auth.uid())));
CREATE POLICY "buklod_internal_deny_clients_integrity_rules_r1" ON public."buklod_quiz_integrity_deduction_rules" AS PERMISSIVE FOR ALL TO "anon","authenticated" USING (false) WITH CHECK (false);
CREATE POLICY "buklod_quiz_live_members_faculty_all" ON public."buklod_quiz_live_members" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM buklod_quiz_live_sessions s
  WHERE ((s.id = buklod_quiz_live_members.session_id) AND (s.faculty_user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM buklod_quiz_live_sessions s
  WHERE ((s.id = buklod_quiz_live_members.session_id) AND (s.faculty_user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "buklod_quiz_live_members_self_select" ON public."buklod_quiz_live_members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((student_user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_live_snapshot_faculty_select" ON public."buklod_quiz_live_question_snapshots" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (buklod_quiz_live_sessions s
     JOIN buklod_quiz_exams e ON ((e.id = s.exam_id)))
  WHERE ((s.id = buklod_quiz_live_question_snapshots.session_id) AND (e.owner_user_id = auth.uid())))));
CREATE POLICY "buklod_quiz_live_sessions_faculty_all" ON public."buklod_quiz_live_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((faculty_user_id = ( SELECT auth.uid() AS uid))) WITH CHECK (((faculty_user_id = ( SELECT auth.uid() AS uid)) AND buklod_quiz_is_examiner(( SELECT auth.uid() AS uid))));
CREATE POLICY "buklod_quiz_live_sessions_select" ON public."buklod_quiz_live_sessions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((faculty_user_id = ( SELECT auth.uid() AS uid)) OR buklod_quiz_current_user_in_live_session(id)));
CREATE POLICY "buklod_quiz_questions_owner_all" ON public."buklod_quiz_questions" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_questions.exam_id) AND (e.owner_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_questions.exam_id) AND (e.owner_user_id = auth.uid())))));
CREATE POLICY "buklod_quiz_response_select" ON public."buklod_quiz_responses" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((student_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (buklod_quiz_attempts a
     JOIN buklod_quiz_exams e ON ((e.id = a.exam_id)))
  WHERE ((a.id = buklod_quiz_responses.attempt_id) AND (e.owner_user_id = auth.uid()))))));
CREATE POLICY "buklod_quiz_review_jobs_owner_insert" ON public."buklod_quiz_review_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_review_jobs.exam_id) AND (e.owner_user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "buklod_quiz_review_jobs_owner_select" ON public."buklod_quiz_review_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_review_jobs_owner_update" ON public."buklod_quiz_review_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((created_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_review_suggestions_owner_insert" ON public."buklod_quiz_review_suggestions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_review_suggestions_owner_select" ON public."buklod_quiz_review_suggestions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_review_suggestions_owner_update" ON public."buklod_quiz_review_suggestions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((created_by = ( SELECT auth.uid() AS uid))) WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "buklod_quiz_roster_owner_all" ON public."buklod_quiz_roster" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_roster.exam_id) AND (e.owner_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_roster.exam_id) AND (e.owner_user_id = auth.uid())))));
CREATE POLICY "buklod_quiz_roster_self_select" ON public."buklod_quiz_roster" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((student_user_id = auth.uid()));
CREATE POLICY "buklod_quiz_sections_owner_all" ON public."buklod_quiz_sections" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_sections.exam_id) AND (e.owner_user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM buklod_quiz_exams e
  WHERE ((e.id = buklod_quiz_sections.exam_id) AND (e.owner_user_id = auth.uid())))));
DO $acl$
BEGIN
 IF to_regprocedure('private.buklod_quiz_assign_attempt_questions_r1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_assign_attempt_questions_r1() FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('private.buklod_quiz_attempt_question_allowed_r1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_attempt_question_allowed_r1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('private.buklod_quiz_attempt_question_count_r1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_attempt_question_count_r1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('private.buklod_quiz_canonical_integrity_count_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_canonical_integrity_count_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('private.buklod_quiz_canonical_integrity_events_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_canonical_integrity_events_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('private.buklod_quiz_normalized_scalar(jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION private.buklod_quiz_normalized_scalar(jsonb) FROM PUBLIC,anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_add_roster_member_v1(uuid, uuid, uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_add_roster_member_v1(uuid, uuid, uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_add_roster_member_v1(uuid, uuid, uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_answer_change_signal_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_answer_change_signal_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_answer_change_signal_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_apply_security_preset_v1(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_apply_security_preset_v1(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_apply_security_preset_v1(uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_approve_attempt_review_v1(uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v1(uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_approve_attempt_review_v2(uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid, jsonb) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_approve_class_review_v1(uuid, uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid, uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_class_review_v1(uuid, uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_archive_exam_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_archive_exam_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_bootstrap_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_bootstrap_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_bootstrap_v1(uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_faculty_analysis_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_faculty_analysis_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_final_score_guard_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_final_score_guard_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_final_score_guard_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_full_review_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_full_review_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_full_review_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_full_review_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_full_review_v2(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_heartbeat_v1(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_heartbeat_v1(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_heartbeat_v1(uuid, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_integrity_analysis_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_integrity_analysis_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_integrity_analysis_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_integrity_policy_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_integrity_policy_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_integrity_policy_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_trace_fill_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_trace_fill_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_trace_fill_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_attempt_trace_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_attempt_trace_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_attempt_trace_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_attempt_change_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_attempt_change_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_attempt_change_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_deduction_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_deduction_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_deduction_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_exam_change_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_exam_change_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_exam_change_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_integrity_rule_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_integrity_rule_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_integrity_rule_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_live_change_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_live_change_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_live_change_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_manual_review_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_manual_review_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_manual_review_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_question_change_trg_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_question_change_trg_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_question_change_trg_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_audit_write_v1(uuid, uuid, uuid, uuid, text, jsonb, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_audit_write_v1(uuid, uuid, uuid, uuid, text, jsonb, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_audit_write_v1(uuid, uuid, uuid, uuid, text, jsonb, uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_auto_set_integrity_deductions_v1(uuid, uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v1(uuid, uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v1(uuid, uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_auto_set_integrity_deductions_v2(uuid, uuid, uuid, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v2(uuid, uuid, uuid, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v2(uuid, uuid, uuid, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_auto_set_integrity_deductions_v3(uuid, uuid, uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v3(uuid, uuid, uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_auto_set_integrity_deductions_v3(uuid, uuid, uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_bind_attempt_device_v1(uuid, text, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_bind_attempt_device_v1(uuid, text, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_bind_attempt_device_v1(uuid, text, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_integrity_analysis_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_integrity_analysis_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_integrity_analysis_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_record_violations_v2(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_record_violations_v2(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_record_violations_v2(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_records_v1(uuid, uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_records_v1(uuid, uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_records_v1(uuid, uuid, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_review_queue_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_review_queue_v2(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid, uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_security_signals_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_security_signals_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_security_signals_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_class_violations_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_class_violations_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_violations_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_clone_live_session_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_clone_live_session_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_clone_live_session_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_compute_attempt_internal(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_compute_attempt_internal(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_compute_attempt_internal(uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_create_live_class_v1(uuid, text, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_create_live_class_v1(uuid, text, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_create_live_class_v1(uuid, text, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_create_live_class_v2(uuid, uuid, text, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_create_live_class_v2(uuid, uuid, text, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_create_live_class_v2(uuid, uuid, text, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_create_live_class_v4(uuid, uuid, text, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_create_live_class_v4(uuid, uuid, text, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_create_live_class_v4(uuid, uuid, text, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_current_user_assigned_to_exam(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_current_user_assigned_to_exam(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_current_user_assigned_to_exam(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_current_user_in_live_session(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_current_user_in_live_session(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_current_user_in_live_session(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_delete_exam_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_delete_exam_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_delete_question_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_delete_question_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_delete_question_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_delete_section_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_delete_section_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_delete_section_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_duplicate_exam_v1(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_duplicate_exam_v1(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_duplicate_exam_v1(uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_ensure_main_shadow_user_v1(uuid, text, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(uuid, text, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_ensure_main_shadow_user_v1(uuid, text, jsonb) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_entry_claim_r13(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_entry_claim_r13(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_entry_claim_r13(uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_audit_v1(uuid, uuid, integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_audit_v1(uuid, uuid, integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_audit_v1(uuid, uuid, integer) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_management_list_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_management_list_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_management_list_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_preview_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_preview_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_preview_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_records_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_records_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_records_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_sections_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_sections_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_sections_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_sections_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_sections_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_sections_v2(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_exam_security_settings_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_exam_security_settings_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_exam_security_settings_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_examiner_access_status_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_examiner_access_status_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_examiner_access_status_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_faculty_audit_v1(integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_audit_v1(integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_audit_v1(integer) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_focus_admin_eligible_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_faculty_live_room_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_live_room_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_faculty_live_room_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_live_room_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_live_room_v2(uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_faculty_released_results_v1(integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_faculty_released_results_v1(integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_faculty_released_results_v1(integer) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_finalize_attempt_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_finalize_attempt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_finalize_attempt_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_guard_live_question_delete_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_guard_live_question_delete_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_guard_live_question_delete_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_deduction_rules_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_deduction_rules_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_deduction_rules_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_event_v1(uuid, text, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_event_v1(uuid, text, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_event_v1(uuid, text, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_event_v1(uuid, text, jsonb, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_event_v1(uuid, text, jsonb, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_event_v1(uuid, text, jsonb, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_incident_count_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_incident_count_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_incident_count_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_incident_rows_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_incident_rows_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_incident_rows_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_metrics_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_metrics_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_metrics_v1(uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_rule_usage_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_rule_usage_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_rule_usage_v1(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_integrity_v2_stamp_future_session()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_integrity_v2_stamp_future_session() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_integrity_v2_stamp_future_session() TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_is_examiner(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_is_examiner(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_is_examiner(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_is_system_admin()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_is_system_admin() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_is_system_admin() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_issue_offline_lease_v1(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v1(uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_issue_offline_lease_v2(uuid, text, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid, text, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_issue_offline_lease_v2(uuid, text, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_join_live_class_v1(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v1(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v1(text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_join_live_class_v2(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v2(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v2(text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_join_live_class_v3(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v3(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v3(text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_join_live_class_v4(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_join_live_class_v4(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_join_live_class_v4(text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_bulk_action_v1(uuid, text, uuid[])') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid, text, uuid[]) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v1(uuid, text, uuid[]) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_bulk_action_v2(uuid, text, uuid[])') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid, text, uuid[]) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_bulk_action_v2(uuid, text, uuid[]) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_clock_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_clock_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_clock_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_control_v1(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_control_v1(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_control_v1(uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_control_v2(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_control_v2(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_control_v2(uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_control_v3(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_control_v3(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_control_v3(uuid, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_join_preflight_v1(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_join_preflight_v1(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_join_preflight_v1(text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_settings_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_settings_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_settings_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_start_attempt_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_start_attempt_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v2(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_start_attempt_v3(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v3(uuid, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_start_attempt_v3_core(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_start_attempt_v3_core(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_start_attempt_v3_core(uuid, text) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_student_action_v1(uuid, uuid, text, integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_student_action_v1(uuid, uuid, text, integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_student_action_v1(uuid, uuid, text, integer) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_student_action_v2(uuid, uuid, text, integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_student_action_v2(uuid, uuid, text, integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_student_action_v2(uuid, uuid, text, integer) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_live_touch_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_live_touch_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_live_touch_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_log_exam_event_v1(uuid, text, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_log_exam_event_v1(uuid, text, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_log_exam_event_v1(uuid, text, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_make_live_code_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_make_live_code_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_make_live_code_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_active_attempt_security_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_active_attempt_security_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_active_attempt_security_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_attempt_start_info_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_attempt_start_info_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_attempt_start_info_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_available_exams_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_available_exams_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_available_exams_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_capabilities_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_capabilities_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_capabilities_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_live_class_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_live_class_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_live_class_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_live_class_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_live_class_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_live_class_v2(uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_released_attempt_answers_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_results_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_results_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_results_v1() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_my_results_v2()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_my_results_v2() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_results_v2() TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_normalize_short_text_v1(text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_normalize_short_text_v1(text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_normalize_short_text_v1(text) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_override_response_score_v1(uuid, numeric, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid, numeric, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_override_response_score_v1(uuid, numeric, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_prepare_live_session_v1(uuid, uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_prepare_live_session_v1(uuid, uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_prepare_live_session_v1(uuid, uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_profile_display_name_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_profile_display_name_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_profile_display_name_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_publish_exam_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_publish_exam_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_record_diagnostics_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid, uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_records_mark_retake_v1(uuid, uuid, uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_records_mark_retake_v1(uuid, uuid, uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_records_mark_retake_v1(uuid, uuid, uuid, uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_records_remove_for_reentry_v1(uuid, uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(uuid, uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_records_remove_for_reentry_v1(uuid, uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_records_retake_state_v1(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_records_retake_state_v1(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_records_retake_state_v1(uuid, uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_recovery_bridge_token_v1()') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_recovery_bridge_token_v1() FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_recovery_bridge_token_v1() TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_release_attempt_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_release_attempt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_attempt_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_release_attempt_v2(uuid, boolean, boolean, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_release_attempt_v2(uuid, boolean, boolean, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_release_attempt_v2(uuid, boolean, boolean, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_restore_exam_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_restore_exam_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_review_job_start_v2(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_review_job_start_v2(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_job_start_v2(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_review_queue_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_review_queue_v2(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v2(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v2(uuid, uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_review_response_v1(uuid, numeric, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_review_response_v1(uuid, numeric, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_response_v1(uuid, numeric, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_save_answer_v1(uuid, uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v1(uuid, uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v1(uuid, uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_save_answer_v2(uuid, uuid, jsonb, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_save_answer_v2(uuid, uuid, jsonb, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answer_v2(uuid, uuid, jsonb, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_save_answers_batch_v1(uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v1(uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_save_answers_batch_v2(uuid, jsonb, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid, jsonb, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_save_answers_batch_v2(uuid, jsonb, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_saved_answers_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_saved_answers_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_saved_answers_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_search_people_v1(text, integer)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_search_people_v1(text, integer) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_search_people_v1(text, integer) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_section_analytics_v2(uuid, uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid, uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid, uuid) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_section_records_v2(uuid, uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_section_records_v2(uuid, uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_records_v2(uuid, uuid, text) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_seed_attempt_questions_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_seed_attempt_questions_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_seed_attempt_questions_v1(uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_seed_attempt_questions_v2(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_seed_attempt_questions_v2(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_seed_attempt_questions_v2(uuid) TO service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_set_exam_security_custom_v1(uuid, text, boolean, text, text, boolean, boolean, boolean, boolean, boolean, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_set_exam_security_custom_v1(uuid, text, boolean, text, text, boolean, boolean, boolean, boolean, boolean, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_set_exam_security_custom_v1(uuid, text, boolean, text, text, boolean, boolean, boolean, boolean, boolean, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_set_integrity_deduction_rules_v1(jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_set_integrity_deduction_rules_v1(jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_set_integrity_deduction_rules_v1(jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_set_integrity_deductions_batch_v1(uuid, uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v1(uuid, uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v1(uuid, uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_set_integrity_deductions_batch_v2(uuid, uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v2(uuid, uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_set_integrity_deductions_batch_v2(uuid, uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_snapshot_live_session_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_snapshot_live_session_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_snapshot_live_session_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_start_attempt_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_start_attempt_v2(uuid, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_start_attempt_v2(uuid, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_student_questions_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_student_questions_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_submit_attempt_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_submit_attempt_v2(uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v2(uuid, jsonb) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_submit_attempt_v3(uuid, jsonb, timestamp with time zone, boolean)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid, jsonb, timestamp with time zone, boolean) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v3(uuid, jsonb, timestamp with time zone, boolean) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_submit_attempt_v4(uuid, jsonb, timestamp with time zone, boolean, text, text)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid, jsonb, timestamp with time zone, boolean, text, text) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_submit_attempt_v4(uuid, jsonb, timestamp with time zone, boolean, text, text) TO anon,authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_transmuted_percent_v1(numeric, numeric)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_transmuted_percent_v1(numeric, numeric) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_transmuted_percent_v1(numeric, numeric) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_unpublish_exam_v1(uuid)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_unpublish_exam_v1(uuid) TO authenticated,service_role';
 END IF;
 IF to_regprocedure('public.buklod_quiz_update_exam_v2(uuid, jsonb)') IS NOT NULL THEN
 EXECUTE 'REVOKE ALL ON FUNCTION public.buklod_quiz_update_exam_v2(uuid, jsonb) FROM PUBLIC,anon,authenticated,service_role';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.buklod_quiz_update_exam_v2(uuid, jsonb) TO authenticated,service_role';
 END IF;
END;
$acl$;
