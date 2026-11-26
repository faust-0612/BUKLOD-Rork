-- Reviewed shared knowledge bank: deterministic, additive, question-specific.
-- No AI results, learner identity, rewards, or runtime changes. Existing private
-- answer_spec is the authoritative shared bank used by the live scorer.
-- DEV until verified and approved for deployment.
do $bank$
declare p record; src record; dst record; path text[];
begin
 -- Stable lock order; no concurrent question edits during validation/publication.
 perform 1 from private.buklod_bible_v4_questions
 where id in ('v4_h_n02','v4_m_n02','v4_m_n01','v4_h_n07')
 order by id for update;
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
  if src.id is null or dst.id is null or src.id=dst.id
    or src.active is distinct from true or dst.active is distinct from true
    or src.reviewed is distinct from true or dst.reviewed is distinct from true
    or src.kind is distinct from 'enumeration' or dst.kind is distinct from 'enumeration'
    or src.scripture_reference is distinct from p.reference or dst.scripture_reference is distinct from p.reference
    or jsonb_typeof(src.answer_spec->'groups'->p.group_index) is distinct from 'array'
    or jsonb_typeof(dst.answer_spec->'groups'->p.group_index) is distinct from 'array'
    or not coalesce((src.answer_spec->'groups'->p.group_index) ? p.anchor,false)
    or not coalesce((dst.answer_spec->'groups'->p.group_index) ? p.anchor,false)
    or not coalesce((src.answer_spec->'groups'->p.group_index) ? p.alias,false)
  then raise exception 'Shared knowledge source or target changed: % -> %',p.source_id,p.target_id; end if;
  -- Never let one normalized answer become two concepts, on either side.
  if exists(select 1 from jsonb_array_elements(src.answer_spec->'groups') with ordinality g(v,n)
     cross join lateral jsonb_array_elements_text(g.v) z(a)
     where n<>p.group_index+1 and private.buklod_bible_v4_enum_normalize(z.a)=private.buklod_bible_v4_enum_normalize(p.alias))
   or exists(select 1 from jsonb_array_elements(dst.answer_spec->'groups') with ordinality g(v,n)
     cross join lateral jsonb_array_elements_text(g.v) z(a)
     where n<>p.group_index+1 and private.buklod_bible_v4_enum_normalize(z.a)=private.buklod_bible_v4_enum_normalize(p.alias))
  then raise exception 'Shared knowledge concept collision: %',p.target_id;end if;
  path:=array['groups',p.group_index::text];
  if not exists(select 1 from jsonb_array_elements_text(dst.answer_spec #> path) z(a)
    where private.buklod_bible_v4_enum_normalize(z.a)=private.buklod_bible_v4_enum_normalize(p.alias)) then
   update private.buklod_bible_v4_questions
   set answer_spec=jsonb_set(answer_spec,path,(answer_spec #> path)||jsonb_build_array(p.alias),false)
   where id=p.target_id;
  end if;
 end loop;
end;
$bank$;
