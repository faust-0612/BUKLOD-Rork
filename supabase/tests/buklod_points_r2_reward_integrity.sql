-- Execute after R2 migrations on isolated test database. Read-only assertions only.
begin;
do $contract$
declare
 v_count integer;
 v_definition text;
begin
 if to_regclass('private.buklod_r2_bible_quiz_questions') is null
    or to_regclass('private.buklod_r2_bible_quiz_attempts') is null then
  raise exception 'Bible Quiz backend missing';
 end if;
 select count(*) into v_count from private.buklod_r2_bible_quiz_questions;
 if v_count < 15 then raise exception 'Insufficient server-owned Bible Quiz bank: %',v_count;end if;
 if has_table_privilege('authenticated','private.buklod_r2_bible_quiz_questions','SELECT') then
  raise exception 'Bible Quiz answer table exposed to authenticated client';
 end if;
 if has_function_privilege('authenticated',
   'public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid)','EXECUTE') then
  raise exception 'Direct internal attendance credit privilege still open';
 end if;
 if has_function_privilege('authenticated',
   'public.buklod_reverse_scope_attendance_points_v1(uuid,uuid,timestamptz,uuid)','EXECUTE') then
  raise exception 'Direct internal attendance debit privilege still open';
 end if;
 select pg_get_functiondef('public.buklod_award_scope_attendance_points_v1(uuid,uuid,uuid,text,uuid)'::regprocedure)
 into v_definition;
 if position('buklod_scope_memberships' in v_definition)=0
    or position('membership_status' in v_definition)=0
    or position('attendance_records' in v_definition)=0 then
    raise exception 'Cluster attendance award missing real-record or membership guard';
 end if;
 select pg_get_functiondef('public.admin_award_buklod_r2_accomplishment_v1(uuid,text,text,text,text)'::regprocedure)
 into v_definition;
 if position('is_system_admin' in v_definition)=0
    or position('pg_advisory_xact_lock' in v_definition)=0 then
    raise exception 'Achievement award missing admin or concurrency checks';
 end if;
 if to_regclass('private.buklod_r2_mentor_report_requests') is null then
    raise exception 'Idempotent mentor report registry missing';
 end if;
 select pg_get_functiondef('public.report_my_mentor_teaching_with_roster_r2(uuid,uuid[],text,text)'::regprocedure)
 into v_definition;
 if position('mentor_assignments' in v_definition)=0
    or position('mentor_set_session_attendees' in v_definition)=0
    or position('pg_advisory_xact_lock' in v_definition)=0 then
    raise exception 'Mentor report must use real active mentees, registered attendance and idempotency';
 end if;
 if to_regclass('private.buklod_r2_mentor_session_evidence') is null then
    raise exception 'Private mentoring photo proof missing';
 end if;
 if not exists(select 1 from pg_trigger where tgname='buklod_r2_mentor_photo_approval_guard'
  and not tgisinternal) then
    raise exception 'Mentor approval photo guard not installed';
 end if;
 if not exists(select 1 from public.buklod_point_rules
  where activity_type='abc_growth_lesson' and base_points=8 and is_active) then
    raise exception 'ABC future award rule not activated';
 end if;
 if not exists(select 1 from public.buklod_point_rules
  where activity_type='scope_attendance' and is_active) then
    raise exception 'Existing verified attendance configuration absent';
 end if;
 if not exists(select 1 from public.buklod_point_rules
  where activity_type='bible_quiz_hard' and base_points=12 and is_active) then
    raise exception 'Bible Quiz hard reward unavailable';
 end if;
 select pg_get_functiondef('public.get_my_buklod_r2_focus_monitor_v1()'::regprocedure)
 into v_definition;
 if position('buklod_points_ledger' in v_definition)=0
    or position('buklod_r2_focus_classify_v1' in v_definition)=0 then
    raise exception 'Reward focus monitoring is not ledger-based';
 end if;
 if has_table_privilege('authenticated','public.buklod_r2_achievement_nominations','SELECT') then
    raise exception 'Milestone nominations exposed outside guarded RPC';
 end if;
 raise notice 'BUKLOD Points R2 isolated database contract PASS';
end;
$contract$;
rollback;
