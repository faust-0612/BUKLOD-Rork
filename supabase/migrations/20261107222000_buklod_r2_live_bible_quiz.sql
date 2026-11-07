-- R2 Bible Quiz: non-academic, daily Show Faith quiz. Does not touch Classroom exams.
-- Server-owned answer key, one Manila-day attempt, backend scoring, unique award.
create table if not exists private.buklod_r2_bible_quiz_questions (
 id text primary key, question_fil text not null,
 option_a text not null, option_b text not null,
 option_c text not null, option_d text not null,
 correct_choice text not null check(correct_choice in ('A','B','C','D'))
);
revoke all on private.buklod_r2_bible_quiz_questions from public,anon,authenticated;
insert into private.buklod_r2_bible_quiz_questions
(id,question_fil,option_a,option_b,option_c,option_d,correct_choice)
values ('moses','Sino ang nanguna sa mga Israelita palabas ng Egipto?','Moises','Josue','Aaron','Samuel','A'),
('ark','Sino ang gumawa ng arka bago ang malaking baha?','Abraham','Noe','Isaias','Daniel','B'),
('goliath','Sino ang humarap kay Goliat?','Solomon','Elias','David','Pedro','C'),
('bethlehem','Saang bayan ipinanganak si Jesus?','Jerusalem','Nazaret','Jerico','Bethlehem','D'),
('first','Ano ang unang aklat ng Biblia?','Genesis','Exodo','Mateo','Mga Awit','A'),
('jonah','Sino ang nilunok ng malaking isda?','Job','Jonas','Joel','Juan','B'),
('disciples','Ilang apostol ang pinili ni Jesus?','Sampu','Labing-isa','Labindalawa','Labintatlo','C'),
('denial','Sino ang tatlong beses na nagkaila kay Jesus?','Tomas','Juan','Andres','Pedro','D'),
('wisdom','Sino ang haring kilala sa karunungan?','Solomon','Saul','David','Ezekias','A'),
('walls','Saang lungsod gumuho ang mga pader matapos ang pag-ikot ng mga Israelita?','Bethel','Jerico','Sidon','Tiro','B'),
('paul','Ano ang dating pangalan ni Pablo?','Simon','Santiago','Saulo','Silas','C'),
('esther','Sinong reyna ang namagitan para sa kaniyang bayan?','Ruth','Debora','Maria','Esther','D'),
('jordan','Sa anong ilog binautismuhan si Jesus?','Jordan','Nilo','Eufrates','Tigris','A'),
('psalms','Aling aklat ang naglalaman ng maraming awit at panalangin?','Levitico','Mga Awit','Roma','Hukom','B'),
('resurrection','Sa anong araw matapos ang paglilibing muling nabuhay si Jesus?','Una','Ikalawa','Ikatlo','Ikapito','C')
on conflict(id) do nothing;

create table if not exists private.buklod_r2_bible_quiz_attempts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 local_date date not null,
 question_keys text[] not null,
 completed_at timestamptz,
 score integer,
 points_awarded integer not null default 0,
 ledger_id uuid references public.buklod_points_ledger(id),
 created_at timestamptz not null default now(),
 unique(user_id,local_date),
 constraint buklod_r2_quiz_score check(score is null or score between 0 and 5),
 constraint buklod_r2_quiz_points check(points_awarded between 0 and 12)
);
revoke all on private.buklod_r2_bible_quiz_attempts from public,anon,authenticated;
create index if not exists buklod_r2_quiz_user_idx on private.buklod_r2_bible_quiz_attempts(user_id,local_date desc);

-- These rewards have a real server-scored completion path.
update public.buklod_point_rules
set is_active=true, daily_cap_points=base_points,weekly_cap_points=base_points*7,
    notes='R2 server-graded Show Faith Bible Quiz; one attempt/day, one score-tier award',
    updated_at=now()
where activity_type in ('bible_quiz_easy','bible_quiz_medium','bible_quiz_hard');

