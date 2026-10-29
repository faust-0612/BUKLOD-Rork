-- Score and final grade denominator based on assigned questions only; no recomputation of existing scores.
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
    and r.attempt_id = p_attempt_id
    AND private.buklod_quiz_attempt_question_allowed_r1(p_attempt_id,q.id);

  select
    coalesce(sum(case when r.manual_score is null then coalesce(r.objective_score,0) else 0 end),0),
    coalesce(sum(coalesce(r.manual_score,0)),0),
    coalesce(sum(q.points),0),
    coalesce(bool_or(r.needs_review and r.manual_score is null),false)
    into v_obj,v_man,v_max,v_pending
  from public.buklod_quiz_responses r
  join public.buklod_quiz_questions q on q.id=r.question_id
  where r.attempt_id=p_attempt_id
    and q.is_active=true
    AND private.buklod_quiz_attempt_question_allowed_r1(p_attempt_id,q.id);

  -- Unanswered assigned items count in max possible points even if no response row.
  IF EXISTS(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 x WHERE x.attempt_id=p_attempt_id) THEN
    SELECT coalesce(sum(x.selected_points),0) INTO v_max
    FROM private.buklod_quiz_attempt_questions_r1 x WHERE x.attempt_id=p_attempt_id;
  END IF;
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

    IF EXISTS(SELECT 1 FROM private.buklod_quiz_attempt_questions_r1 x WHERE x.attempt_id=new.id) THEN
      SELECT sum(x.selected_points) INTO v_exam_total
      FROM private.buklod_quiz_attempt_questions_r1 x WHERE x.attempt_id=new.id;
    END IF;
    if v_exam_total is not null then
      new.max_score := v_exam_total;
    end if;
  end if;
  return new;
end;
$function$;