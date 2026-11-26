-- Read-only regression contract for migration 20261126055353.
do $test$
declare q record; c record; n int;
begin
 for q in select id,answer_spec from private.buklod_bible_v4_questions where id in ('v4_h_n02','v4_m_n02') loop
  for c in select * from (values
   ('reported','["readiness of mind","Searching scripture"]'::jsonb,2),
   ('reversed','["Searching scripture","readiness of mind"]'::jsonb,2),
   ('canonical','["eager reception","daily examination of scriptures"]'::jsonb,2),
   ('unrelated','["praying","singing"]'::jsonb,0),
   ('same concept','["readiness of mind","bukas ang isipan"]'::jsonb,1),
   ('negative','["not readiness of mind","not searching scripture"]'::jsonb,0),
   ('partial','["readiness of mind","praying"]'::jsonb,1)
  ) v(label,answers,expected) loop
   select count(*) into n from jsonb_array_elements(q.answer_spec->'groups') g where exists(
    select 1 from jsonb_array_elements_text(c.answers) va(answer)
    cross join lateral private.buklod_bible_v4_enum_parts(va.answer) candidate(normalized)
    join lateral jsonb_array_elements_text(g.value) accepted(answer)
     on candidate.normalized=private.buklod_bible_v4_enum_normalize(accepted.answer));
   if n<>c.expected then raise exception 'Berea regression: % % expected % got %',q.id,c.label,c.expected,n;end if;
  end loop;
 end loop;
 if (select count(*) from private.buklod_bible_v4_questions where id in ('v4_h_n02','v4_m_n02'))<>2 then raise exception 'Berea questions missing';end if;
 if has_function_privilege('anon','public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)','EXECUTE') or not has_function_privilege('authenticated','public.submit_my_buklod_bible_quiz_v4(uuid,jsonb)','EXECUTE') or has_table_privilege('authenticated','private.buklod_bible_v4_questions','SELECT') then raise exception 'Quiz access regression';end if;
 if exists(select 1 from public.buklod_points_ledger where source_key like 'bible_quiz:v4:alias-grade-fix:20261126:%' group by user_id,source_key having count(*)>1) then raise exception 'Duplicate correction credit';end if;
end;
$test$;
