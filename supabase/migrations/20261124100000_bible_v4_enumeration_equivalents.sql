-- DEV-only pending migration: no live MAIN mutation.
-- Preserve authenticated server-side scoring, row locking, and finalization.
-- Expand exact, curated semantic equivalents without unbounded AI guessing.
update private.buklod_bible_v4_questions
set answer_spec=jsonb_set(answer_spec,'{groups,0}',
  (answer_spec->'groups'->0) || '["nilagyan ng benda ang sugat","nilagyan ng benda ang mga sugat","binendahan ang sugat","binalutan ng benda ang sugat","bandaged the wound","dressed the wounds"]'::jsonb)
where id='v4_m_n01' and kind='enumeration'
  and not ((answer_spec->'groups'->0) ? 'nilagyan ng benda ang sugat');

create or replace function public.submit_my_buklod_bible_quiz_v4(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); a record; q record; v_answer jsonb; v_group jsonb;
 expected text; answer_text text; units integer:=0; item_units integer;
 pending boolean:=false; results jsonb:='[]'::jsonb; review jsonb; out_result jsonb;
 count_items integer:=0;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then
  raise exception 'Five answers required';end if;
 select * into a from private.buklod_bible_v4_attempts where id=p_attempt_id and user_id=actor for update;
 if not found then raise exception 'Attempt unavailable';end if;
 if a.state<>'started' then return jsonb_build_object('status',a.state,'score_units',a.score_units,'points',a.points_awarded);end if;
 if a.local_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'Daily quiz expired';end if;
 if coalesce(array_length(a.question_keys,1),0)<>5 then raise exception 'Invalid frozen questions';end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>5 then raise exception 'Exactly five answers required';end if;
 for q in select * from private.buklod_bible_v4_questions x
  where x.id=any(a.question_keys) order by array_position(a.question_keys,x.id)
 loop
  count_items:=count_items+1;
  if not(p_answers ? q.id) then raise exception 'Missing answer';end if;
  v_answer:=p_answers->q.id;
  item_units:=0;
  if q.kind='mcq' then
   if jsonb_typeof(v_answer)<>'string' then raise exception 'Invalid MCQ answer';end if;
   answer_text:=upper(trim(p_answers->>q.id));
   if answer_text not in ('A','B','C','D') then raise exception 'Invalid MCQ option';end if;
   if answer_text=q.correct_choice then item_units:=2;end if;
  elsif q.kind='identification' then
   if jsonb_typeof(v_answer)<>'string' then raise exception 'Invalid identification answer';end if;
   answer_text:=lower(trim(regexp_replace(p_answers->>q.id,'[[:punct:]]','','g')));
   if length(answer_text)<1 or length(answer_text)>120 then raise exception 'Identification answer length invalid';end if;
   if exists(select 1 from jsonb_array_elements_text(q.answer_spec->'answers') z(value)
    where lower(trim(regexp_replace(z.value,'[[:punct:]]','','g')))=answer_text) then item_units:=2;end if;
  elsif q.kind='enumeration' then
   if jsonb_typeof(v_answer)<>'array' or jsonb_array_length(v_answer)<>2 then
    raise exception 'Enter two enumeration answers';end if;
   if exists(select 1 from jsonb_array_elements(v_answer) x where jsonb_typeof(x.value)<>'string'
     or length(x.value #>> '{}')>120) then raise exception 'Invalid enumeration item';end if;
   if lower(trim(regexp_replace(regexp_replace(v_answer->>0,'[[:punct:]]',' ','g'),'[[:space:]]+',' ','g'))) =
      lower(trim(regexp_replace(regexp_replace(v_answer->>1,'[[:punct:]]',' ','g'),'[[:space:]]+',' ','g'))) then
     raise exception 'Two distinct enumeration answers are required';
   end if;
   for v_group in select value from jsonb_array_elements(q.answer_spec->'groups') loop
    if exists(select 1 from jsonb_array_elements_text(v_answer) va(answer)
      join lateral jsonb_array_elements_text(v_group) accepted(answer) on true
      where lower(trim(regexp_replace(regexp_replace(va.answer,'[[:punct:]]',' ','g'),'[[:space:]]+',' ','g')))=
            lower(trim(regexp_replace(regexp_replace(accepted.answer,'[[:punct:]]',' ','g'),'[[:space:]]+',' ','g')))) then item_units:=item_units+1;end if;
   end loop;
   item_units:=least(item_units,2);
  else
   if jsonb_typeof(v_answer)<>'string' or length(trim(p_answers->>q.id))<30 or length(p_answers->>q.id)>2400 then
    raise exception 'Essay requires a meaningful answer of 30–2400 characters';end if;
   pending:=true;
  end if;
  if q.kind<>'essay' then units:=units+item_units;end if;
  results:=results||jsonb_build_array(jsonb_build_object(
   'id',q.id,'kind',q.kind,'earned_units',case when q.kind='essay' then null else item_units end,
   'max_units',2,'reference',q.scripture_reference,'rationale',q.rationale,
   'correct_answer',case when q.kind='mcq' then to_jsonb(q.options->>q.correct_choice)
     when q.kind='essay' then null else q.answer_spec end));
 end loop;
 if count_items<>5 then raise exception 'Invalid frozen quiz';end if;
 update private.buklod_bible_v4_attempts
 set submitted_answers=p_answers,review_items=results,submitted_at=now(),
  state=case when pending then 'pending_review' else 'started' end
 where id=a.id;
 if pending then
  return jsonb_build_object('status','pending_review','score_units',units,
   'points',0,'review',results,'notice','Essay requires human rubric review before BP is finalized');
 end if;
 out_result:=private.buklod_bible_v4_finalize(a.id,units);
 return out_result||jsonb_build_object('review',results);
end;
$$;

revoke all on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) to authenticated;
