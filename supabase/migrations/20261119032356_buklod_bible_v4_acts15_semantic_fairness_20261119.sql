-- BUKLOD Main Bible V4 Acts 15:28-29 score fairness, 2026-11-19.
-- Backwards compatible with legacy clients; no Season 2, Classroom Quiz or ad changes.
-- Exact screenshot response must earn 2/2; "Diyos-diyosan" alone earns 0.
-- Depends on verified live 20261118002500..20261118002900.

-- Refuse to overwrite a distinct future scoring implementation.
do $preflight$
declare s text;
begin
 s:=pg_get_functiondef('public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)'::regprocedure);
 if position('v_essay_feedback:=private.buklod_bible_v4_grade_essay' in s)=0
    or position('private.buklod_bible_v4_enum_parts' in s)=0 then
  raise exception 'Bible V4 scorer drift; reconcile before running correction';
 end if;
end;
$preflight$;


-- Versioned, private and deliberately question-specific semantic equivalence.
-- Does not use client text as executable code or general substring-only grading.
create or replace function private.buklod_bible_v4_acts15_matches(
 p_answer text,p_group_index integer,p_spec jsonb)
returns boolean language plpgsql immutable strict set search_path='' as $match$
declare
 s text;
 v_group jsonb;
begin
 if jsonb_typeof(p_spec->'groups')<>'array'
    or p_group_index<0 or p_group_index>=jsonb_array_length(p_spec->'groups') then
  return false;
 end if;
 s:=btrim(regexp_replace(
   regexp_replace(lower(p_answer),'[[:punct:]]+',' ','g'),
   '[[:space:]]+',' ','g'));
 if s='' then return false;end if;
 -- Explicitly reversed instructions do not count as the apostolic prohibitions.
 if s ~ '(^| )(hindi|di) (bawal|ipinagbawal|dapat umiwas|dapat iwasan)'
   or s ~ '(^| )huwag (umiwas|iwasan)( |$)'
   or s ~ '(^| )walang (pagbabawal|bawal)( |$)' then
  return false;
 end if;
 v_group:=p_spec->'groups'->p_group_index;
 -- Preserve reviewed aliases and split-field synonyms exactly as before.
 if exists(
  select 1 from private.buklod_bible_v4_enum_parts(p_answer) part(normalized)
  cross join jsonb_array_elements_text(v_group) alias(answer)
  where part.normalized=private.buklod_bible_v4_enum_normalize(alias.answer)
 ) then return true;end if;
 -- Count things to AVOID, not a loose occurrence of a word like "idols".
 if p_group_index=0 then
  return s ~ '(handog|hain|inialay|sakripisyo|sacrific|offer|kain|pagkain|pagkaing)'
    and s ~ '((diyos|diyus) (diyosan|diyusan)|idolo|idol)';
 elsif p_group_index=1 then
  return s ~ '(^| )(dugo|blood)( |$)';
 elsif p_group_index=2 then
  return s ~ '(^| )(binigti|biniti|strangled|sinakal)( |$)';
 elsif p_group_index=3 then
  return s ~ '(^| )(pakiki ?apid|makiki ?apid|pakikipag ?apid|pangangalunya|sexual immorality|sekswal na imoralidad)( |$)';
 end if;
 return false;
end;
$match$;
revoke all on function private.buklod_bible_v4_acts15_matches(text,integer,jsonb)
 from public,anon,authenticated;

create or replace function private.buklod_bible_v4_acts15_units(
 p_answers jsonb,p_spec jsonb)
returns integer language plpgsql immutable strict set search_path='' as $score$
declare
 group_index integer;
 matching integer:=0;
begin
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>2
    or jsonb_typeof(p_spec->'groups')<>'array' then return 0;end if;
 for group_index in 0..jsonb_array_length(p_spec->'groups')-1 loop
  if exists(
    select 1 from jsonb_array_elements_text(p_answers) answer(value)
    where private.buklod_bible_v4_acts15_matches(answer.value,group_index,p_spec)
  ) then matching:=matching+1;end if;
 end loop;
 return least(matching,2);
