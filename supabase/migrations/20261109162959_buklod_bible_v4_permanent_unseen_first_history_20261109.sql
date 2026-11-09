-- BUKLOD years-long, month-independent per-user anti-repeat history.
-- Backfill historic R3/V4, use unseen exact questions first, then oldest exposure.
-- Continue monthly Arena with event-wide unseen-first question selection.
-- Preserve R3 compatibility, score/points rules, auth, and client runtime.

-- One durable row per user/question (not one row per daily attempt).
-- Never reset at calendar-month or year boundary; keep history if attempts are archived.
create table if not exists private.buklod_bible_v4_seen_questions (
 user_id uuid not null references public.profiles(id) on delete cascade,
 question_id text not null,
 concept_key text not null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 seen_count integer not null default 1 check(seen_count>=1),
 primary key(user_id,question_id)
);
alter table private.buklod_bible_v4_seen_questions enable row level security;
revoke all on private.buklod_bible_v4_seen_questions from public,anon,authenticated;
create index if not exists buklod_bible_v4_seen_concept_idx
 on private.buklod_bible_v4_seen_questions(user_id,concept_key,last_seen_at);

-- Import every legacy R3 and V4 exposure, including prior-month and prior-year attempts.
insert into private.buklod_bible_v4_seen_questions(user_id,question_id,concept_key,first_seen_at,last_seen_at,seen_count)
select history.user_id,history.question_id,
       coalesce(q.concept_key,'legacy:'||history.question_id),
       min(history.seen_at),max(history.seen_at),count(*)::integer
from (
 select a.user_id,k.question_id,a.created_at as seen_at
 from private.buklod_r2_bible_quiz_attempts a
 cross join lateral unnest(a.question_keys) as k(question_id)
 union all
 select a.user_id,k.question_id,a.created_at as seen_at
 from private.buklod_bible_v4_attempts a
 cross join lateral unnest(a.question_keys) as k(question_id)
) history
left join private.buklod_bible_v4_questions q on q.id=history.question_id
group by history.user_id,history.question_id,q.concept_key
on conflict(user_id,question_id) do update
 set first_seen_at=least(private.buklod_bible_v4_seen_questions.first_seen_at,excluded.first_seen_at),
     last_seen_at=greatest(private.buklod_bible_v4_seen_questions.last_seen_at,excluded.last_seen_at),
     seen_count=greatest(private.buklod_bible_v4_seen_questions.seen_count,excluded.seen_count),
     concept_key=excluded.concept_key;