create or replace function public.get_my_buklod_bible_quiz_r2()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 today date := (now() at time zone 'Asia/Manila')::date;
 attempt_rec record;
 choices jsonb;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':bible_quiz_r2:'||today::text,0));
 insert into private.buklod_r2_bible_quiz_attempts(user_id,local_date,question_keys)
 select actor,today,array_agg(q.id order by q.order_key)
 from (select id,md5(id||actor::text||today::text) as order_key
       from private.buklod_r2_bible_quiz_questions
       order by order_key limit 5) q
 on conflict(user_id,local_date) do nothing;
 select * into attempt_rec from private.buklod_r2_bible_quiz_attempts
 where user_id=actor and local_date=today;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',q.id,'question',q.question_fil,
   'options',jsonb_build_object('A',q.option_a,'B',q.option_b,'C',q.option_c,'D',q.option_d)
 ) order by array_position(attempt_rec.question_keys,q.id)),'[]'::jsonb)
 into choices from private.buklod_r2_bible_quiz_questions q
 where q.id=any(attempt_rec.question_keys);
 return jsonb_build_object('attempt_id',attempt_rec.id,'date',today,
   'completed',attempt_rec.completed_at is not null,
   'score',attempt_rec.score,'awarded_points',attempt_rec.points_awarded,
   'questions',case when attempt_rec.completed_at is null then choices else '[]'::jsonb end);
end;
$$;
revoke all on function public.get_my_buklod_bible_quiz_r2() from public,anon;
grant execute on function public.get_my_buklod_bible_quiz_r2() to authenticated;

create or replace function public.submit_my_buklod_bible_quiz_r2(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 rec record;
 valid_count integer;
 correct_count integer;
 award_type text;
 award_value integer := 0;
 awarded_id uuid;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then
   raise exception 'Five answers are required';
 end if;
 select * into rec from private.buklod_r2_bible_quiz_attempts
 where id=p_attempt_id and user_id=actor for update;
 if not found then raise exception 'Quiz attempt unavailable'; end if;
 if rec.completed_at is not null then
   return jsonb_build_object('completed',true,'already_submitted',true,
     'score',rec.score,'points',rec.points_awarded);
 end if;
 if rec.local_date<>(now() at time zone 'Asia/Manila')::date then
   raise exception 'Daily quiz expired';
 end if;
 select count(*) into valid_count from jsonb_each_text(p_answers);
 if valid_count<>5 then raise exception 'Exactly five answers required'; end if;
 select count(*) into valid_count
 from unnest(rec.question_keys) as q(id)
 where (p_answers ? q.id) and upper(p_answers->>q.id) in ('A','B','C','D');
 if valid_count<>5 then raise exception 'Invalid or incomplete quiz answers'; end if;
 select count(*) into correct_count
 from private.buklod_r2_bible_quiz_questions q
 where q.id=any(rec.question_keys)
 and q.correct_choice=upper(p_answers->>q.id);
 award_type := case correct_count when 5 then 'bible_quiz_hard'
   when 4 then 'bible_quiz_medium' when 3 then 'bible_quiz_easy' else null end;
 if award_type is not null then
   select greatest(0,least(r.base_points,r.max_points_per_event,12))
     into award_value from public.buklod_point_rules r
   where r.activity_type=award_type and r.is_active=true;
   if award_value is null then award_value:=0; end if;
 end if;
 if award_value>0 then
   insert into public.buklod_points_ledger
   (user_id,direction,points,activity_type,source_key,description,awarded_by)
   values(actor,'credit',award_value,award_type,
     'bible_quiz:r2:'||rec.local_date::text,
     'Show Faith daily Bible Quiz: '||correct_count||'/5',actor)
   on conflict(user_id,source_key) do nothing returning id into awarded_id;
 end if;
 update private.buklod_r2_bible_quiz_attempts
 set completed_at=now(),score=correct_count,points_awarded=award_value,ledger_id=awarded_id
 where id=rec.id;
 return jsonb_build_object('completed',true,'already_submitted',false,
    'score',correct_count,'points',award_value,'reward',award_type);
end;
$$;
revoke all on function public.submit_my_buklod_bible_quiz_r2(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_quiz_r2(uuid,jsonb) to authenticated;
