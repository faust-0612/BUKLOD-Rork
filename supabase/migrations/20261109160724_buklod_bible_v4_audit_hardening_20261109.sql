-- Bible V4 additive audit correction: replace only three RPC definitions.
-- Unifies legacy/new daily lock; prevents repeat concept selection; enables Easy Arena
-- and uses distinct concepts across the 10-question event pool.
-- No DML changes, no classroom, account, or financial system impact.
CREATE OR REPLACE FUNCTION public.get_my_buklod_bible_quiz_r3(p_difficulty text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid := auth.uid(); local_day date := (now() at time zone 'Asia/Manila')::date;
 choice text := lower(trim(coalesce(p_difficulty,'')));
 existing record; v4_attempt record; questions jsonb; pool_size int; keys text[];
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
$function$;

create or replace function public.get_my_buklod_bible_quiz_v4(p_difficulty text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); local_day date:=(now() at time zone 'Asia/Manila')::date;
 choice text:=lower(trim(coalesce(p_difficulty,''))); a record; question_data jsonb;
 kinds text[]; skills text[]; selected text[]:='{}'; slot int; selected_id text;
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
   where q.active and q.reviewed and q.difficulty=choice
    and q.kind=kinds[slot] and (skills[slot]='' or q.skill=skills[slot])
    and not(q.id=any(selected))
    and not exists(select 1 from private.buklod_bible_v4_questions seen
      where seen.id=any(selected) and seen.concept_key=q.concept_key)
   order by
     coalesce((select max(x.created_at) from private.buklod_bible_v4_attempts x
       join private.buklod_bible_v4_questions earlier_q
         on earlier_q.id=any(x.question_keys)
       where x.user_id=actor and earlier_q.concept_key=q.concept_key),
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

create or replace function public.admin_create_buklod_bible_event_v4(
 p_kind text,p_difficulty text,p_start_at timestamptz,
 p_duration_minutes integer default null,p_slots integer default 5)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 select array_agg(picked.id order by picked.random_key) into v_questions from (
  select id,random_key from (
   select distinct on (b.concept_key) b.id,b.concept_key,
     md5(b.id||p_start_at::text) as random_key
   from private.buklod_bible_v4_questions b
   where b.active and b.reviewed and b.difficulty=v_level and b.kind='mcq'
     and (v_kind='flash' or v_level='easy'
       or b.skill in ('situation','analysis','comparison'))
   order by b.concept_key,random_key
  ) topics
  order by random_key limit v_limit
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
$$;
