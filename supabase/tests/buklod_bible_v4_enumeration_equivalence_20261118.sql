-- Run AFTER 20261118002500 migration. Read-only assertions.
-- Failing assertion aborts the test; no member data or points are altered.
do $regression$
declare
 v_spec jsonb;
 sample record;
 matched integer;
begin
 select answer_spec into v_spec
 from private.buklod_bible_v4_questions where id='v4_h_n05';
 if v_spec is null then raise exception 'Nehemiah reviewed answer bank missing';end if;
 for sample in
  select * from (values
   (jsonb_build_array('Mga lupa ', 'Mga bahay'),2),
   (jsonb_build_array('Bukirin at ubasan','Taniman ng olibo at tahanan'),2),
   (jsonb_build_array('LUPA!', 'BAHAY.'),2),
   (jsonb_build_array('BUKIRIN AT UBASAN', 'TANIMAN NG OLIBO AT TAHANAN'),2),
   (jsonb_build_array('Salapi', 'Bukirin'),1),
   (jsonb_build_array('Hindi lupa','Hindi bahay'),0),
   (jsonb_build_array('lupa','mga lupa'),1)
  ) as cases(answers,want_units)
 loop
  select count(*) into matched
  from jsonb_array_elements(v_spec->'groups') g(accepted_group)
  where exists (
   select 1
   from jsonb_array_elements_text(sample.answers) a(answer)
   cross join lateral private.buklod_bible_v4_enum_parts(a.answer) candidate(normalized)
   join lateral jsonb_array_elements_text(g.accepted_group) synonym(accepted)
    on candidate.normalized=private.buklod_bible_v4_enum_normalize(synonym.accepted)
  );
  if least(matched,2)<>sample.want_units then
   raise exception 'Enumeration mismatch: %, expected %, observed %',
     sample.answers,sample.want_units,least(matched,2);
  end if;
 end loop;
 if private.buklod_bible_v4_enum_normalize('lupa')
    <>private.buklod_bible_v4_enum_normalize('Mga lupa')
 then raise exception 'Plural marker normalization failed';end if;
 if private.buklod_bible_v4_enum_normalize('Baháy')
    =private.buklod_bible_v4_enum_normalize('bahay')
 then raise exception 'Unexpected accent folding';end if;
end;
$regression$;
