-- One-time automated grading of historical essays previously awaiting humans.
-- Existing owner-scoped attempts/answers stay intact. Server daily BP source key
-- remains unique, final grades and notifications happen in one transaction.
do $auto_backfill$
declare
 a record; q record; v_feedback jsonb; v_review jsonb;
 v_total int; v_result jsonb; v_essays int;
begin
 for a in
  select * from private.buklod_bible_v4_attempts
  where state='pending_review'
  for update
 loop
  v_review:=a.review_items; v_essays:=0;
  if jsonb_typeof(v_review)<>'array' then
   raise exception 'Missing frozen review for pending attempt %',a.id;
  end if;
  for q in
   select * from private.buklod_bible_v4_questions
   where id=any(a.question_keys) and kind='essay' and reviewed
   order by array_position(a.question_keys,id)
  loop
   v_essays:=v_essays+1;
   if not (a.submitted_answers ? q.id) then
    raise exception 'Missing submitted essay for pending attempt %',a.id;
   end if;
   v_feedback:=private.buklod_bible_v4_grade_essay(q.id,a.submitted_answers->>q.id);
   select jsonb_agg(
     case when item.value->>'id'=q.id
      then jsonb_set(jsonb_set(item.value,'{earned_units}',
        to_jsonb((v_feedback->>'units')::int)),
        '{rubric_feedback}',v_feedback,true)
      else item.value end order by item.ordinality)
   into v_review from jsonb_array_elements(v_review) with ordinality item(value,ordinality);
  end loop;
  if v_essays=0 or jsonb_array_length(v_review)<>5 or
     exists(select 1 from jsonb_array_elements(v_review) item
       where item->>'earned_units' is null) then
    raise exception 'Incomplete automated scoring for pending attempt %',a.id;
  end if;
  select sum((item->>'earned_units')::int) into v_total
  from jsonb_array_elements(v_review) item;
  if v_total not between 0 and 10 then
   raise exception 'Invalid pending score %',a.id;
  end if;
  update private.buklod_bible_v4_attempts
  set review_items=v_review,
   review_note='Awtomatikong natapos ang pagmamarka gamit ang nakasaad na rubric.'
  where id=a.id;
  v_result:=private.buklod_bible_v4_finalize(a.id,v_total);
  if v_result->>'status'<>'completed' then
   raise exception 'Automatic finalization failed for attempt %',a.id;
  end if;
  insert into public.notifications(user_id,title,body,kind,data)
  select a.user_id,'Bible Quiz: awtomatikong resulta',
   'Nasuri na ang essay mo: '||v_total::text||'/10 units, +'||
    coalesce(v_result->>'points','0')||' BP. Buksan ang Bible Quiz para sa rubric feedback.',
   'bible_quiz_result',
   jsonb_build_object('attempt_id',a.id,'score_units',v_total,
     'points',coalesce((v_result->>'points')::int,0),'route','/faith/bible-quiz')
  where not exists(
   select 1 from public.notifications n
   where n.user_id=a.user_id and n.kind='bible_quiz_result'
    and n.data->>'attempt_id'=a.id::text);
 end loop;
end;
$auto_backfill$;