CREATE OR REPLACE FUNCTION public.get_my_buklod_bible_quiz_r3(p_difficulty text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid := auth.uid(); local_day date := (now() at time zone 'Asia/Manila')::date;
 choice text := lower(trim(coalesce(p_difficulty,'')));
 existing record; v4_attempt record; questions jsonb; pool_size int; keys text[]; v_new_attempt uuid;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('bible-daily-shared:'||actor::text||':'||local_day::text,0));
 select * into existing from private.buklod_r2_bible_quiz_attempts
 where user_id=actor and local_date=local_day;
 if not found then
   select difficulty,state,score_units,points_awarded into v4_attempt
   from private.buklod_bible_v4_attempts
   where user_id=actor and local_date=local_day;
   if found then
     return jsonb_build_object(
       'date',local_day,'completed',true,'difficulty',v4_attempt.difficulty,
       'score',coalesce(v4_attempt.score_units,0)/2.0,
       'awarded_points',v4_attempt.points_awarded,
       'questions','[]'::jsonb,'selection_required',false,
       'review_note','Today''s attempt is in the newer Bible Quiz.');
   end if;
 end if;
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
   select array_agg(q.id order by q.last_seen_at nulls first,q.random_key) into keys from (
     select bank.id,h.last_seen_at,
       md5(bank.id||actor::text||local_day::text) random_key
     from private.buklod_r2_bible_quiz_questions bank
     left join private.buklod_bible_v4_seen_questions h
       on h.user_id=actor and h.question_id=bank.id
     where bank.difficulty=choice
     order by h.last_seen_at asc nulls first,random_key limit 5
   ) q;
   insert into private.buklod_r2_bible_quiz_attempts(user_id,local_date,question_keys,difficulty)
   values(actor,local_day,keys,choice)
   on conflict(user_id,local_date) do nothing returning id into v_new_attempt;
   if v_new_attempt is not null then

   insert into private.buklod_bible_v4_seen_questions
   (user_id,question_id,concept_key,first_seen_at,last_seen_at,seen_count)
   select actor,k.question_id,coalesce(q.concept_key,'legacy:'||k.question_id),now(),now(),1
   from unnest(keys) as k(question_id)
   left join private.buklod_bible_v4_questions q on q.id=k.question_id
   on conflict(user_id,question_id) do update
    set concept_key=excluded.concept_key,
        last_seen_at=excluded.last_seen_at,
        seen_count=private.buklod_bible_v4_seen_questions.seen_count+1;
   end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.get_my_buklod_bible_quiz_v4(p_difficulty text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid:=auth.uid(); local_day date:=(now() at time zone 'Asia/Manila')::date;
 choice text:=lower(trim(coalesce(p_difficulty,''))); a record; question_data jsonb;
 kinds text[]; skills text[]; selected text[]:='{}'; slot int; selected_id text; v_new_attempt uuid;
begin
 if actor is null then raise exception 'Authentication required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bible-daily-shared:'||actor::text||':'||local_day::text,0));
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
   left join private.buklod_bible_v4_seen_questions seen_id
     on seen_id.user_id=actor and seen_id.question_id=q.id
   where q.active and q.reviewed and q.difficulty=choice
    and q.kind=kinds[slot]
    and (skills[slot]='' or q.skill=skills[slot] or
      (choice='hard' and q.kind='mcq' and q.skill in ('situation','analysis','comparison')))
    and not(q.id=any(selected))
    and not exists(select 1 from private.buklod_bible_v4_questions seen
      where seen.id=any(selected) and seen.concept_key=q.concept_key)
   order by
     (seen_id.question_id is not null) asc,
     coalesce((select max(h.last_seen_at) from private.buklod_bible_v4_seen_questions h
       where h.user_id=actor and h.concept_key=q.concept_key),
       '-infinity'::timestamptz) asc,
     case when skills[slot]<>'' and q.skill<>skills[slot] then 1 else 0 end,
     seen_id.last_seen_at asc nulls first,
     md5(q.id||actor::text||local_day::text)
   limit 1;
   -- Fail closed if a required format is missing: no random easy trivia in Hard.
   if selected_id is null then raise exception 'Reviewed Bible Quiz bank needs more % questions for %',kinds[slot],choice;end if;
   selected:=array_append(selected,selected_id);
  end loop;
  insert into private.buklod_bible_v4_attempts(user_id,local_date,difficulty,question_keys)
  values(actor,local_day,choice,selected)
  on conflict(user_id,local_date) do nothing returning id into v_new_attempt;
  if v_new_attempt is not null then

   insert into private.buklod_bible_v4_seen_questions
   (user_id,question_id,concept_key,first_seen_at,last_seen_at,seen_count)
   select actor,k.question_id,q.concept_key,now(),now(),1
   from unnest(selected) as k(question_id)
   join private.buklod_bible_v4_questions q on q.id=k.question_id
   on conflict(user_id,question_id) do update
    set concept_key=excluded.concept_key,
        last_seen_at=excluded.last_seen_at,
        seen_count=private.buklod_bible_v4_seen_questions.seen_count+1;
  end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_buklod_bible_event_v4(p_kind text, p_difficulty text, p_start_at timestamp with time zone, p_duration_minutes integer DEFAULT NULL::integer, p_slots integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); v_kind text:=lower(trim(p_kind));
 v_level text:=lower(trim(p_difficulty)); v_questions text[]; v_count int;
 v_month text; ev_id uuid; minutes int; v_limit integer;
