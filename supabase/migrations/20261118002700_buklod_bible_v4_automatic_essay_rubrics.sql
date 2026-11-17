-- Bible Quiz V4: automatic, transparent, server-only essay assessment.
-- Deployed only after 20261118002500 and 20261118002600.
update private.buklod_bible_v4_questions
set answer_spec=(answer_spec - 'manual_review') || jsonb_build_object('auto_rubric', '{"version":1,"min_chars":80,"min_sentences":3,"max_sentences":5,"criteria":[{"id":"gentiles","label":"Pagtanggap sa mga Hentil","patterns":["hentil","gentil","non.?jew","hindi.{0,12}hudyo"]},{"id":"law","label":"Kundisyon, Kautusan, o hadlang sa pagtanggap","patterns":["kundis","kondis","tuli","kautusan","batas","kultur","tradisyon","pasanin","diskrimin"]},{"id":"grace","label":"Biyaya, pananampalataya, o makatarungang pagtanggap","patterns":["biyaya","pananampalataya","patas","makatarungan","pagkakaisa","pagmamahal","malasakit","pagkakapantay"]},{"id":"leadership","label":"Pananagutan o tamang kilos ng mga lider ngayon","patterns":["lider","pinuno","namumuno","responsib","pananagutan","makinig","gumagabay","gabay","pagpapasya"]}]}'::jsonb)
where id='v4_h_x01' and kind='essay' and reviewed;
update private.buklod_bible_v4_questions
set answer_spec=(answer_spec - 'manual_review') || jsonb_build_object('auto_rubric', '{"version":1,"min_chars":80,"min_sentences":2,"max_sentences":0,"criteria":[{"id":"need","label":"Pangangailangan ng mga napapabayaan at paglilingkod","patterns":["balo","reklamo","pagkain","pangangailangan","panganga.ilangan","pamamahagi","rasyon","mapaglingkuran","paglingkod","napapabayaan","pabayaan","praktikal"]},{"id":"delegate","label":"Pagtatalaga at paghahati ng tungkulin","patterns":["tagapangasiwa","taga.?pangasiwa","nagtalaga","pagtatalaga","naglagay","hinati","hinahati","paghahati","tungkulin","deleg"]},{"id":"word","label":"Panalangin, pagtuturo, o Salita ng Diyos","patterns":["panalangin","nanalangin","pagtuturo","nagtuturo","salita","pangangaral","pagngangaral","ministeryo","apostol"]},{"id":"application","label":"Paglalapat sa isang grupo o organisasyon","patterns":["grupo","ministry","simbahan","samahan","organisasyon","halimbawa","miyembro","myembro","bawat isa","kanya.?kanya","lider"]}]}'::jsonb)
where id='v4_h_x02' and kind='essay' and reviewed;
update private.buklod_bible_v4_questions
set answer_spec=(answer_spec - 'manual_review') || jsonb_build_object('auto_rubric', '{"version":1,"min_chars":80,"min_sentences":2,"max_sentences":0,"criteria":[{"id":"knowledge_love","label":"Kaalaman at pagmamahal o malasakit","patterns":["kaalaman","knowledge","tama ang sarili","sariling kaalaman","malasakit","pagmamahal","konsiderasyon","pag.?ibig","mararamdaman"]},{"id":"weak_conscience","label":"Mahinang budhi o kalagayan ng kapatid","patterns":["mahina","budhi","konsens","pananampalataya","kapatid","damdamin","conscience"]},{"id":"stumble","label":"Pag-iwas sa pagkatisod o pananakit sa iba","patterns":["tisod","madapa","kasalanan","magkasala","masaktan","ikapahamak","makapahamak","panganib","umiwas","iiwas","maitulak","pagkadapa","manghina"]},{"id":"application","label":"Kongkretong halimbawa ng maingat na kalayaan","patterns":["halimbawa","pagkain","kumakain","kain","pipili","piliin","kung","kalayaan","malaya","paggawa","gawin"]}]}'::jsonb)
where id='v4_h_x03' and kind='essay' and reviewed;