end;
$score$;
revoke all on function private.buklod_bible_v4_acts15_units(jsonb,jsonb)
 from public,anon,authenticated;

create or replace function public.submit_my_buklod_bible_quiz_v4(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); a record; q record; v_answer jsonb; v_group jsonb;
 expected text; answer_text text; units integer:=0; item_units integer;
 v_essay_feedback jsonb; results jsonb:='[]'::jsonb; review jsonb; out_result jsonb;
 count_items integer:=0;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then
  raise exception 'Five answers required';end if;
 select * into a from private.buklod_bible_v4_attempts where id=p_attempt_id and user_id=actor for update;
 if not found then raise exception 'Attempt unavailable';end if;
 if a.state<>'started' then return jsonb_build_object('status',a.state,'score_units',a.score_units,'points',a.points_awarded,'review',a.review_items,'notice',coalesce(a.review_note,''));end if;
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
  v_essay_feedback:=null;
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
   -- Acts 15 requires meaning-preserving Filipino/Taglish phrase recognition.
   -- Keep all other questions on the existing exact reviewed synonym policy.
   if q.id='v4_h_n03' then
    item_units:=private.buklod_bible_v4_acts15_units(v_answer,q.answer_spec);
   else
   for v_group in select value from jsonb_array_elements(q.answer_spec->'groups') loop
    if exists(select 1 from jsonb_array_elements_text(v_answer) va(answer)
      cross join lateral private.buklod_bible_v4_enum_parts(va.answer) candidate(normalized)
      join lateral jsonb_array_elements_text(v_group) accepted(answer)
        on candidate.normalized=private.buklod_bible_v4_enum_normalize(accepted.answer))
     then item_units:=item_units+1;end if;
   end loop;
   item_units:=least(item_units,2);
   end if;
  else
   if jsonb_typeof(v_answer)<>'string' or length(trim(p_answers->>q.id))<30 or length(p_answers->>q.id)>2400 then
    raise exception 'Essay requires a meaningful answer of 30–2400 characters';end if;
   v_essay_feedback:=private.buklod_bible_v4_grade_essay(q.id,p_answers->>q.id);
   item_units:=(v_essay_feedback->>'units')::integer;
  end if;
  units:=units+item_units;
  results:=results||jsonb_build_array(jsonb_build_object(
   'id',q.id,'kind',q.kind,'earned_units',item_units,
   'rubric_feedback',v_essay_feedback,'max_units',2,'reference',q.scripture_reference,'rationale',q.rationale,
   'correct_answer',case when q.kind='mcq' then to_jsonb(q.options->>q.correct_choice)
     when q.kind='essay' then null else q.answer_spec end));
 end loop;
 if count_items<>5 then raise exception 'Invalid frozen quiz';end if;
 update private.buklod_bible_v4_attempts
 set submitted_answers=p_answers,review_items=results,submitted_at=now(),
  state='started',
  review_note='Awtomatikong nasuri ayon sa nakasaad na rubric at requirements.'
 where id=a.id;
 out_result:=private.buklod_bible_v4_finalize(a.id,units);
 -- Result notification is best-effort; a push-service issue must not undo a
 -- completed quiz or duplicate BP. Review remains owner-visible in-app.
 begin
  insert into public.notifications(user_id,title,body,kind,data)
  values(actor,'Bible Quiz: awtomatikong resulta',
    'Final score: '||units::text||'/10 units; +'||
     coalesce(out_result->>'points','0')||' BP. Tingnan ang rubric feedback sa Bible Quiz.',
    'bible_quiz_result',
    jsonb_build_object('attempt_id',a.id,'score_units',units,
      'points',coalesce((out_result->>'points')::int,0),
      'route','/faith/bible-quiz'));
 exception when others then
  raise warning 'Optional quiz result notification failed: %',sqlstate;
 end;
 return out_result||jsonb_build_object('review',results,
  'notice','Awtomatikong natapos ang pagmamarka ayon sa rubric.');
end;
$$;
revoke all on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) to authenticated;

