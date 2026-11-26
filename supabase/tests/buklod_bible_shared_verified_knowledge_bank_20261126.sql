-- Post-migration verification: each approved literal is recognized in the intended
-- concept, never another concept. Read-only; test repeat migration separately.
do $test$
declare p record; src record; dst record;
begin
 for p in select * from (values
  ('v4_h_n02','v4_m_n02',0,'Mga Gawa 17:11','eager reception','open minded'),
  ('v4_h_n02','v4_m_n02',0,'Mga Gawa 17:11','eager reception','open mindedness'),
  ('v4_h_n02','v4_m_n02',0,'Mga Gawa 17:11','eager reception','eagerly received the message'),
  ('v4_h_n02','v4_m_n02',1,'Mga Gawa 17:11','searching scripture','daily study of scripture'),
  ('v4_h_n02','v4_m_n02',1,'Mga Gawa 17:11','searching scripture','search the scriptures daily'),
  ('v4_m_n01','v4_h_n07',0,'Lucas 10:34–35','bandaged wounds','bandaged the wounds'),
  ('v4_m_n01','v4_h_n07',0,'Lucas 10:34–35','bandaged wounds','bandaged the wound'),
  ('v4_m_n01','v4_h_n07',0,'Lucas 10:34–35','bandaged wounds','nilagyan ng benda ang mga sugat'),
  ('v4_m_n01','v4_h_n07',1,'Lucas 10:34–35','brought to an inn','brought him to an inn'),
  ('v4_h_n07','v4_m_n01',3,'Lucas 10:34–35','poured oil and wine','nilagyan niya ng langis at alak ang mga sugat ng lalaki')
 ) v(source_id,target_id,group_index,reference,anchor,alias)
 loop
 select * into src from private.buklod_bible_v4_questions where id=p.source_id;
 select * into dst from private.buklod_bible_v4_questions where id=p.target_id;
 if src.id is null or dst.id is null or src.scripture_reference is distinct from p.reference or dst.scripture_reference is distinct from p.reference
 or not coalesce((src.answer_spec->'groups'->p.group_index) ? p.alias,false)
 or not exists(select 1 from jsonb_array_elements_text(dst.answer_spec->'groups'->p.group_index) z(a) where private.buklod_bible_v4_enum_normalize(z.a)=private.buklod_bible_v4_enum_normalize(p.alias))
 then raise exception 'Missing reviewed alias: % / %',p.target_id,p.alias;end if;
 if exists(select 1 from jsonb_array_elements(dst.answer_spec->'groups') with ordinality g(v,n)
 cross join lateral jsonb_array_elements_text(g.v) z(a) where n<>p.group_index+1 and private.buklod_bible_v4_enum_normalize(z.a)=private.buklod_bible_v4_enum_normalize(p.alias))
 then raise exception 'Alias crosses distinct groups: %',p.target_id;end if;
 end loop;
 if has_table_privilege('anon','private.buklod_bible_v4_questions','SELECT') or has_table_privilege('authenticated','private.buklod_bible_v4_questions','SELECT')
 then raise exception 'Answer bank exposure';end if;
end;
$test$;
