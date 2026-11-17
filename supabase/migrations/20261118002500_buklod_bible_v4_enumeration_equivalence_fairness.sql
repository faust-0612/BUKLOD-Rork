-- Bible V4 short-answer fairness fix. Only reviewed equivalences earn score.
-- No client-side grading, no new public API, no historic ledger mutation.
create or replace function private.buklod_bible_v4_enum_normalize(p_value text)
returns text language sql immutable strict set search_path='' as $$
 select regexp_replace(
   regexp_replace(
     btrim(regexp_replace(lower(p_value),'[[:punct:]]+',' ','g')),
     '^(mga|ang)[[:space:]]+','','g'),
   '[[:space:]]+',' ','g');
$$;
revoke all on function private.buklod_bible_v4_enum_normalize(text)
 from public,anon,authenticated;

-- Preserve the complete answer (e.g. "gumamit ng langis at alak"),
-- but also allow multiple clearly separated correct terms in one field.
create or replace function private.buklod_bible_v4_enum_parts(p_value text)
returns setof text language sql immutable strict set search_path='' as $$
 select distinct private.buklod_bible_v4_enum_normalize(piece)
 from (
   select p_value as piece
   union all
   select regexp_split_to_table(p_value,'[[:space:]]+(at|and)[[:space:]]+|[,;/]') as piece
 ) parts
 where private.buklod_bible_v4_enum_normalize(piece)<>'';
$$;
revoke all on function private.buklod_bible_v4_enum_parts(text)
 from public,anon,authenticated;

-- Passage-accurate Filipino equivalents for Nehemiah 5:11; append only
-- missing aliases, preserving any existing bank revisions.
update private.buklod_bible_v4_questions
set answer_spec=jsonb_set(answer_spec,'{groups,2}',
  (answer_spec#>'{groups,2}') || '["taniman ng olibo"]'::jsonb)
where id='v4_h_n05'
  and not ((answer_spec#>'{groups,2}') @> '["taniman ng olibo"]'::jsonb);
update private.buklod_bible_v4_questions
set answer_spec=jsonb_set(answer_spec,'{groups,3}',
  (answer_spec#>'{groups,3}') || '["tahanan"]'::jsonb)
where id='v4_h_n05'
  and not ((answer_spec#>'{groups,3}') @> '["tahanan"]'::jsonb);

-- Preserve owner-scoped attempts, essay review, capped points and existing
-- server-authoritative source-key idempotency; only enumeration matching changes.

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
   if private.buklod_bible_v4_enum_normalize(v_answer->>0) =
      private.buklod_bible_v4_enum_normalize(v_answer->>1) then
     raise exception 'Two distinct enumeration answers are required';
   end if;
   for v_group in select value from jsonb_array_elements(q.answer_spec->'groups') loop
    if exists(select 1 from jsonb_array_elements_text(v_answer) va(answer)
      cross join lateral private.buklod_bible_v4_enum_parts(va.answer) candidate(normalized)
      join lateral jsonb_array_elements_text(v_group) accepted(answer)
        on candidate.normalized=private.buklod_bible_v4_enum_normalize(accepted.answer))
     then item_units:=item_units+1;end if;
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
