-- BUKLOD Flash Bible Challenge + monthly Bible Arena (3-5 contestants).
-- Server is authoritative for event clocks, registration, readiness, answer scoring,
-- first-three flash prizes and finalized monthly rankings. Points are NONCASH.
insert into public.buklod_point_rules(activity_type,label,base_points,max_points_per_event,is_active,notes)
values
 ('bible_flash_easy','Flash Bible Challenge Easy',1,1,true,'Only first three correct, one validated award/day'),
 ('bible_flash_medium','Flash Bible Challenge Medium',3,3,true,'Only first three correct, one validated award/day'),
 ('bible_flash_hard','Flash Bible Challenge Hard',6,6,true,'Only first three correct, one validated award/day'),
 ('bible_arena_monthly','Monthly Bible Arena verified placement',15,15,true,'One official arena award per member/month, 3-5 ready players')
on conflict(activity_type) do nothing;

create table if not exists private.buklod_bible_v4_events(
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('flash','arena')),
 title text not null,
 difficulty text not null check(difficulty in ('easy','medium','hard')),
 month_key text,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 max_players integer not null default 5 check(max_players between 3 and 5),
 question_keys text[] not null,
 state text not null default 'scheduled' check(state in ('scheduled','finalized','cancelled')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at),
 check((kind='arena' and array_length(question_keys,1)=10 and month_key is not null)
  or (kind='flash' and array_length(question_keys,1)=1 and month_key is null))
);
revoke all on private.buklod_bible_v4_events from public,anon,authenticated;
create unique index if not exists buklod_bible_v4_one_arena_month_idx
 on private.buklod_bible_v4_events(month_key)
 where kind='arena' and state<>'cancelled';
create index if not exists buklod_bible_v4_event_clock_idx
 on private.buklod_bible_v4_events(starts_at,ends_at);

create table if not exists private.buklod_bible_v4_event_entries(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references private.buklod_bible_v4_events(id),
 user_id uuid not null references public.profiles(id),
 joined_at timestamptz not null default now(),
 ready_at timestamptz,
 answers jsonb,
 submitted_at timestamptz,
 score integer,
 winner_rank integer,
 points_awarded integer not null default 0,
 ledger_id uuid references public.buklod_points_ledger(id),
 unique(event_id,user_id)
);
revoke all on private.buklod_bible_v4_event_entries from public,anon,authenticated;
create index if not exists buklod_bible_v4_event_ranking_idx
 on private.buklod_bible_v4_event_entries(event_id,score desc,submitted_at asc);

create or replace function private.buklod_bible_v4_event_award(
 p_entry uuid,p_points integer,p_activity text,p_source text)
returns integer language plpgsql security definer set search_path='' as $$
declare e record; v_rule record; v_ledger uuid; v_points integer:=0;
begin
 if p_points<1 or p_points>15 then return 0;end if;
 select x.* into e from private.buklod_bible_v4_event_entries x where id=p_entry for update;
 if not found then raise exception 'Entry missing';end if;
 if e.points_awarded>0 then return e.points_awarded;end if;
 select r.is_active,r.max_points_per_event into v_rule from public.buklod_point_rules r
 where r.activity_type=p_activity;
 if not found or not coalesce(v_rule.is_active,false) then return 0;end if;
 v_points:=least(p_points,coalesce(v_rule.max_points_per_event,15));
 insert into public.buklod_points_ledger
  (user_id,direction,points,activity_type,source_key,description,awarded_by)
 values(e.user_id,'credit',v_points,p_activity,p_source,
   'Verified Bible event '||e.event_id::text,e.user_id)
 on conflict(user_id,source_key) do nothing returning id into v_ledger;
 if v_ledger is null then return 0;end if;
 update private.buklod_bible_v4_event_entries
 set points_awarded=v_points,ledger_id=v_ledger where id=p_entry;
 return v_points;
end;
$$;
revoke all on function private.buklod_bible_v4_event_award(uuid,integer,text,text) from public,anon,authenticated;