-- Rubrics are deterministic and question-specific. No essay or answer key is sent
-- to an outside service. Results are final at submission and explain each criterion.
create or replace function private.buklod_bible_v4_grade_essay(p_question_id text,p_answer text)
returns jsonb language plpgsql stable security invoker set search_path='' as $grade$
declare
 rubric jsonb; criterion jsonb; pattern text;
 criteria_result jsonb:='[]'::jsonb;
 normalized_answer text:=pg_catalog.lower(coalesce(p_answer,''));
 question_count int:=0; matched_count int:=0;
 sentence_count int; char_count int;
 needs_min int; needs_sentences int; max_sentences int;
 hit boolean; requirements_met boolean; units int;
begin
 select q.answer_spec->'auto_rubric' into rubric
 from private.buklod_bible_v4_questions q
 where q.id=p_question_id and q.kind='essay' and q.reviewed;
 if rubric is null or rubric->>'version'<>'1' or
    jsonb_typeof(rubric->'criteria')<>'array' then
  raise exception 'Essay rubric is unavailable; no score or BP was changed';
 end if;
 char_count:=pg_catalog.char_length(pg_catalog.btrim(coalesce(p_answer,'')));
 if char_count<30 or char_count>2400 then
  raise exception 'Essay length must be 30–2400 characters';
 end if;
 -- Count sentence boundaries between text segments; a trailing period does
 -- not create an extra empty sentence. The count is visible to the learner.
 sentence_count:=1+(
  select pg_catalog.count(*)::int
  from pg_catalog.regexp_matches(
    pg_catalog.regexp_replace(normalized_answer,'[.!?]+[[:space:]]*$','','g'),
    '[.!?]+[[:space:]]+','g')
 );
 needs_min:=(rubric->>'min_chars')::int;
 needs_sentences:=(rubric->>'min_sentences')::int;
 max_sentences:=(rubric->>'max_sentences')::int;
 if needs_min is null or needs_sentences is null or max_sentences is null then
  raise exception 'Essay rubric requirement missing';
 end if;
 for criterion in select value from jsonb_array_elements(rubric->'criteria') loop
  question_count:=question_count+1; hit:=false;
  for pattern in select value from jsonb_array_elements_text(criterion->'patterns') loop
   if normalized_answer ~* pattern then hit:=true;exit;end if;
  end loop;
  if hit then matched_count:=matched_count+1;end if;
  criteria_result:=criteria_result||jsonb_build_array(
   jsonb_build_object('id',criterion->>'id','label',criterion->>'label','met',hit));
 end loop;
 if question_count<3 or question_count>6 then raise exception 'Incomplete essay rubric';end if;
 requirements_met:=char_count>=needs_min and sentence_count>=needs_sentences and
  (max_sentences=0 or sentence_count<=max_sentences);
 units:=case
  when requirements_met and matched_count>=3 then 2
  when char_count>=30 and sentence_count>=2 and matched_count>=2 then 1
  else 0 end;
 return jsonb_build_object(
  'version',1,'units',units,'criteria_matched',matched_count,
  'criteria_total',question_count,'criteria',criteria_result,
  'requirements_met',requirements_met,
  'min_chars',needs_min,'min_sentences',needs_sentences,
  'max_sentences',max_sentences,'character_count',char_count,
  'sentence_count',sentence_count,
  'message',case
    when units=2 then 'Awtomatikong pumasa sa mga kinakailangang bahagi ng rubric.'
    when units=1 then 'Bahagyang tumugon sa rubric. Tingnan ang mga bahaging kulang.'
    else 'Hindi naabot ang sapat na pamantayan. Tingnan ang mga kinakailangan at kulang na bahagi.'
   end
 );
end;
$grade$;
revoke all on function private.buklod_bible_v4_grade_essay(text,text)
from public,anon,authenticated;

create or replace function public.get_my_buklod_bible_quiz_v4(p_difficulty text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); local_day date:=(now() at time zone 'Asia/Manila')::date;
 choice text:=lower(trim(coalesce(p_difficulty,''))); a record; question_data jsonb;
 kinds text[]; skills text[]; selected text[]:='{}'; slot int; selected_id text;
