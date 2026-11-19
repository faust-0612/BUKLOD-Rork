-- Read-only regression. Run inside rollback-only preflight transaction
-- after the automated essay grading migration.
do $tests$
declare
 grade jsonb;
 scored record;
begin
 grade:=private.buklod_bible_v4_grade_essay('v4_h_x01',
   'Ang mga Hentil ay dapat tanggapin nang may pantay na paggalang. '||
   'Ang pagtutuli at Kautusan ay hindi dapat ipataw bilang hadlang sa biyaya ng Diyos. '||
   'Ang mga lider ngayon ay dapat makinig at maging makatarungan sa kanilang pasya.');
 if (grade->>'units')::int<>2 or (grade->>'criteria_matched')::int<3 or
    (grade->>'sentence_count')::int<>3 then
  raise exception 'Acts 15 auto-rubric failed: %',grade;end if;

 grade:=private.buklod_bible_v4_grade_essay('v4_h_x02',
   'Nagreklamo ang mga balo dahil napabayaan ang pamamahagi ng pagkain. '||
   'Nagtalaga ang mga apostol ng tagapangasiwa upang matiyak ang pagkain habang ipinagpatuloy ang panalangin at Salita ng Diyos. '||
   'Sa isang ministry maaari ring hatiin ang tungkulin para sa lahat.');
 if (grade->>'units')::int<>2 then raise exception 'Acts 6 rubric failed: %',grade;end if;

 grade:=private.buklod_bible_v4_grade_essay('v4_h_x03',
   'Hindi sapat ang kaalaman kung kulang sa malasakit sa mga kapatid na mahina ang budhi. '||
   'Dapat umiwas sa kilos na magtutulak sa kanila sa pagkatisod o pagkakasala. '||
   'Halimbawa pipiliin kong huwag kumain sa harap nila kung makasasama iyon sa kanilang pananampalataya.');
 if (grade->>'units')::int<>2 then raise exception '1 Corinthians 8 rubric failed: %',grade;end if;

 grade:=private.buklod_bible_v4_grade_essay('v4_h_x01',
   'Ito ay isang mahaba ngunit walang kaugnayan sa aralin. '||
   'Wala akong malinaw na nasabing dahilan o prinsipyo sa paksa. '||
   'Uulitin ko lamang ang mga pangungusap na ito nang walang katibayan.');
 if (grade->>'units')::int<>0 then raise exception 'Unrelated essay must score 0';end if;

 grade:=private.buklod_bible_v4_grade_essay('v4_h_x01',
   'Hentil. Kautusan biyaya at mga lider ang dapat tingnan sa usaping ito kahit mahaba ang nakasulat ngunit iisang pangungusap lang');
 if (grade->>'units')::int=2 then raise exception 'Incomplete essay must not score full points';end if;

 for scored in
  select a.id,q.id qid,private.buklod_bible_v4_grade_essay(q.id,a.submitted_answers->>q.id) grade
  from private.buklod_bible_v4_attempts a
  join private.buklod_bible_v4_questions q on q.id=any(a.question_keys) and q.kind='essay'
  where a.state='pending_review'
 loop
  if (scored.grade->>'units')::int not between 0 and 2 or
     jsonb_array_length(scored.grade->'criteria')<>4 then
   raise exception 'Pending essay cannot be auto-scored: %',scored.id;end if;
 end loop;

 if pg_catalog.has_function_privilege('authenticated',
   'public.admin_review_buklod_bible_v4_essay(uuid,integer,text)','EXECUTE') or
    pg_catalog.has_function_privilege('authenticated',
   'public.admin_list_buklod_bible_v4_pending()','EXECUTE') then
  raise exception 'Manual review RPC remains exposed';
 end if;
end;
$tests$;