create or replace function private.buklod_bible_v4_finalize_arena(p_event_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare ev record; en record; placement integer:=0; prize integer;
begin
 select * into ev from private.buklod_bible_v4_events where id=p_event_id for update;
 if not found or ev.kind<>'arena' or ev.state<>'scheduled' or now()<ev.ends_at then return;end if;
 if (select count(*) from private.buklod_bible_v4_event_entries
    where event_id=ev.id and ready_at is not null)<3 then
   update private.buklod_bible_v4_events set state='cancelled' where id=ev.id;
   return;
 end if;
 for en in select * from private.buklod_bible_v4_event_entries
  where event_id=ev.id and ready_at is not null and submitted_at is not null
  order by score desc, submitted_at asc, user_id asc limit 5
 loop
  placement:=placement+1;
  prize:=case placement when 1 then 15 when 2 then 10 when 3 then 7 else 3 end;
  update private.buklod_bible_v4_event_entries set winner_rank=placement where id=en.id;
  perform private.buklod_bible_v4_event_award(en.id,prize,
   'bible_arena_monthly','bible_arena:'||ev.month_key);
 end loop;
 update private.buklod_bible_v4_events set state='finalized' where id=ev.id;
end;
$$;
revoke all on function private.buklod_bible_v4_finalize_arena(uuid) from public,anon,authenticated;

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
 if v_kind='arena' and p_slots not between 3 and 5 then raise exception 'Arena accepts 3–5 players';end if;
 minutes:=coalesce(p_duration_minutes,case when v_kind='flash' then 10 else 20 end);
 if minutes not between 5 and 40 then raise exception 'Event duration out of range';end if;
 v_limit:=case when v_kind='flash' then 1 else 10 end;
 -- A vetted pool with no duplicate topics; medium is the default accessible bee level.
 select array_agg(q.id order by q.random_key) into v_questions from (
  select id,concept_key,md5(id||p_start_at::text) as random_key
  from private.buklod_bible_v4_questions
  where active and reviewed and difficulty=v_level and kind='mcq'
  order by random_key limit v_limit
 ) q;
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
revoke all on function public.admin_create_buklod_bible_event_v4(text,text,timestamptz,integer,integer) from public,anon;
grant execute on function public.admin_create_buklod_bible_event_v4(text,text,timestamptz,integer,integer) to authenticated;

create or replace function public.admin_cancel_buklod_bible_event_v4(p_event_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.buklod_is_system_admin() then
  raise exception 'System Admin only' using errcode='42501';end if;
 update private.buklod_bible_v4_events set state='cancelled'
 where id=p_event_id and starts_at>now() and state='scheduled';
 return found;
end;
$$;
revoke all on function public.admin_cancel_buklod_bible_event_v4(uuid) from public,anon;
grant execute on function public.admin_cancel_buklod_bible_event_v4(uuid) to authenticated;

create or replace function public.join_my_buklod_bible_arena_v4(p_event_id uuid,p_ready boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ev record; existing record; n int;
begin
 if actor is null then raise exception 'Authentication required';end if;
 select * into ev from private.buklod_bible_v4_events where id=p_event_id for update;
 if not found or ev.kind<>'arena' or ev.state<>'scheduled' then raise exception 'Arena unavailable';end if;
 select * into existing from private.buklod_bible_v4_event_entries
 where event_id=ev.id and user_id=actor;
 if not found then
  if now()>=ev.starts_at then raise exception 'Registration closed';end if;
  select count(*) into n from private.buklod_bible_v4_event_entries where event_id=ev.id;
  if n>=ev.max_players then raise exception 'All contestant slots are taken';end if;
  insert into private.buklod_bible_v4_event_entries(event_id,user_id)
  values(ev.id,actor) returning * into existing;
 end if;
 if p_ready then
  if now()<ev.starts_at-interval '10 minutes' or now()>ev.starts_at then
   raise exception 'Ready check opens 10 minutes before start';end if;
  update private.buklod_bible_v4_event_entries set ready_at=coalesce(ready_at,now())
   where id=existing.id;
 end if;
 return jsonb_build_object('joined',true,'ready',p_ready or existing.ready_at is not null,
  'event_id',ev.id,'starts_at',ev.starts_at);
end;
$$;
revoke all on function public.join_my_buklod_bible_arena_v4(uuid,boolean) from public,anon;
grant execute on function public.join_my_buklod_bible_arena_v4(uuid,boolean) to authenticated;

create or replace function public.get_my_buklod_bible_events_v4()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ev record; response jsonb:='[]'::jsonb;
 my_entry record; players integer; ready_players integer; live boolean; prompts jsonb;
begin
 if actor is null then raise exception 'Authentication required';end if;
 for ev in select * from private.buklod_bible_v4_events
  where starts_at>=now()-interval '35 days' and starts_at<=now()+interval '45 days'
  order by starts_at desc limit 18
 loop
  if ev.kind='arena' and now()>=ev.ends_at and ev.state='scheduled' then
   perform private.buklod_bible_v4_finalize_arena(ev.id);
   select * into ev from private.buklod_bible_v4_events where id=ev.id;
  end if;
  select * into my_entry from private.buklod_bible_v4_event_entries
   where event_id=ev.id and user_id=actor;
  select count(*),count(*) filter(where ready_at is not null) into players,ready_players
   from private.buklod_bible_v4_event_entries where event_id=ev.id;
  live:=ev.state='scheduled' and now()>=ev.starts_at and now()<ev.ends_at
   and (ev.kind='flash' or ready_players>=3);
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'question',q.prompt,'options',q.options,
    'reference',q.scripture_reference,
    'round',case when array_position(ev.question_keys,q.id)<=4 then 1
      when array_position(ev.question_keys,q.id)<=8 then 2 else 3 end)
    order by array_position(ev.question_keys,q.id)),'[]'::jsonb) into prompts
  from private.buklod_bible_v4_questions q where live
   and (ev.kind='flash' or my_entry.ready_at is not null)
   and my_entry.submitted_at is null and q.id=any(ev.question_keys);
  response:=response||jsonb_build_array(jsonb_build_object(
   'id',ev.id,'title',ev.title,'kind',ev.kind,'difficulty',ev.difficulty,
   'starts_at',ev.starts_at,'ends_at',ev.ends_at,'state',ev.state,
   'live',live,'max_players',ev.max_players,'joined_count',players,'ready_count',ready_players,
   'joined',my_entry.id is not null,'ready',my_entry.ready_at is not null,
   'submitted',my_entry.submitted_at is not null,'score',my_entry.score,
   'rank',my_entry.winner_rank,'points',my_entry.points_awarded,
   'winners',case when ev.state='finalized' or now()>=ev.ends_at then
      (select coalesce(jsonb_agg(jsonb_build_object('rank',x.winner_rank,'points',x.points_awarded)
       order by x.winner_rank),'[]'::jsonb)
       from private.buklod_bible_v4_event_entries x where x.event_id=ev.id and x.winner_rank is not null)
      else null end,
   'questions',case when live then prompts else '[]'::jsonb end));
 end loop;
 return jsonb_build_object('events',response);
