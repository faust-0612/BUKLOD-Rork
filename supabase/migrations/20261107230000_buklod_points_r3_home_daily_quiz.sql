-- R3: daily home Bible Quiz. One chosen difficulty, five server-selected questions.
-- Reuses private bank and attempts from R2; never touches academic Quiz.
alter table private.buklod_r2_bible_quiz_questions
 add column if not exists difficulty text not null default 'easy'
 check (difficulty in ('easy','medium','hard'));
alter table private.buklod_r2_bible_quiz_attempts
 add column if not exists difficulty text not null default 'easy'
 check (difficulty in ('easy','medium','hard'));
-- Tag original seeded questions; new question bank expands each level.
update private.buklod_r2_bible_quiz_questions
set difficulty=case
 when id in ('moses','ark','goliath','bethlehem','first') then 'easy'
 when id in ('jonah','disciples','denial','wisdom','walls') then 'medium'
 else 'hard' end
where id in ('moses','ark','goliath','bethlehem','first','jonah','disciples','denial','wisdom','walls',
 'paul','esther','jordan','psalms','resurrection');
insert into private.buklod_r2_bible_quiz_questions
(id,difficulty,question_fil,option_a,option_b,option_c,option_d,correct_choice)
values
('r3_e1','easy','Ano ang pangalan ng ina ni Jesus?','Maria','Marta','Elisabet','Ruth','A'),
('r3_e2','easy','Sino ang unang tao ayon sa Genesis?','Noe','Adan','Moises','David','B'),
('r3_e3','easy','Sino ang kapatid ni Moises na tumulong sa pagsasalita?','Josue','Samuel','Aaron','Saul','C'),
('r3_e4','easy','Ilang araw nilikha ng Diyos ang lahat bago Siya nagpahinga?','Tatlo','Apat','Lima','Anim','D'),
('r3_e5','easy','Ano ang huling aklat ng Bagong Tipan?','Pahayag','Roma','Judas','Mga Gawa','A'),
('r3_e6','easy','Sino ang asawa ni Abraham?','Ruth','Sara','Lea','Esther','B'),
('r3_e7','easy','Sino ang nagkanulo kay Jesus?','Pedro','Tomas','Judas Iscariote','Mateo','C'),
('r3_e8','easy','Saan inilagay ang sanggol na si Jesus?','Sa palasyo','Sa bangka','Sa kuweba','Sa sabsaban','D'),
('r3_e9','easy','Ano ang unang utos sa Sampung Utos?','Huwag magkaroon ng ibang diyos','Huwag magnakaw','Huwag pumatay','Huwag magsinungaling','A'),
('r3_e10','easy','Sino ang tinatawag na ama ng maraming bansa?','Isaac','Abraham','Jacob','Jose','B'),
('r3_m1','medium','Sino ang kahalili ni Moises sa pamumuno sa Israel?','Caleb','Gideon','Josue','Aaron','C'),
('r3_m2','medium','Ilang taon naglakbay ang Israel sa ilang?','Labing-apat','Dalawampu','Tatlumpu','Apatnapu','D'),
('r3_m3','medium','Sino ang ina ni Samuel?','Ana','Rebeca','Rachel','Miriam','A'),
('r3_m4','medium','Sino ang sumulat ng maraming liham sa Bagong Tipan?','Santiago','Pablo','Mateo','Marcos','B'),
('r3_m5','medium','Sa anong bundok natanggap ni Moises ang Kautusan?','Carmelo','Sion','Sinai','Ararat','C'),
('r3_m6','medium','Sinong propeta ang humarap sa mga propeta ni Baal sa Carmelo?','Isaias','Jeremias','Eliseo','Elias','D'),
('r3_m7','medium','Anong aklat ang tungkol kay Naomi at sa kaniyang manugang?','Ruth','Esther','Job','Eclesiastes','A'),
('r3_m8','medium','Sino ang ama ni Juan Bautista?','Jose','Zacarias','Simeon','Felipe','B'),
('r3_m9','medium','Sino ang sumulat ng Ebanghelyong ikatlo ayon sa tradisyon?','Juan','Marcos','Lucas','Mateo','C'),
('r3_m10','medium','Ilang bunga ng Espiritu ang nakalista sa Galacia 5:22–23?','Pito','Walo','Sampu','Siyam','D'),
('r3_h1','hard','Sino ang pumalit kay Judas bilang apostol sa Mga Gawa 1?','Matias','Bernabe','Silas','Esteban','A'),
('r3_h2','hard','Saang liham mababasa ang kabanata tungkol sa pag-ibig na karaniwang tinutukoy na kabanata 13?','Roma','1 Corinto','2 Timoteo','Hebreo','B'),
('r3_h3','hard','Sino ang saserdoteng nakatagpo ni Abraham at pinagbigyan niya ng ikapu?','Aaron','Eli','Melquisedec','Sadoc','C'),
('r3_h4','hard','Sino ang kaibigan ni Pablo na ipinadala niya kay Filemon?','Tito','Timoteo','Silas','Onesimo','D'),
('r3_h5','hard','Saang lungsod unang tinawag na Kristiyano ang mga alagad?','Antioquia','Corinto','Efeso','Filipos','A'),
('r3_h6','hard','Sino ang hari ng Juda nang matuklasan ang Aklat ng Kautusan sa templo?','Asa','Josias','Jotam','Uzias','B'),
('r3_h7','hard','Ano ang pangalan ng ina ni Timoteo?','Loida','Priscila','Eunice','Febe','C'),
('r3_h8','hard','Sino ang propetang may pangitain tungkol sa libis ng tuyong mga buto?','Daniel','Hoseas','Amos','Ezekiel','D'),
('r3_h9','hard','Saan sinasabing ipinanganak si Abraham ayon sa Genesis 11?','Ur ng mga Caldeo','Haran','Hebron','Bethel','A'),
('r3_h10','hard','Sino ang kausap ni Felipe na nagbabasa ng Isaias sa Mga Gawa 8?','Isang taga-Roma','Isang opisyal na Etiope','Isang taga-Samaria','Isang taga-Efeso','B')
on conflict(id) do nothing;
-- Repair deliberately seeded hard entry if a previous transactional rollout has not applied.
update private.buklod_r2_bible_quiz_questions set difficulty='hard' where id='r3_h3';

