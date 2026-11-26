-- R20 DEV candidate: reporting is read-only, never reconstruct historical grades.
-- Depends on R19 capture-time provenance. Historical item references without
-- frozen snapshots are explicitly marked unverified in class analytics.
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
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc limit 1
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
    (c.attempt_id is not null and c.response_count=0 and c.total_score is not null and coalesce(c.max_score,0)>0 and c.status in ('NEEDS_REVIEW','GRADED','RELEASED')),
    (c.status in ('NEEDS_REVIEW','GRADED','RELEASED') and c.total_score is not null and coalesce(c.max_score,0)>0 and c.total_score between 0 and c.max_score),
    (c.response_count>0),(c.event_row_count>0),
    (c.attempt_id is not null and c.status in ('GRADED','NEEDS_REVIEW') and c.pending_review_count=0 and (c.response_count>0 or (c.total_score is not null and coalesce(c.max_score,0)>0)))
  from counts c left join lateral public.buklod_quiz_integrity_metrics_v1(c.attempt_id) m on c.attempt_id is not null and c.event_row_count>0;
end;
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
    select r.student_user_id,a.id attempt_id,a.status,a.total_score,a.max_score,a.live_session_id
    from roster r left join lateral (
      select ax.id,ax.status,ax.total_score,ax.max_score,ax.live_session_id from public.buklod_quiz_attempts ax
      where ax.exam_id=p_exam_id and ax.section_id=p_section_id and ax.student_user_id=r.student_user_id and ax.status<>'VOID'
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc limit 1
    ) a on true
  ), diag as (
    select * from public.buklod_quiz_record_diagnostics_v1(p_exam_id,p_section_id)
  ), enriched as (
    select l.*,coalesce(d.response_count,0) response_count,coalesce(d.pending_review_count,0) pending_review_count,
      coalesce(d.legacy_score_only,false) legacy_score_only,coalesce(d.score_available,false) score_available,
      coalesce(d.item_data_available,false) item_data_available,coalesce(d.release_eligible,false) release_eligible
    from latest l left join diag d on d.student_user_id=l.student_user_id and d.attempt_id is not distinct from l.attempt_id
  ), exam_cfg as (
    select e.pass_percent from public.buklod_quiz_exams e where e.id=p_exam_id
  ), score_finalish as (
    select e.* from enriched e where e.score_available=true and (e.status in ('GRADED','RELEASED') or e.legacy_score_only=true or (e.status='NEEDS_REVIEW' and e.pending_review_count=0 and e.response_count>0))
  ), item_attempts as (
    select e.* from enriched e where e.attempt_id is not null and e.response_count>0 and e.status in ('NEEDS_REVIEW','GRADED','RELEASED')
  ), retained as (
    select ia.attempt_id,r.question_id,r.answer,r.is_correct,r.manual_score,r.objective_score,r.needs_review,
      aq.points assigned_points,coalesce(s.question_type,q.question_type) question_type,
      coalesce(s.prompt,q.prompt) prompt,coalesce(s.options,q.options) options,
      coalesce(aq.display_order,q.sort_order) sort_order,
      (aq.question_id is not null and s.question_id is not null) verified,
      case when r.answer is null or r.answer in ('null'::jsonb,'[]'::jsonb,'{}'::jsonb) then false
           when jsonb_typeof(r.answer)='string' then nullif(btrim(r.answer#>>'{}'),'') is not null else true end answered
    from item_attempts ia join public.buklod_quiz_attempts at on at.id=ia.attempt_id
    join public.buklod_quiz_responses r on r.attempt_id=ia.attempt_id and r.student_user_id=at.student_user_id
    join public.buklod_quiz_questions q on q.id=r.question_id and q.exam_id=at.exam_id
    left join public.buklod_quiz_attempt_questions aq on aq.attempt_id=at.id and aq.question_id=r.question_id
    left join public.buklod_quiz_live_question_snapshots s on s.session_id=at.live_session_id and s.question_id=r.question_id
    where aq.question_id is not null or not exists(select 1 from public.buklod_quiz_attempt_questions x where x.attempt_id=at.id)
  ), grouped as (
    select x.question_id,min(x.sort_order) sort_order,min(x.question_type) question_type,
      case when count(distinct x.prompt)=1 then min(x.prompt) else '[Different examination versions; review separately]' end prompt,
      count(distinct jsonb_build_array(x.question_type,x.prompt,x.options)) reference_variants,
      bool_and(x.verified) reference_verified,
      count(*)::integer submitted_count,
      count(*) filter(where x.answered)::integer answered_count,
      count(*) filter(where x.answered and not (x.needs_review is true and x.manual_score is null) and x.is_correct is true)::integer correct_count,
      count(*) filter(where x.answered and not (x.needs_review is true and x.manual_score is null) and x.is_correct is false)::integer incorrect_count,
      count(*) filter(where x.answered and x.is_correct is null and x.assigned_points is not null and x.manual_score>0 and x.manual_score<x.assigned_points)::integer partial_count,
      count(*) filter(where x.needs_review is true and x.manual_score is null)::integer pending_review_count,
      count(*) filter(where not x.answered)::integer unanswered_count
    from retained x group by x.question_id
  ), item_rows as (
    select g.*,row_number() over(order by g.sort_order,g.question_id)::integer question_no from grouped g
  ), items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'question_id',i.question_id,'question_no',i.question_no,'question_type',i.question_type,'prompt',i.prompt,
      'submitted_count',i.submitted_count,'answered_count',i.answered_count,'correct_count',i.correct_count,
      'incorrect_count',i.incorrect_count,'partial_count',i.partial_count,'pending_review_count',i.pending_review_count,
      'unanswered_count',i.unanswered_count,'reference_verified',i.reference_verified,'reference_variants',i.reference_variants,
      'option_counts',case when i.reference_verified and i.reference_variants=1 and i.question_type='MCQ' then (
        select coalesce(jsonb_agg(jsonb_build_object('label',chr(64+opt.ord::integer),'option',opt.option_text,'count',(
          select count(*) from retained x where x.question_id=i.question_id and lower(btrim(x.answer#>>'{}'))=lower(btrim(opt.option_text))
        )) order by opt.ord),'[]'::jsonb)
        from jsonb_array_elements_text(case when jsonb_typeof((select x.options from retained x where x.question_id=i.question_id limit 1))='array'
          then (select x.options from retained x where x.question_id=i.question_id limit 1) else '[]'::jsonb end) with ordinality opt(option_text,ord)
      ) else '[]'::jsonb end
    ) order by i.question_no),'[]'::jsonb) value from item_rows i
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
      'item_analyzed_attempts',(select count(distinct attempt_id) from retained),
      'item_data_available',exists(select 1 from retained),
      'verified_item_attempts',(select count(distinct attempt_id) from retained where verified),
      'unverified_reference_items',(select count(*) from retained where not verified),
      'graded_or_released',(select count(*) from enriched where status in ('GRADED','RELEASED')),
      'score_analyzed_attempts',(select count(*) from score_finalish),
      'passed',(select count(*) from score_finalish s cross join exam_cfg e left join public.buklod_quiz_live_sessions ls on ls.id=s.live_session_id where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)>=coalesce(ls.pass_percent,e.pass_percent)),
      'not_passed',(select count(*) from score_finalish s cross join exam_cfg e left join public.buklod_quiz_live_sessions ls on ls.id=s.live_session_id where public.buklod_quiz_transmuted_percent_v1(s.total_score,s.max_score)<coalesce(ls.pass_percent,e.pass_percent)),
      'pass_percent',(select pass_percent from exam_cfg)
    ),
    'items',(select value from items),
    'notice',case
      when not exists(select 1 from retained) then 'No item-level response data is retained for this section. Recorded scores remain available; item answers and item statistics will not be fabricated.'
      when exists(select 1 from retained where not verified) then 'Historical response statistics use recorded outcomes; current question references are not verified and option analysis is withheld.'
      when (select count(distinct attempt_id) from retained)<(select count(*) from enriched where attempt_id is not null and status<>'STARTED') then 'Item analytics includes only attempts with retained response data. Some historical score-only records are excluded from item statistics.'
      else 'Item analytics uses retained response rows from the latest official attempts.' end
  ) into v_result;
  return v_result;
