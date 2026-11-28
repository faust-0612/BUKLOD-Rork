-- Run after 20261118002900. Read-only acceptance tests for automatic
-- essay evaluation; reject keyword farming without rejecting valid narratives.
do $tests$
declare
 s int; affected int; preserved int;
begin
 select (private.buklod_bible_v4_grade_essay('v4_h_x01',
  'Hentil tuli biyaya lider. Hentil tuli biyaya lider. Hentil tuli biyaya lider. Hentil tuli biyaya lider.')->>'units')::int into s;
 if s<>0 then raise exception 'Keyword-only farming earned % units',s;end if;
 select (private.buklod_bible_v4_grade_essay('v4_h_x02',
  'Balo pagkain tagapangasiwa panalangin grupo. Balo pagkain tagapangasiwa panalangin grupo. Balo pagkain tagapangasiwa panalangin grupo.')->>'units')::int into s;
 if s<>0 then raise exception 'Repeated-sentence farming earned % units',s;end if;
 select count(*),
  count(*) filter(where (private.buklod_bible_v4_grade_essay(q.id,a.submitted_answers->>q.id)->>'units')::integer=2)
 into affected,preserved
 from private.buklod_bible_v4_attempts a
 join private.buklod_bible_v4_questions q on q.id=any(a.question_keys) and q.kind='essay'
 where a.review_note ilike 'Awtomatikong%';
 if affected>0 and preserved<>affected then
  raise exception 'Legitimate finalized essays regressed: % of %',preserved,affected;
 end if;
 if has_function_privilege('authenticated','private.buklod_bible_v4_grade_essay(text,text)','EXECUTE')
 or has_function_privilege('anon','private.buklod_bible_v4_grade_essay(text,text)','EXECUTE')
 then raise exception 'Private rubric grader is publicly executable';end if;
end;
$tests$;