end;
$$;
revoke all on function public.get_my_buklod_bible_events_v4() from public,anon;
grant execute on function public.get_my_buklod_bible_events_v4() to authenticated;

create or replace function public.submit_my_buklod_bible_event_v4(p_event_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); ev record; en record; q record;
 answered integer:=0; score integer:=0; correct integer:=0;
 v_count integer; rank_slot integer; prize integer:=0; v_actual integer:=0;
begin
 if actor is null then raise exception 'Authentication required';end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object' then raise exception 'Answers required';end if;
 select * into ev from private.buklod_bible_v4_events where id=p_event_id for update;
 if not found or ev.state<>'scheduled' or now()<ev.starts_at or now()>=ev.ends_at then
  raise exception 'Challenge not live';end if;
 if ev.kind='arena' then
  select count(*) into v_count from private.buklod_bible_v4_event_entries
   where event_id=ev.id and ready_at is not null;
  if v_count<3 then raise exception 'Arena needs at least three ready players';end if;
  select * into en from private.buklod_bible_v4_event_entries where event_id=ev.id and user_id=actor;
  if not found or en.ready_at is null then raise exception 'Contestant not ready';end if;
 else
  insert into private.buklod_bible_v4_event_entries(event_id,user_id)
  values(ev.id,actor) on conflict(event_id,user_id) do nothing;
  select * into en from private.buklod_bible_v4_event_entries where event_id=ev.id and user_id=actor;
 end if;
 if en.submitted_at is not null then
  return jsonb_build_object('already_submitted',true,'score',en.score,'points',en.points_awarded);
 end if;
 if (select count(*) from jsonb_object_keys(p_answers))<>array_length(ev.question_keys,1) then
  raise exception 'Answer every question once';end if;
 for q in select x.id,x.correct_choice,ord.n
  from unnest(ev.question_keys) with ordinality ord(question_id,n)
  join private.buklod_bible_v4_questions x on x.id=ord.question_id
  order by ord.n
 loop
  if not(p_answers ? q.id) or jsonb_typeof(p_answers->q.id)<>'string'
    or upper(trim(p_answers->>q.id)) not in ('A','B','C','D') then
   raise exception 'Invalid event answer';end if;
  answered:=answered+1;
  if upper(trim(p_answers->>q.id))=q.correct_choice then
   correct:=correct+1;
   if ev.kind='arena' then
    score:=score+case when q.n<=4 then 10 when q.n<=8 then 15 else 20 end;
   else score:=1;end if;
  end if;
 end loop;
 if answered<>array_length(ev.question_keys,1) then raise exception 'Incomplete event answers';end if;
 update private.buklod_bible_v4_event_entries
 set answers=p_answers,submitted_at=now(),score=score where id=en.id;
 if ev.kind='flash' and correct=1 then
  select count(*)+1 into rank_slot from private.buklod_bible_v4_event_entries
   where event_id=ev.id and winner_rank is not null;
  if rank_slot<=3 then
   prize:=case ev.difficulty when 'easy' then 1 when 'medium' then 3 else 6 end;
   v_actual:=private.buklod_bible_v4_event_award(en.id,prize,
    'bible_flash_'||ev.difficulty,
    'bible_flash:'||(now() at time zone 'Asia/Manila')::date::text);
   -- One daily reward per user, even if multiple flash events occur.
   if v_actual>0 then
    update private.buklod_bible_v4_event_entries set winner_rank=rank_slot where id=en.id;
   end if;
  end if;
 end if;
 return jsonb_build_object('submitted',true,'score',score,'points',v_actual,
   'status',case when ev.kind='arena' then 'awaiting_final_results' else 'submitted' end);
end;
$$;
revoke all on function public.submit_my_buklod_bible_event_v4(uuid,jsonb) from public,anon;
grant execute on function public.submit_my_buklod_bible_event_v4(uuid,jsonb) to authenticated;