begin
 if actor is null or not public.buklod_is_system_admin() then
  raise exception 'System Admin only' using errcode='42501';end if;
 if v_kind not in ('flash','arena') or v_level not in ('easy','medium','hard') then
  raise exception 'Invalid event type or difficulty';end if;
 if p_start_at<now()+interval '2 minutes' or p_start_at>now()+interval '45 days' then
  raise exception 'Schedule 2 minutes to 45 days ahead';end if;
 if v_kind='arena' and (p_slots is null or p_slots not between 3 and 5) then raise exception 'Arena accepts 3–5 players';end if;
 minutes:=coalesce(p_duration_minutes,case when v_kind='flash' then 10 else 20 end);
 if minutes not between 5 and 40 then raise exception 'Event duration out of range';end if;
 v_limit:=case when v_kind='flash' then 1 else 10 end;
 -- A vetted pool with no duplicate topics; medium is the default accessible bee level.
 select array_agg(picked.id order by picked.last_used nulls first,picked.random_key) into v_questions from (
  select id,last_used,random_key from (
   select distinct on (b.concept_key) b.id,b.concept_key,
     (select max(old.starts_at) from private.buklod_bible_v4_events old
      where old.state<>'cancelled' and old.kind=v_kind and old.difficulty=v_level
        and b.id=any(old.question_keys)) as last_used,
     md5(b.id||p_start_at::text) as random_key
   from private.buklod_bible_v4_questions b
   where b.active and b.reviewed and b.difficulty=v_level and b.kind='mcq'
     and (v_kind='flash' or v_level='easy'
       or b.skill in ('situation','analysis','comparison'))
   order by b.concept_key,last_used nulls first,random_key
  ) topics
  order by last_used nulls first,random_key limit v_limit
 ) picked;
 v_count:=coalesce(array_length(v_questions,1),0);
 if v_count<>v_limit then raise exception 'Insufficient reviewed questions';end if;
 v_month:=case when v_kind='arena' then to_char(p_start_at at time zone 'Asia/Manila','YYYY-MM') else null end;
 insert into private.buklod_bible_v4_events
 (kind,title,difficulty,month_key,starts_at,ends_at,max_players,question_keys,created_by)
 values(v_kind,case when v_kind='arena' then 'BUKLOD Monthly Bible Arena' else 'Flash Bible Challenge' end,
  v_level,v_month,p_start_at,p_start_at+make_interval(mins=>minutes),p_slots,v_questions,actor)
 returning id into ev_id;
 return jsonb_build_object('id',ev_id,'kind',v_kind,'starts_at',p_start_at,'difficulty',v_level);
end;
$function$;


do $qa$
begin
 if (select count(*) from private.buklod_r2_bible_quiz_attempts)>0
    and (select count(*) from private.buklod_bible_v4_seen_questions)=0 then
   raise exception 'Legacy question-exposure import failed';
 end if;
 if not (select relrowsecurity from pg_class
    where oid='private.buklod_bible_v4_seen_questions'::regclass) then raise exception 'Question history RLS missing';end if;
 if position('(seen_id.question_id is not null) asc' in
  pg_get_functiondef('public.get_my_buklod_bible_quiz_v4(text)'::regprocedure))=0
   then raise exception 'V4 unseen-first selection not installed';end if;
 if position('h.last_seen_at asc nulls first' in
  pg_get_functiondef('public.get_my_buklod_bible_quiz_r3(text)'::regprocedure))=0
   then raise exception 'R3 unseen-first selection not installed';end if;
 if position('old.state' in pg_get_functiondef(
  'public.admin_create_buklod_bible_event_v4(text,text,timestamptz,integer,integer)'::regprocedure))=0
  then raise exception 'Arena event rotation missing';end if;
end $qa$;