-- Reconcile only the saved Acts 15 question, never rewrite a submitted answer.
-- Completed attempts: adjust score and bounded BP delta with a unique ledger key.
-- Already-correct grades, unrelated questions and original ledger entries are untouched.
do $regrade$
declare
 a record; v_spec jsonb; v_old int; v_new int; v_review jsonb;
 v_score int; v_rule record; v_desired int; v_bonus int; v_inserted uuid;
begin
 select answer_spec into v_spec from private.buklod_bible_v4_questions
 where id='v4_h_n03' and kind='enumeration' and reviewed;
 if v_spec is null then raise exception 'Acts 15 reviewed answer bank missing';end if;
 for a in select * from private.buklod_bible_v4_attempts
  where state='completed' and submitted_answers ? 'v4_h_n03'
    and jsonb_typeof(submitted_answers->'v4_h_n03')='array'
  for update
 loop
  select (j->>'earned_units')::int into v_old
    from jsonb_array_elements(coalesce(a.review_items,'[]'::jsonb)) j
    where j->>'id'='v4_h_n03' and j->>'kind'='enumeration';
  if v_old is null or v_old not between 0 and 2 then continue;end if;
  v_new:=private.buklod_bible_v4_acts15_units(
    a.submitted_answers->'v4_h_n03',v_spec);
  if v_new<=v_old then continue;end if;
  if a.score_units is null or a.score_units not between 0 and 10 then
    raise exception 'Unexpected completed Bible V4 score';end if;
  select jsonb_agg(
    case when j.item->>'id'='v4_h_n03'
      then jsonb_set(j.item,'{earned_units}',to_jsonb(v_new))
      else j.item end order by j.ordinal)
  into v_review
  from jsonb_array_elements(a.review_items) with ordinality j(item,ordinal);
  v_score:=least(10,a.score_units+v_new-v_old);
  v_bonus:=0;v_inserted:=null;
  -- Honor the original daily ledger identity and existing maximum caps.
  if a.ledger_id is not null and exists(
    select 1 from public.buklod_points_ledger l
    where l.id=a.ledger_id and l.user_id=a.user_id
      and l.direction='credit' and l.points=a.points_awarded
      and l.activity_type='bible_quiz_'||a.difficulty
  ) then
   v_desired:=private.buklod_bible_v4_points(a.difficulty,v_score);
   select r.base_points,r.max_points_per_event,r.is_active into v_rule
    from public.buklod_point_rules r
    where r.activity_type='bible_quiz_'||a.difficulty;
   if not found or coalesce(v_rule.is_active,false)=false then
    v_desired:=0;
   else
    v_desired:=least(v_desired,v_rule.base_points,
      coalesce(v_rule.max_points_per_event,12),12);
   end if;
   v_bonus:=greatest(v_desired-coalesce(a.points_awarded,0),0);
   if v_bonus>0 then
    insert into public.buklod_points_ledger
      (user_id,direction,points,activity_type,source_key,description,awarded_by)
    values(a.user_id,'credit',v_bonus,'bible_quiz_'||a.difficulty,
      'bible_quiz:v4:acts15-grade-fix:20261119:'||a.id::text,
      'Verified Acts 15 Bible Quiz V4 answer recognition correction',a.user_id)
    on conflict (user_id,source_key) do nothing returning id into v_inserted;
    if v_inserted is null then v_bonus:=0;end if;
   end if;
  end if;
  update private.buklod_bible_v4_attempts
   set review_items=v_review,score_units=v_score,
       points_awarded=coalesce(a.points_awarded,0)+v_bonus
   where id=a.id;
  -- Notify only the owner, never disclose another member's response.
  insert into public.notifications(user_id,title,body,kind,data)
  values(a.user_id,'Bible Quiz: inayos ang iyong marka',
    'Naitama ang Mga Gawa 15:28–29 sa '||v_new||'/2. '||
      case when v_bonus>0 then '+'||v_bonus||' BP ang naidagdag.'
      else 'Walang dobleng BP na idinagdag.' end,
    'bible_quiz_result',
    jsonb_build_object('attempt_id',a.id,'question_id','v4_h_n03',
      'score_units',v_score,'correction_units',v_new-v_old,
      'points_added',v_bonus,'route','/faith/bible-quiz'));
 end loop;
end;
$regrade$;