create or replace function public.get_my_buklod_bible_quiz_r3(p_difficulty text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := auth.uid(); local_day date := (now() at time zone 'Asia/Manila')::date;
 choice text := lower(trim(coalesce(p_difficulty,'')));
 existing record; questions jsonb; pool_size int; keys text[];
begin
 if actor is null then raise exception 'Authentication required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('bible-r3:'||actor::text||':'||local_day::text,0));
 select * into existing from private.buklod_r2_bible_quiz_attempts
 where user_id=actor and local_date=local_day;
 if not found and choice not in ('easy','medium','hard') then
   return jsonb_build_object('selection_required',true,'date',local_day,
     'levels',jsonb_build_array(
      jsonb_build_object('id','easy','points',3,'minimum_correct',4),
      jsonb_build_object('id','medium','points',6,'minimum_correct',4),
      jsonb_build_object('id','hard','points',12,'minimum_correct',4)));
 end if;
 if not found then
   select count(*) into pool_size from private.buklod_r2_bible_quiz_questions where difficulty=choice;
   if pool_size<5 then raise exception 'Daily Bible Quiz bank unavailable'; end if;
   select array_agg(q.id order by q.random_key) into keys from (
     select id,md5(id||actor::text||local_day::text) random_key
     from private.buklod_r2_bible_quiz_questions
     where difficulty=choice order by random_key limit 5
   ) q;
   insert into private.buklod_r2_bible_quiz_attempts(user_id,local_date,question_keys,difficulty)
   values(actor,local_day,keys,choice)
   on conflict(user_id,local_date) do nothing;
   select * into existing from private.buklod_r2_bible_quiz_attempts
   where user_id=actor and local_date=local_day;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'question',q.question_fil,
   'options',jsonb_build_object('A',q.option_a,'B',q.option_b,'C',q.option_c,'D',q.option_d))
   order by array_position(existing.question_keys,q.id)),'[]'::jsonb)
 into questions from private.buklod_r2_bible_quiz_questions q
 where q.id=any(existing.question_keys);
 return jsonb_build_object('date',local_day,'attempt_id',existing.id,
 'difficulty',existing.difficulty,'completed',existing.completed_at is not null,
 'score',existing.score,'awarded_points',existing.points_awarded,
 'minimum_correct',4,
 'questions',case when existing.completed_at is null then questions else '[]'::jsonb end);
end;
$$;
revoke all on function public.get_my_buklod_bible_quiz_r3(text) from public,anon;
grant execute on function public.get_my_buklod_bible_quiz_r3(text) to authenticated;

create or replace function public.submit_my_buklod_bible_quiz_r3(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=auth.uid(); rec record; received int; correct int; reward_type text;
award int:=0; ledger_key text; ledger_id uuid;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then
  raise exception 'Five answers are required'; end if;
 select * into rec from private.buklod_r2_bible_quiz_attempts
 where id=p_attempt_id and user_id=actor for update;
 if not found then raise exception 'Attempt unavailable';end if;
 if rec.completed_at is not null then
  return jsonb_build_object('completed',true,'already_submitted',true,
   'score',rec.score,'points',rec.points_awarded,'difficulty',rec.difficulty);end if;
 if rec.local_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'Quiz expired';end if;
 if coalesce(array_length(rec.question_keys,1),0)<>5 then raise exception 'Invalid quiz questions';end if;
 select count(*) into received from jsonb_each_text(p_answers);
 if received<>5 or (select count(*) from unnest(rec.question_keys) q(id)
    where p_answers ? q.id and upper(p_answers->>q.id) in ('A','B','C','D'))<>5 then
    raise exception 'Five valid answers are required';end if;
 select count(*) into correct from private.buklod_r2_bible_quiz_questions q
 where q.id=any(rec.question_keys) and q.correct_choice=upper(p_answers->>q.id);
 reward_type:='bible_quiz_'||rec.difficulty;
 if correct>=4 then
  select least(r.base_points,coalesce(r.max_points_per_event,12),12)
  into award from public.buklod_point_rules r
  where r.activity_type=reward_type and r.is_active=true;
  award:=greatest(coalesce(award,0),0);
 end if;
 ledger_key:='bible_quiz:r3:'||rec.local_date::text;
 if award>0 then
  insert into public.buklod_points_ledger
  (user_id,direction,points,activity_type,source_key,description,awarded_by)
  values(actor,'credit',award,reward_type,ledger_key,
   'Home Daily Bible Quiz ('||rec.difficulty||') '||correct||'/5',actor)
  on conflict(user_id,source_key) do nothing returning id into ledger_id;
 end if;
 update private.buklod_r2_bible_quiz_attempts
 set completed_at=now(),score=correct,points_awarded=award,ledger_id=ledger_id
 where id=rec.id;
 return jsonb_build_object('completed',true,'score',correct,'points',award,
  'difficulty',rec.difficulty,'already_submitted',false);
end;
$$;
revoke all on function public.submit_my_buklod_bible_quiz_r3(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_quiz_r3(uuid,jsonb) to authenticated;
