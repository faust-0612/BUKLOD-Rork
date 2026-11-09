-- BUKLOD Bible Quiz V4: parallel nonbreaking daily engine. R3 remains for old clients.
-- Do not confuse noncash BUKLOD Points with AdMob QMP or PF withdrawable revenue.
create table if not exists private.buklod_bible_v4_questions (
 id text primary key,
 difficulty text not null check (difficulty in ('easy','medium','hard')),
 kind text not null check (kind in ('mcq','identification','enumeration','essay')),
 skill text not null,
 concept_key text not null,
 prompt text not null,
 options jsonb,
 correct_choice text check (correct_choice in ('A','B','C','D')),
 answer_spec jsonb not null default '{}'::jsonb,
 scripture_reference text not null default '',
 rationale text not null default '',
 active boolean not null default true,
 reviewed boolean not null default false,
 created_at timestamptz not null default now(),
 check (
   (kind='mcq' and jsonb_typeof(options)='object' and correct_choice is not null)
   or (kind<>'mcq' and correct_choice is null)
 )
);
revoke all on private.buklod_bible_v4_questions from public,anon,authenticated;
create index if not exists buklod_bible_v4_bank_idx
 on private.buklod_bible_v4_questions(difficulty,kind,skill) where active and reviewed;

-- Old factual Hard trivia is reclassified as Medium: genuinely advanced Hard uses
-- newly reviewed contextual reasoning and its own answer keys.
insert into private.buklod_bible_v4_questions
(id,difficulty,kind,skill,concept_key,prompt,options,correct_choice,scripture_reference,rationale,reviewed)
select q.id,
 case when q.difficulty='hard' then 'medium' else q.difficulty end,
 'mcq','recall','legacy:'||q.id,q.question_fil,
 jsonb_build_object('A',q.option_a,'B',q.option_b,'C',q.option_c,'D',q.option_d),
 q.correct_choice,'','Basahin ang kaugnay na talata at ang buong konteksto.',true
from private.buklod_r2_bible_quiz_questions q
on conflict(id) do nothing;

create table if not exists private.buklod_bible_v4_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 local_date date not null,
 difficulty text not null check (difficulty in ('easy','medium','hard')),
 question_keys text[] not null,
 state text not null default 'started' check (state in ('started','pending_review','completed')),
 submitted_answers jsonb,
 review_items jsonb,
 score_units integer check (score_units between 0 and 10),
 points_awarded integer not null default 0 check (points_awarded between 0 and 12),
 ledger_id uuid references public.buklod_points_ledger(id),
 reviewed_by uuid,
 review_note text,
 submitted_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,local_date)
);
revoke all on private.buklod_bible_v4_attempts from public,anon,authenticated;
create index if not exists buklod_bible_v4_history_idx on private.buklod_bible_v4_attempts(user_id,created_at desc);

create or replace function private.buklod_bible_v4_points(p_difficulty text,p_units int)
returns integer language sql immutable set search_path='' as $$
 select case p_difficulty
  when 'easy' then case when p_units>=9 then 3 when p_units>=7 then 2 when p_units>=6 then 1 else 0 end
  when 'medium' then case when p_units=10 then 6 when p_units=9 then 5 when p_units>=8 then 4 when p_units>=7 then 3 when p_units>=6 then 2 else 0 end
  when 'hard' then case when p_units=10 then 12 when p_units=9 then 10 when p_units>=8 then 8 when p_units>=7 then 6 when p_units>=6 then 4 else 0 end
  else 0 end;
$$;
revoke all on function private.buklod_bible_v4_points(text,int) from public,anon,authenticated;

