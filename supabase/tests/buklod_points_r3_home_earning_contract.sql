-- R3 Points DB contract: run after R2+R3 migrations in an isolated test database.
begin;
do $contract$
declare v text;
begin
 if to_regclass('public.buklod_home_event_checkins_r3') is null then
   raise exception 'Home self check-in table missing';end if;
 if has_table_privilege('authenticated','public.buklod_home_event_checkins_r3','INSERT') then
   raise exception 'Member may bypass check-in RPC and forge records';end if;
 select pg_get_functiondef('public.submit_my_buklod_home_checkin_r3(uuid)'::regprocedure) into v;
 if position('attendance_events' in v)=0
    or position('membership_status' in v)=0
    or position('attendance_close_at' in v)=0
    or position('on conflict' in lower(v))=0 then
   raise exception 'Home Check-in missing active event membership or idempotent checks';end if;
 select pg_get_functiondef('public.admin_review_buklod_home_checkin_r3(uuid,boolean,text)'::regprocedure) into v;
 if position('is_system_admin' in v)=0 or position('for update' in lower(v))=0
  or position('buklod_points_ledger' in v)=0 then
  raise exception 'Admin attendance approval missing authorization or ledger transaction';end if;
 select pg_get_functiondef('public.get_my_buklod_bible_quiz_r3(text)'::regprocedure) into v;
 if position('pg_advisory_xact_lock' in v)=0 or position('limit 5' in lower(v))=0 then
   raise exception 'Daily Bible Quiz does not enforce five locked questions';end if;
 select pg_get_functiondef('public.submit_my_buklod_bible_quiz_r3(uuid,jsonb)'::regprocedure) into v;
 if position('correct>=4' in v)=0 or position('on conflict' in lower(v))=0 then
  raise exception 'Difficulty quiz server scoring or credit idempotency absent';end if;
 if has_table_privilege('authenticated','private.buklod_r2_bible_quiz_questions','SELECT') then
  raise exception 'Bible Quiz server answer key exposed';end if;
 select pg_get_functiondef('public.admin_review_mentor_session_r3(uuid,boolean,text)'::regprocedure) into v;
 if position('is_system_admin' in v)=0 or position('reported' in v)=0
  or position('mentor_session_attendees' in v)=0 then
  raise exception 'Mentoring approval still requires Pastor or lacks attendee evidence';end if;
 select pg_get_functiondef('public.kl_reading_progress_v1(uuid,text)'::regprocedure) into v;
 if position('v_user,5,' in v)=0 or position('v_user,30,' in v)=0
  or position('v_season_count=30 and v_finished=30' in v)=0 then
  raise exception 'KL +5 chapter and +30 series rules absent';end if;
 select pg_get_functiondef('public.admin_review_buklod_r2_achievement_v1(uuid,boolean,text)'::regprocedure) into v;
 if position('count(distinct p.lesson_id)' in v)=0
   or position('status=''approved''' in v)=0
   or position('first_cleared_at' in v)=0 then
   raise exception 'Major milestones missing objective completed ABC, approved mentor or Kingdom progress thresholds';
 end if;
 select pg_get_functiondef('public.submit_my_buklod_r2_achievement_v1(text,text)'::regprocedure) into v;
 if position('status=''rejected''' in v)=0 or position('on conflict' in lower(v))=0 then
   raise exception 'Rejected achievement nomination cannot be revised safely';
 end if;
 if has_function_privilege('authenticated',
 'public.buklod_award_verification_points_v1(uuid,integer,text,text,uuid,text,uuid)','EXECUTE')
 or has_function_privilege('anon',
 'public.buklod_award_verification_points_v1(uuid,integer,text,text,uuid,text,uuid)','EXECUTE') then
  raise exception 'Critical: generic arbitrary points credit RPC is still directly executable';
 end if;
 if has_function_privilege('authenticated',
 'public.get_my_buklod_bible_quiz_r2()','EXECUTE') or
 has_function_privilege('authenticated',
 'public.submit_my_buklod_bible_quiz_r2(uuid,jsonb)','EXECUTE') then
  raise exception 'Legacy Bible Quiz score RPC bypass still public';
 end if;
 raise notice 'Points R3 Home Quiz / Check-in / Mentoring / KL contracts: PASS';
end;
$contract$;
rollback;
