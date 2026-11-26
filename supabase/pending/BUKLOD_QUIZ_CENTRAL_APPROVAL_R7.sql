-- DEV candidate: preserve existing approval contract; serialize with release/finalization.
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
  where a.id=p_attempt_id for update of a;

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
    if v_score is null or v_score::text in ('NaN','Infinity','-Infinity') or v_score<0 or v_score>v_points then raise exception 'Manual score out of range for response %.',v_response_id; end if;

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
REVOKE ALL ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.buklod_quiz_approve_attempt_review_v2(uuid,jsonb) TO authenticated;