-- One ledger award per Manila day across BOTH R3 and V4; no ad-view credits.
create or replace function private.buklod_bible_v4_finalize(p_attempt uuid,p_units integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; desired int:=0; actual int:=0; v_ledger uuid; v_rule record;
begin
 select * into a from private.buklod_bible_v4_attempts where id=p_attempt for update;
 if not found then raise exception 'Attempt unavailable'; end if;
 if a.state='completed' then
  return jsonb_build_object('status','completed','score_units',a.score_units,'points',a.points_awarded);
 end if;
 if p_units<0 or p_units>10 then raise exception 'Score out of range';end if;
 desired:=private.buklod_bible_v4_points(a.difficulty,p_units);
 select r.base_points,r.max_points_per_event,r.is_active into v_rule
 from public.buklod_point_rules r where r.activity_type='bible_quiz_'||a.difficulty;
 if not found or coalesce(v_rule.is_active,false)=false then desired:=0;
 else desired:=least(desired,v_rule.base_points,coalesce(v_rule.max_points_per_event,12),12);end if;
 if desired>0 then
  insert into public.buklod_points_ledger
   (user_id,direction,points,activity_type,source_key,description,awarded_by)
  values (a.user_id,'credit',desired,'bible_quiz_'||a.difficulty,
   'bible_quiz:r3:'||a.local_date::text,
   'Daily Bible Quiz V4 '||p_units||'/10 score units',a.user_id)
  on conflict(user_id,source_key) do nothing returning id into v_ledger;
  if v_ledger is not null then actual:=desired; end if;
 end if;
 update private.buklod_bible_v4_attempts
 set state='completed',score_units=p_units,points_awarded=actual,ledger_id=v_ledger,completed_at=now()
 where id=p_attempt;
 return jsonb_build_object('status','completed','score_units',p_units,'points',actual);
end;
$$;
revoke all on function private.buklod_bible_v4_finalize(uuid,integer) from public,anon,authenticated;

create or replace function public.get_my_buklod_bible_quiz_v4(p_difficulty text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); local_day date:=(now() at time zone 'Asia/Manila')::date;
 choice text:=lower(trim(coalesce(p_difficulty,''))); a record; question_data jsonb;
 kinds text[]; skills text[]; selected text[]:='{}'; slot int; selected_id text;
begin
 if actor is null then raise exception 'Authentication required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bible-v4:'||actor::text||':'||local_day::text,0));
 select * into a from private.buklod_bible_v4_attempts
 where user_id=actor and local_date=local_day;
 if not found and exists(select 1 from private.buklod_r2_bible_quiz_attempts
   where user_id=actor and local_date=local_day) then
  return jsonb_build_object('legacy_attempt',true,'date',local_day);
 end if;
 if not found and choice not in ('easy','medium','hard') then
  return jsonb_build_object('selection_required',true,'date',local_day);
 end if;
 if not found then
  if choice='easy' then
   kinds:=array['mcq','mcq','mcq','mcq','identification'];
   skills:=array['','','','',''];
  elsif choice='medium' then
   kinds:=array['mcq','mcq','mcq','identification','enumeration'];
   skills:=array['','','','',''];
  else
   kinds:=array['mcq','mcq','mcq','enumeration',
     case when extract(isodow from local_day)::integer in (2,6) then 'essay' else 'mcq' end];
   skills:=array['situation','analysis','comparison','',''];
  end if;
  for slot in 1..5 loop
   select q.id into selected_id
   from private.buklod_bible_v4_questions q
   where q.active and q.reviewed and q.difficulty=choice
    and q.kind=kinds[slot] and (skills[slot]='' or q.skill=skills[slot])
    and not(q.id=any(selected))
    and not exists(select 1 from private.buklod_bible_v4_questions seen
      where seen.id=any(selected) and seen.concept_key=q.concept_key)
   order by
     coalesce((select max(x.created_at) from private.buklod_bible_v4_attempts x
       where x.user_id=actor and q.id=any(x.question_keys)),
       '-infinity'::timestamptz) asc,
     md5(q.id||actor::text||local_day::text)
   limit 1;
   -- Fail closed if a required format is missing: no random easy trivia in Hard.
   if selected_id is null then raise exception 'Reviewed Bible Quiz bank needs more % questions for %',kinds[slot],choice;end if;
   selected:=array_append(selected,selected_id);
  end loop;
  insert into private.buklod_bible_v4_attempts(user_id,local_date,difficulty,question_keys)
  values(actor,local_day,choice,selected)
  on conflict(user_id,local_date) do nothing;
  select * into a from private.buklod_bible_v4_attempts where user_id=actor and local_date=local_day;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',q.id,'kind',q.kind,'skill',q.skill,'question',q.prompt,
  'options',case when q.kind='mcq' then q.options else null end,
  'reference',q.scripture_reference)
  order by array_position(a.question_keys,q.id)),'[]'::jsonb)
 into question_data
 from private.buklod_bible_v4_questions q where q.id=any(a.question_keys);
 return jsonb_build_object('date',a.local_date,'attempt_id',a.id,'difficulty',a.difficulty,
  'state',a.state,'completed',a.state='completed','score_units',a.score_units,
  'awarded_points',a.points_awarded,'questions',
  case when a.state='started' then question_data else '[]'::jsonb end,
  'review',case when a.state='started' then null else a.review_items end,
  'review_note',a.review_note);
end;
$$;
revoke all on function public.get_my_buklod_bible_quiz_v4(text) from public,anon;
grant execute on function public.get_my_buklod_bible_quiz_v4(text) to authenticated;