end;
$function$;
CREATE FUNCTION public.buklod_quiz_section_analytics_v1(p_exam_id uuid,p_section_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$ SELECT public.buklod_quiz_section_analytics_v2(p_exam_id,p_section_id); $fn$;

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
    coalesce(rst.display_name,p.full_name,p.username,'BUKLOD Student')::text,
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
    coalesce(r.manual_score,case when proof.response_id is not null then sug.suggested_score end),
    coalesce(nullif(btrim(r.feedback::text),''), case when proof.response_id is not null then sug.feedback::text end)
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_sections s
    on s.id=a.section_id and s.exam_id=a.exam_id
  join public.buklod_quiz_responses r
    on r.attempt_id=a.id
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id
  left join public.buklod_quiz_roster rst
    on rst.exam_id=a.exam_id
   and rst.section_id=a.section_id
   and rst.student_user_id=a.student_user_id
  left join public.profiles p
    on p.id=a.student_user_id
  left join public.buklod_quiz_review_suggestions sug
    on sug.response_id=r.id
   and sug.created_by=v_actor
  left join public.buklod_quiz_trusted_review_suggestions proof on proof.response_id=sug.response_id and proof.job_id=sug.job_id
    and proof.snapshot=jsonb_build_object('suggestion',to_jsonb(sug),'capture_digest',private.buklod_quiz_review_capture_r19(r.id),'version',19)
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
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=rr.question_id
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
    and public.buklod_quiz_is_examiner(auth.uid()) and rr.manual_score is null and rr.needs_review = true
    and a.status = 'NEEDS_REVIEW'
  order by
    lower(coalesce(nullif(trim(p.surname), ''), ro.surname, '')),
    lower(coalesce(nullif(trim(p.first_name), ''), ro.first_name, '')),
    lower(coalesce(public.buklod_quiz_profile_display_name_v1(a.student_user_id), ro.display_name, '')),
    a.attempt_no,
    q.sort_order
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_review_queue_v1(p_exam_id uuid)
 RETURNS TABLE(attempt_id uuid, response_id uuid, student_user_id uuid, display_name text, section_name text, question_id uuid, prompt text, question_type text, points numeric, answer_text text, manual_score numeric, feedback text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select a.id,r.id,a.student_user_id,ro.display_name,s.name,q.id,q.prompt,q.question_type,q.points,r.answer#>>'{}',r.manual_score,r.feedback from public.buklod_quiz_attempts a join public.buklod_quiz_responses r on r.attempt_id=a.id join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id join public.buklod_quiz_roster ro on ro.exam_id=a.exam_id and ro.section_id=a.section_id and ro.student_user_id=a.student_user_id join public.buklod_quiz_sections s on s.id=ro.section_id join public.buklod_quiz_exams e on e.id=a.exam_id where a.exam_id=p_exam_id and e.owner_user_id=auth.uid() and r.needs_review=true and a.status='NEEDS_REVIEW' and r.manual_score is null and public.buklod_quiz_is_examiner(auth.uid()) order by s.sort_order,lower(ro.surname),lower(ro.first_name),a.attempt_no,q.sort_order $function$;

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
  join lateral private.buklod_quiz_review_reference_r19(a.id) q on q.id=r.question_id
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
    and a.status='NEEDS_REVIEW' and r.manual_score is null and public.buklod_quiz_is_examiner(auth.uid())
  order by lower(coalesce(nullif(ro.surname,''),nullif(ro.display_name,''),'zzzz')),
           lower(coalesce(ro.first_name,'')),
           lower(coalesce(ro.display_name,'')),
           a.attempt_no,
           q.sort_order
$function$;

CREATE OR REPLACE FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(p_attempt_id uuid)
 RETURNS TABLE(question_no integer, question_type text, prompt text, options jsonb, points numeric, answer_text text, correct_answer_text text, awarded_score numeric, feedback text, explanation text, show_correct boolean, show_explanation boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE a public.buklod_quiz_attempts%ROWTYPE; p public.buklod_quiz_release_preferences%ROWTYPE; s public.buklod_quiz_live_sessions%ROWTYPE; can_answers boolean; can_correct boolean; can_explain boolean;
BEGIN
 SELECT x.* INTO a FROM public.buklod_quiz_attempts x WHERE x.id=p_attempt_id AND x.student_user_id=auth.uid() AND x.status='RELEASED';
 IF NOT FOUND THEN RAISE EXCEPTION 'Released result not found'; END IF;
 SELECT pref.* INTO p FROM public.buklod_quiz_release_preferences pref WHERE pref.attempt_id=a.id;
 SELECT ls.* INTO s FROM public.buklod_quiz_live_sessions ls WHERE ls.id=a.live_session_id;
 can_answers:=coalesce(p.show_answers,s.show_answers_after_release,false);
 can_correct:=coalesce(p.show_answers,s.show_correct_after_release,false);
 can_explain:=coalesce(p.show_rationale,s.show_explanations_after_release,false);
 IF NOT can_answers THEN RAISE EXCEPTION 'Faculty did not enable answer review'; END IF;
 -- No seeding, recompute, or synthetic answer rows. Historical answer keys withheld if not frozen.
 RETURN QUERY SELECT row_number() over(order by coalesce(aq.display_order,q.sort_order),q.id)::integer,
 coalesce(snap.question_type,q.question_type),coalesce(snap.prompt,q.prompt),
 case when snap.question_id is not null then snap.options else null end,
 aq.points,coalesce(r.answer#>>'{}',''),
 case when can_correct and snap.question_id is not null and aq.question_id is not null then coalesce(snap.correct_answer#>>'{}','') else '' end,
 coalesce(r.manual_score,r.objective_score),r.feedback,
 case when can_explain and snap.question_id is not null and aq.question_id is not null then snap.explanation else null end,
 (can_correct and snap.question_id is not null and aq.question_id is not null),
 (can_explain and snap.question_id is not null and aq.question_id is not null)
 FROM public.buklod_quiz_responses r JOIN public.buklod_quiz_questions q ON q.id=r.question_id AND q.exam_id=a.exam_id
 LEFT JOIN public.buklod_quiz_attempt_questions aq ON aq.attempt_id=a.id AND aq.question_id=r.question_id
 LEFT JOIN public.buklod_quiz_live_question_snapshots snap ON snap.session_id=a.live_session_id AND snap.question_id=r.question_id
 WHERE r.attempt_id=a.id AND r.student_user_id=a.student_user_id
 AND (aq.question_id IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.buklod_quiz_attempt_questions x WHERE x.attempt_id=a.id))
 ORDER BY coalesce(aq.display_order,q.sort_order),q.id;
END;
$fn$;

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
    case when coalesce(pref.show_violations,false) then public.buklod_quiz_integrity_incident_count_v1(a.id) else 0 end,
    case when coalesce(pref.show_violations,false) then coalesce((
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
    ),'[]'::jsonb) else '[]'::jsonb end
  from public.buklod_quiz_attempts a
  join public.buklod_quiz_exams e on e.id=a.exam_id
  join public.buklod_quiz_sections s on s.id=a.section_id
  left join public.buklod_quiz_live_sessions ls on ls.id=a.live_session_id
  left join public.buklod_quiz_release_preferences pref on pref.attempt_id=a.id
  where a.student_user_id=(select auth.uid()) and a.status='RELEASED'
  order by a.released_at desc
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
      case when a.status in ('GRADED','RELEASED') and a.total_score between 0 and a.max_score and coalesce(a.max_score,0)>0 then public.buklod_quiz_transmuted_percent_v1(a.total_score,a.max_score) else null end as score_percent,
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
      order by ax.attempt_no desc,ax.created_at desc,ax.id desc
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
      case when b.score_percent is null then null::bigint
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
REVOKE ALL ON FUNCTION public.buklod_quiz_section_analytics_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_analytics_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_section_analytics_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_record_diagnostics_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_records_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_records_v1(uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v1(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_class_review_queue_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_review_queue_v2(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_review_queue_v2(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_released_attempt_answers_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.buklod_quiz_my_results_v2() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_my_results_v2() TO authenticated;
