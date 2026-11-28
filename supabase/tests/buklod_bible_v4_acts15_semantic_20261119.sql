-- Acts 15:28-29 Bible V4 semantic fairness; no member mutations.
-- Run after migration 20261119032356.
do $tests$
declare
 spec jsonb; t record; got integer; n integer:=0; stale integer;
begin
 select answer_spec into spec from private.buklod_bible_v4_questions
 where id='v4_h_n03' and reviewed and kind='enumeration';
 if spec is null then raise exception 'Acts 15 reviewed bank missing';end if;
 for t in select * from (values
  (jsonb_build_array('Huwag kakain ng inihandog sa mga diyus-diyosan','Huwag makiki-apid'),2),
  (jsonb_build_array('Huwag kumain ng handog sa diyos diyusan.','Huwag makikiapid'),2),
  (jsonb_build_array('Mga bagay na inihandog sa mga diyos-diyosan (pagkaing isinakripisyo sa mga idolo)','Pakiki-apid'),2),
  (jsonb_build_array('Umiwas sa pagkaing inihandog sa mga diyus diyosan at may dugo','Umiwas sa hayop na binigti at sa sekswal na imoralidad'),2),
  (jsonb_build_array('Diyos-diyosan','Pakikiapid'),1),
  (jsonb_build_array('Hindi ipinagbawal ang pakikiapid','Hindi bawal kumain sa diyos diyosan'),0),
  (jsonb_build_array('Huwag umiwas sa pakikiapid','Walang pagbabawal sa dugo'),0),
  (jsonb_build_array('pagkaing inihain sa mga diyos diyosan','pakikiapid'),2),
  (jsonb_build_array('pakikiapid','pakikiapid'),1),
  (jsonb_build_array('walang kinalaman','hindi alam'),0)
 ) c(answers,want) loop
  got:=private.buklod_bible_v4_acts15_units(t.answers,spec);
  if got<>t.want then
    raise exception 'Acts 15 case failed: % got % wanted %',t.answers,got,t.want;
  end if;
  n:=n+1;
 end loop;
 if n<>10 then raise exception 'Acts 15 cases incomplete';end if;
 if has_function_privilege('anon','private.buklod_bible_v4_acts15_units(jsonb,jsonb)','EXECUTE')
    or has_function_privilege('authenticated','private.buklod_bible_v4_acts15_units(jsonb,jsonb)','EXECUTE')
 then raise exception 'Private matching helper privilege leak';end if;
 if has_function_privilege('anon','public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)','EXECUTE')=true
    or has_function_privilege('authenticated','public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)','EXECUTE')=false
 then raise exception 'Submission RPC permissions regressed';end if;
 select count(*) into stale
 from private.buklod_bible_v4_attempts a
 cross join lateral jsonb_array_elements(a.review_items) j
 where a.state='completed' and j->>'id'='v4_h_n03'
   and (j->>'earned_units')::integer < private.buklod_bible_v4_acts15_units(
     a.submitted_answers->'v4_h_n03',spec);
 if stale<>0 then raise exception '% historical Acts 15 grades need reconciliation',stale;end if;
end;
$tests$;