begin
 if actor is null then raise exception 'Authentication required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bible-v4:'||actor::text||':'||local_day::text,0));
 select * into a from private.buklod_bible_v4_attempts
 where user_id=actor and local_date=local_day;
 if not found and exists(select 1 from private.buklod_r2_bible_quiz_attempts
   where user_id=actor and local_date=local_day) then
  return jsonb_build_object('legacy_attempt',true,'date',local_day);
 end if;
 if not found and choice not in ('easy','medium','hard') then
  return jsonb_build_object('selection_required',true,'date',local_day);
 end if;
 if not found then
  if choice='easy' then
   kinds:=array['mcq','mcq','mcq','mcq','identification'];
   skills:=array['','','','',''];
  elsif choice='medium' then
   kinds:=array['mcq','mcq','mcq','identification','enumeration'];
   skills:=array['','','','',''];
  else
   kinds:=array['mcq','mcq','mcq','enumeration',
     case when extract(isodow from local_day)::integer in (2,6) then 'essay' else 'mcq' end];
   skills:=array['situation','analysis','comparison','',''];
  end if;
  for slot in 1..5 loop
   select q.id into selected_id
   from private.buklod_bible_v4_questions q
   where q.active and q.reviewed and q.difficulty=choice
    and q.kind=kinds[slot] and (skills[slot]='' or q.skill=skills[slot])
    and not(q.id=any(selected))
    and not exists(select 1 from private.buklod_bible_v4_questions seen
      where seen.id=any(selected) and seen.concept_key=q.concept_key)
   order by
     coalesce((select max(x.created_at) from private.buklod_bible_v4_attempts x
       where x.user_id=actor and q.id=any(x.question_keys)),
       '-infinity'::timestamptz) asc,
     md5(q.id||actor::text||local_day::text)
   limit 1;
   -- Fail closed if a required format is missing: no random easy trivia in Hard.
   if selected_id is null then raise exception 'Reviewed Bible Quiz bank needs more % questions for %',kinds[slot],choice;end if;
   selected:=array_append(selected,selected_id);
  end loop;
  insert into private.buklod_bible_v4_attempts(user_id,local_date,difficulty,question_keys)
  values(actor,local_day,choice,selected)
  on conflict(user_id,local_date) do nothing;
  select * into a from private.buklod_bible_v4_attempts where user_id=actor and local_date=local_day;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',q.id,'kind',q.kind,'skill',q.skill,'question',q.prompt,
  'options',case when q.kind='mcq' then q.options else null end,
  'reference',q.scripture_reference,
  'rubric_guidance',case when q.kind='essay' then
    jsonb_build_object(
      'min_chars',(q.answer_spec#>>'{auto_rubric,min_chars}')::int,
      'min_sentences',(q.answer_spec#>>'{auto_rubric,min_sentences}')::int,
      'max_sentences',(q.answer_spec#>>'{auto_rubric,max_sentences}')::int,
      'criteria',(select coalesce(jsonb_agg(c.value->>'label'),'[]'::jsonb)
        from jsonb_array_elements(coalesce(q.answer_spec#>'{auto_rubric,criteria}','[]'::jsonb)) c(value)))
    else null end)
  order by array_position(a.question_keys,q.id)),'[]'::jsonb)
 into question_data
 from private.buklod_bible_v4_questions q where q.id=any(a.question_keys);
 return jsonb_build_object('date',a.local_date,'attempt_id',a.id,'difficulty',a.difficulty,
  'state',a.state,'completed',a.state='completed','score_units',a.score_units,
  'awarded_points',a.points_awarded,'questions',
  case when a.state='started' then question_data else '[]'::jsonb end,
  'review',case when a.state='started' then null else a.review_items end,
  'review_note',a.review_note);
end;
$$;
revoke all on function public.get_my_buklod_bible_quiz_v4(text) from public,anon;
grant execute on function public.get_my_buklod_bible_quiz_v4(text) to authenticated;
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

-- Administrative manual grading is retired. Old records are not deleted.
revoke all on function public.admin_review_buklod_bible_v4_essay(uuid,integer,text) from public,anon,authenticated;
revoke all on function public.admin_list_buklod_bible_v4_pending() from public,anon,authenticated;