-- Answer keys are looked up ONLY in private tables. A saved essay is never
-- auto-credited: ambiguous semantic judgments require System Admin review.
create or replace function public.submit_my_buklod_bible_quiz_v4(p_attempt_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); a record; q record; v_answer jsonb; v_group jsonb;
 expected text; answer_text text; units integer:=0; item_units integer;
 pending boolean:=false; results jsonb:='[]'::jsonb; review jsonb; out_result jsonb;
 count_items integer:=0;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then
  raise exception 'Five answers required';end if;
 select * into a from private.buklod_bible_v4_attempts where id=p_attempt_id and user_id=actor for update;
 if not found then raise exception 'Attempt unavailable';end if;
 if a.state<>'started' then return jsonb_build_object('status',a.state,'score_units',a.score_units,'points',a.points_awarded);end if;
 if a.local_date<>(now() at time zone 'Asia/Manila')::date then raise exception 'Daily quiz expired';end if;
 if coalesce(array_length(a.question_keys,1),0)<>5 then raise exception 'Invalid frozen questions';end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>5 then raise exception 'Exactly five answers required';end if;
 for q in select * from private.buklod_bible_v4_questions x
  where x.id=any(a.question_keys) order by array_position(a.question_keys,x.id)
 loop
  count_items:=count_items+1;
  if not(p_answers ? q.id) then raise exception 'Missing answer';end if;
  v_answer:=p_answers->q.id;
  item_units:=0;
  if q.kind='mcq' then
   if jsonb_typeof(v_answer)<>'string' then raise exception 'Invalid MCQ answer';end if;
   answer_text:=upper(trim(p_answers->>q.id));
   if answer_text not in ('A','B','C','D') then raise exception 'Invalid MCQ option';end if;
   if answer_text=q.correct_choice then item_units:=2;end if;
  elsif q.kind='identification' then
   if jsonb_typeof(v_answer)<>'string' then raise exception 'Invalid identification answer';end if;
   answer_text:=lower(trim(regexp_replace(p_answers->>q.id,'[[:punct:]]','','g')));
   if length(answer_text)<1 or length(answer_text)>120 then raise exception 'Identification answer length invalid';end if;
   if exists(select 1 from jsonb_array_elements_text(q.answer_spec->'answers') z(value)
    where lower(trim(regexp_replace(z.value,'[[:punct:]]','','g')))=answer_text) then item_units:=2;end if;
  elsif q.kind='enumeration' then
   if jsonb_typeof(v_answer)<>'array' or jsonb_array_length(v_answer)<>2 then
    raise exception 'Enter two enumeration answers';end if;
   if exists(select 1 from jsonb_array_elements(v_answer) x where jsonb_typeof(x.value)<>'string'
     or length(x.value #>> '{}')>120) then raise exception 'Invalid enumeration item';end if;
   for v_group in select value from jsonb_array_elements(q.answer_spec->'groups') loop
    if exists(select 1 from jsonb_array_elements_text(v_answer) va(answer)
      join lateral jsonb_array_elements_text(v_group) accepted(answer) on true
      where lower(trim(regexp_replace(va.answer,'[[:punct:]]','','g')))=
            lower(trim(regexp_replace(accepted.answer,'[[:punct:]]','','g')))) then item_units:=item_units+1;end if;
   end loop;
   item_units:=least(item_units,2);
  else
   if jsonb_typeof(v_answer)<>'string' or length(trim(p_answers->>q.id))<30 or length(p_answers->>q.id)>2400 then
    raise exception 'Essay requires a meaningful answer of 30–2400 characters';end if;
   pending:=true;
  end if;
  if q.kind<>'essay' then units:=units+item_units;end if;
  results:=results||jsonb_build_array(jsonb_build_object(
   'id',q.id,'kind',q.kind,'earned_units',case when q.kind='essay' then null else item_units end,
   'max_units',2,'reference',q.scripture_reference,'rationale',q.rationale,
   'correct_answer',case when q.kind='mcq' then to_jsonb(q.correct_choice)
     when q.kind='essay' then null else q.answer_spec end));
 end loop;
 if count_items<>5 then raise exception 'Invalid frozen quiz';end if;
 update private.buklod_bible_v4_attempts
 set submitted_answers=p_answers,review_items=results,submitted_at=now(),
  state=case when pending then 'pending_review' else 'started' end
 where id=a.id;
 if pending then
  return jsonb_build_object('status','pending_review','score_units',units,
   'points',0,'review',results,'notice','Essay requires human rubric review before BP is finalized');
 end if;
 out_result:=private.buklod_bible_v4_finalize(a.id,units);
 return out_result||jsonb_build_object('review',results);
end;
$$;
revoke all on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_quiz_v4(uuid,jsonb) to authenticated;

create or replace function public.admin_review_buklod_bible_v4_essay(
 p_attempt_id uuid,p_essay_units integer,p_feedback text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; v_earned int:=0; result jsonb;
begin
 if auth.uid() is null or not public.buklod_is_system_admin() then
  raise exception 'System Admin only' using errcode='42501';end if;
 if p_essay_units not between 0 and 2 then raise exception 'Essay score must be 0–2 units';end if;
 select * into a from private.buklod_bible_v4_attempts where id=p_attempt_id for update;
 if not found or a.state<>'pending_review' then raise exception 'No pending essay';end if;
 select coalesce(sum((item->>'earned_units')::int),0) into v_earned
 from jsonb_array_elements(a.review_items) item
 where item->>'earned_units' is not null;
 update private.buklod_bible_v4_attempts set
  review_items=(select jsonb_agg(case when item->>'kind'='essay' then
   jsonb_set(item,'{earned_units}',to_jsonb(p_essay_units)) else item end)
   from jsonb_array_elements(a.review_items) item),
  reviewed_by=auth.uid(),review_note=left(p_feedback,600)
 where id=a.id;
 result:=private.buklod_bible_v4_finalize(a.id,v_earned+p_essay_units);
 return result;
end;
$$;
revoke all on function public.admin_review_buklod_bible_v4_essay(uuid,integer,text) from public,anon;
grant execute on function public.admin_review_buklod_bible_v4_essay(uuid,integer,text) to authenticated;
