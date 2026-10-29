-- K-of-N preflight accepts p_settings.question_count; no hardcoded numbers.
CREATE OR REPLACE FUNCTION public.buklod_quiz_prepare_live_session_v1(p_exam_id uuid, p_section_id uuid, p_settings jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(session_id uuid, exam_id uuid, section_id uuid, section_name text, exam_title text, join_code text, live_status text, duration_minutes integer, max_attempts integer, pass_percent numeric, question_count integer, bank_question_count integer, total_score_target numeric, randomize_questions boolean, randomize_choices boolean, one_question_at_a_time boolean, no_backtracking boolean, admission_mode text, allow_late_join boolean, late_join_minutes integer, require_fullscreen_web boolean, block_screen_capture boolean, integrity_mode text, result_release_mode text, show_answers_after_release boolean, show_correct_after_release boolean, show_explanations_after_release boolean, settings_locked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  e public.buklod_quiz_exams%rowtype; s public.buklod_quiz_live_sessions%rowtype; sx public.buklod_quiz_sections%rowtype;
  v_bank int; v_take int; v_raw numeric; v_duration int; v_attempts int; v_pass numeric; v_admission text; v_late boolean; v_late_minutes int;
  v_random boolean; v_one boolean; v_noback boolean; v_full boolean; v_capture boolean; v_integrity text;
begin
  select x.* into e from public.buklod_quiz_exams x where x.id=p_exam_id and x.owner_user_id=(select auth.uid()) and x.archived_at is null;
  if e.id is null then raise exception 'Exam not found or unauthorized.'; end if;
  select x.* into sx from public.buklod_quiz_sections x where x.id=p_section_id and x.exam_id=p_exam_id and x.archived_at is null;
  if sx.id is null then raise exception 'Class/section not found.'; end if;
  select count(*)::int,coalesce(sum(q.points),0)::numeric into v_bank,v_raw from public.buklod_quiz_questions q where q.exam_id=p_exam_id and q.is_active=true;
  if v_bank<1 then raise exception 'Add at least one active question before preparing live exam.'; end if;

  v_take:=coalesce(nullif(p_settings->>'question_count','')::int,v_bank);
  IF v_take<1 OR v_take>v_bank THEN RAISE EXCEPTION 'Item count must be between 1 and % (available bank).',v_bank; END IF;
  v_duration:=coalesce(nullif(p_settings->>'duration_minutes','')::int,e.duration_minutes,30);
  v_attempts:=coalesce(nullif(p_settings->>'max_attempts','')::int,e.max_attempts,1);
  v_pass:=coalesce(nullif(p_settings->>'pass_percent','')::numeric,e.pass_percent,75);
  v_admission:=upper(coalesce(nullif(p_settings->>'admission_mode',''),'OPEN'));
  v_late:=coalesce((p_settings->>'allow_late_join')::boolean,true);
  v_late_minutes:=coalesce(nullif(p_settings->>'late_join_minutes','')::int,0);
  v_random:=coalesce((p_settings->>'randomize_questions')::boolean,e.randomize_questions,true);
  v_one:=coalesce((p_settings->>'one_question_at_a_time')::boolean,e.one_question_at_a_time,true);
  v_noback:=coalesce((p_settings->>'no_backtracking')::boolean,e.no_backtracking,false);
  v_full:=coalesce((p_settings->>'require_fullscreen_web')::boolean,e.require_fullscreen_web,false);
  v_capture:=coalesce((p_settings->>'block_screen_capture')::boolean,e.block_screen_capture,true);
  v_integrity:=upper(coalesce(nullif(p_settings->>'integrity_mode',''),e.integrity_mode,'MONITOR'));
  if v_duration<1 or v_duration>1440 then raise exception 'Duration must be 1 to 1440 minutes.'; end if;
  if v_attempts<1 or v_attempts>20 then raise exception 'Max attempts must be 1 to 20.'; end if;
  if v_pass<0 or v_pass>100 then raise exception 'Passing grade must be 0 to 100.'; end if;
  if v_admission not in ('OPEN','APPROVAL') then raise exception 'Admission mode must be OPEN or APPROVAL.'; end if;
  IF v_random AND v_take<v_bank
    AND (SELECT count(DISTINCT q.points) FROM public.buklod_quiz_questions q
         WHERE q.exam_id=p_exam_id AND q.is_active)>1 THEN
     RAISE EXCEPTION 'Random subset requires equal point values for fair score comparison.';
  END IF;

  select x.* into s from public.buklod_quiz_live_sessions x
  where x.exam_id=p_exam_id and x.section_id=p_section_id and x.faculty_user_id=(select auth.uid()) and x.status<>'ENDED'
  order by x.created_at desc limit 1 for update;
  if s.id is not null and s.status in ('LIVE','PAUSED') then raise exception 'Live settings are locked after START.'; end if;
  if s.id is null then
    insert into public.buklod_quiz_live_sessions(exam_id,section_id,faculty_user_id,join_code,status,admission_mode,allow_late_join)
    values(p_exam_id,p_section_id,(select auth.uid()),public.buklod_quiz_make_live_code_v1(),'WAITING',v_admission,v_late)
    returning * into s;
  end if;

  update public.buklod_quiz_exams x set duration_minutes=v_duration,max_attempts=v_attempts,pass_percent=v_pass,
    randomize_questions=v_random,one_question_at_a_time=v_one,no_backtracking=v_noback,require_fullscreen_web=v_full,
    block_screen_capture=v_capture,integrity_mode=v_integrity,integrity_auto_submit=false,updated_at=now()
  where x.id=p_exam_id;

  update public.buklod_quiz_live_sessions x set status='WAITING',admission_mode=v_admission,allow_late_join=v_late,
    duration_minutes=v_duration,max_attempts=v_attempts,pass_percent=v_pass,question_count=v_take,total_score_target=round(v_raw*v_take/v_bank,2),
    randomize_questions=v_random,randomize_choices=false,one_question_at_a_time=v_one,no_backtracking=v_noback,
    late_join_minutes=v_late_minutes,require_fullscreen_web=v_full,block_screen_capture=v_capture,integrity_mode=v_integrity,
    result_release_mode='MANUAL',show_answers_after_release=coalesce((p_settings->>'show_answers_after_release')::boolean,true),
    show_correct_after_release=coalesce((p_settings->>'show_correct_after_release')::boolean,false),
    show_explanations_after_release=coalesce((p_settings->>'show_explanations_after_release')::boolean,false),
    settings_snapshot=jsonb_build_object('compat_mode','DEDICATED_R10_CORE','question_count',v_take,'bank_question_count',v_bank,'total_score_target',round(v_raw*v_take/v_bank,2),'question_selection_mode','SNAPSHOT_R1'),
    config_locked_at=null,updated_at=now()
  where x.id=s.id returning * into s;

  return query select s.id,s.exam_id,s.section_id,sx.name,e.title,s.join_code,s.status,v_duration,v_attempts,v_pass,
    v_take,v_bank,round(v_raw*v_take/v_bank,2),v_random,false,v_one,v_noback,v_admission,v_late,v_late_minutes,v_full,v_capture,v_integrity,
    'MANUAL'::text,s.show_answers_after_release,s.show_correct_after_release,s.show_explanations_after_release,false;
end
$function$;
