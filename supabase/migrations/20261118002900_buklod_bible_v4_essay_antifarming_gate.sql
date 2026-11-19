-- Bible Quiz V4 anti-farming: protect rubric points from keyword-only,
-- repetitive and low-substance submissions. No prior award mutations.
create or replace function private.buklod_bible_v4_grade_essay(p_question_id text,p_answer text)
returns jsonb language plpgsql stable security invoker set search_path='' as $grade$
declare
 rubric jsonb; criterion jsonb; pattern text;
 criteria_result jsonb:='[]'::jsonb;
 normalized_answer text:=pg_catalog.lower(coalesce(p_answer,''));
 question_count int:=0; matched_count int:=0;
 sentence_count int; char_count int;
 distinct_words int; substantive_sentences int; reasoning_signal boolean;
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
 -- Anti-farming: prevent repeated keyword or template answer credit.
 select count(distinct word) into distinct_words
 from regexp_split_to_table(normalized_answer,'[^[:alpha:]]+') word
 where char_length(word)>=3;
 select count(distinct btrim(sentence)) into substantive_sentences
 from regexp_split_to_table(
  regexp_replace(normalized_answer,'[.!?]+[[:space:]]*$','','g'),
  '[.!?]+[[:space:]]+') sentence
 where char_length(btrim(sentence))>=35;
 reasoning_signal:=normalized_answer ~* '(dahil|kaya|upang|para|habang|ngunit|sapagkat|because|while|therefore|halimbawa|kung|nang sa)';
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
  (max_sentences=0 or sentence_count<=max_sentences) and
  distinct_words>=16 and substantive_sentences>=needs_sentences and reasoning_signal;
 units:=case
  when requirements_met and matched_count>=3 then 2
  when char_count>=30 and sentence_count>=2 and matched_count>=2
   and distinct_words>=10 and substantive_sentences>=2 and reasoning_signal then 1
  else 0 end;
 return jsonb_build_object(
  'version',1,'units',units,'criteria_matched',matched_count,
  'criteria_total',question_count,'criteria',criteria_result,
  'requirements_met',requirements_met,
  'min_chars',needs_min,'min_sentences',needs_sentences,
  'max_sentences',max_sentences,'character_count',char_count,
  'sentence_count',sentence_count,
  'distinct_content_words',distinct_words,
  'substantive_sentences',substantive_sentences,
  'reasoning_present',reasoning_signal,
  'requires_distinct_content_words',16,
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
