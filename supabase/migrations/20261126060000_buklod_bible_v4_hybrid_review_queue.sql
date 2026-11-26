-- DEV ONLY: deploy after isolated PostgreSQL tests; both switches default OFF.
-- Existing V4 scoring/finalize RPC and historical rewards stay unchanged.
create table if not exists private.buklod_bible_hybrid_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 deterministic_settlement_enabled boolean not null default false,
 shadow_cache_enabled boolean not null default false,
 daily_calls integer not null default 20 check(daily_calls between 0 and 20),
 provider_pause_until timestamptz,
 provider_blocked boolean not null default false
);
insert into private.buklod_bible_hybrid_control(singleton) values(true) on conflict do nothing;
create table if not exists private.buklod_bible_hybrid_budget (
 day date primary key, reserved_calls integer not null default 0 check(reserved_calls>=0)
);
create table if not exists private.buklod_bible_hybrid_jobs (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references private.buklod_bible_v4_attempts(id) on delete cascade,
 question_id text not null references private.buklod_bible_v4_questions(id),
 source_snapshot jsonb not null,
 answer_hash text not null,
 baseline_units integer not null check(baseline_units between 0 and 1),
 status text not null default 'queued' check(status in ('queued','leased','candidate','no_change','unresolved','stale','settled')),
 tries integer not null default 0 check(tries between 0 and 3),
 available_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 result jsonb,
 deterministic_checked_at timestamptz,
 verified_model text,
 verified_at timestamptz,
 cache_origin_job_id uuid references private.buklod_bible_hybrid_jobs(id) on delete set null,
 created_at timestamptz not null default now(),
 unique(attempt_id,question_id)
);
create index if not exists buklod_bible_hybrid_jobs_queue_idx on private.buklod_bible_hybrid_jobs(status,available_at,created_at);
create index if not exists buklod_bible_hybrid_cache_lookup_idx on private.buklod_bible_hybrid_jobs(question_id,answer_hash,verified_model,verified_at desc) where verified_at is not null;
alter table private.buklod_bible_hybrid_control enable row level security;
alter table private.buklod_bible_hybrid_budget enable row level security;
alter table private.buklod_bible_hybrid_jobs enable row level security;
revoke all on private.buklod_bible_hybrid_control,private.buklod_bible_hybrid_budget,private.buklod_bible_hybrid_jobs from public,anon,authenticated;
create or replace function private.buklod_bible_hybrid_source(p_question_id text)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('question_id',q.id,'kind',q.kind,'question',q.prompt,'reference',q.scripture_reference,'rationale',q.rationale,'groups',case when q.kind='identification' then jsonb_build_array(q.answer_spec->'answers') else q.answer_spec->'groups' end,'policy','bible-hybrid-v1')
 from private.buklod_bible_v4_questions q
 where q.id=p_question_id and q.active and q.reviewed and q.kind in ('identification','enumeration')
$$;
revoke all on function private.buklod_bible_hybrid_source(text) from public,anon,authenticated;

create or replace function private.buklod_bible_hybrid_enqueue()
returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb; src jsonb; ans jsonb; units int;
begin
 if new.state<>'completed' or old.state='completed' then return new;end if;
 if not exists(select 1 from private.buklod_bible_hybrid_control where singleton and enabled) then return new;end if;
 if jsonb_typeof(new.review_items) is distinct from 'array' or jsonb_typeof(new.submitted_answers) is distinct from 'object' then return new;end if;
 for r in select value from jsonb_array_elements(new.review_items) loop
  if r->>'kind' not in ('enumeration','identification') or (r->>'earned_units') is null then continue;end if;
  units:=(r->>'earned_units')::int;
  if units not between 0 and 1 then continue;end if;
  src:=private.buklod_bible_hybrid_source(r->>'id');ans:=new.submitted_answers->(r->>'id');
  if src is null or ans is null or jsonb_typeof(src->'groups') is distinct from 'array' then continue;end if;
  if r->>'kind'='identification' and jsonb_typeof(ans) is distinct from 'string' then continue;end if;
  if r->>'kind'='enumeration' and (jsonb_typeof(ans) is distinct from 'array') then continue;end if;
  insert into private.buklod_bible_hybrid_jobs(attempt_id,question_id,source_snapshot,answer_hash,baseline_units)
  values(new.id,r->>'id',src,encode(sha256(convert_to(ans::text,'UTF8')),'hex'),units)
  on conflict(attempt_id,question_id) do nothing;
 end loop;
 return new;
exception when others then
 -- The optional second-look service must never prevent the existing quiz/reward completion.
 raise warning 'Bible hybrid enqueue unavailable: %',sqlstate; return new;
end;
$$;
revoke all on function private.buklod_bible_hybrid_enqueue() from public,anon,authenticated;
drop trigger if exists buklod_bible_hybrid_after_complete on private.buklod_bible_v4_attempts;
create trigger buklod_bible_hybrid_after_complete after update of state on private.buklod_bible_v4_attempts for each row execute function private.buklod_bible_hybrid_enqueue();

-- Service-only, bounded reservation: reserve two model calls before returning a job.
create or replace function public.buklod_bible_hybrid_claim()
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg record; j record; ans jsonb; token uuid; d date:=(now() at time zone 'Asia/Manila')::date; used int;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 select * into cfg from private.buklod_bible_hybrid_control where singleton for update;
 if not found or not cfg.enabled or cfg.daily_calls<2 or cfg.provider_blocked or coalesce(cfg.provider_pause_until>now(),false) then return null;end if;
 update private.buklod_bible_hybrid_jobs set status='unresolved',lease_id=null,lease_until=null
 where status='leased' and lease_until<=now() and tries>=3;
 select * into j from private.buklod_bible_hybrid_jobs
 where tries<3 and ((status='queued' and available_at<=now()) or (status='leased' and lease_until<=now()))
 order by created_at,id limit 1 for update skip locked;
 if not found then return null;end if;
 select submitted_answers->j.question_id into ans from private.buklod_bible_v4_attempts where id=j.attempt_id and state='completed';
 if ans is null or j.answer_hash is distinct from encode(sha256(convert_to(ans::text,'UTF8')),'hex')
   or j.source_snapshot is distinct from private.buklod_bible_hybrid_source(j.question_id) then
  update private.buklod_bible_hybrid_jobs set status='stale',lease_id=null,lease_until=null where id=j.id;return null;
 end if;
 insert into private.buklod_bible_hybrid_budget(day) values(d) on conflict do nothing;
 select reserved_calls into used from private.buklod_bible_hybrid_budget where day=d for update;
 if used+2>cfg.daily_calls then return null;end if;
 update private.buklod_bible_hybrid_budget set reserved_calls=reserved_calls+2 where day=d;
 token:=gen_random_uuid();
 update private.buklod_bible_hybrid_jobs set status='leased',tries=tries+1,lease_id=token,lease_until=now()+interval '5 minutes' where id=j.id;
 return jsonb_build_object('job_id',j.id,'lease_id',token,'source',j.source_snapshot,'answer',ans,'baseline_units',j.baseline_units);
end;
$$;
revoke all on function public.buklod_bible_hybrid_claim() from public,anon,authenticated;
grant execute on function public.buklod_bible_hybrid_claim() to service_role;

-- Shadow candidate receipt only. No BP, no quiz score mutation, no alias publication.
create or replace function public.buklod_bible_hybrid_record(p_job uuid,p_lease uuid,p_status text,p_units int,p_concepts jsonb,p_model text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare j record; n int; ans jsonb; expected int; matched int; v int;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if p_status not in ('candidate','no_change','unresolved','retry','quota_exhausted','provider_blocked') or p_status is null then raise exception 'Invalid outcome';end if;
 -- Same lock order as claim: control then job. Avoid deadlock during provider pause.
 perform 1 from private.buklod_bible_hybrid_control where singleton for update;
 select * into j from private.buklod_bible_hybrid_jobs where id=p_job and status='leased' and lease_id=p_lease and lease_until>now() for update;
 if not found then return false;end if;
 if not exists(select 1 from private.buklod_bible_hybrid_control where singleton and enabled) then return false;end if;
 select submitted_answers->j.question_id into ans from private.buklod_bible_v4_attempts where id=j.attempt_id and state='completed';
 if ans is null or j.answer_hash is distinct from encode(sha256(convert_to(ans::text,'UTF8')),'hex') or j.source_snapshot is distinct from private.buklod_bible_hybrid_source(j.question_id) then
  update private.buklod_bible_hybrid_jobs set status='stale',lease_id=null,lease_until=null where id=j.id;return false;
 end if;
 if p_status in ('quota_exhausted','provider_blocked') then
  -- Conservative 24h quota hold; do not consume a learner's retry allowance.
  -- Auth/model/configuration failures require verified operator recovery.
  update private.buklod_bible_hybrid_control set
   provider_pause_until=greatest(coalesce(provider_pause_until,now()),now()+interval '24 hours'),
   provider_blocked=provider_blocked or p_status='provider_blocked' where singleton;
  update private.buklod_bible_hybrid_jobs set status='queued',tries=greatest(tries-1,0),
   available_at=now()+interval '24 hours',lease_id=null,lease_until=null where id=j.id;
  return true;
 end if;
 if p_status='retry' then
  update private.buklod_bible_hybrid_jobs set status=case when tries>=3 then 'unresolved' else 'queued' end,available_at=now()+make_interval(mins=>tries*5),lease_id=null,lease_until=null where id=j.id;return true;
 end if;
 if p_status in ('candidate','no_change') then
  expected:=case when j.source_snapshot->>'kind'='identification' then 1 else 2 end;
  if jsonb_typeof(p_concepts) is distinct from 'array' then raise exception 'Invalid concepts';end if;
  if jsonb_array_length(p_concepts)<>expected then raise exception 'Invalid concept count';end if;
  if exists(select 1 from jsonb_array_elements(p_concepts) x where jsonb_typeof(x.value)<>'number' or (x.value #>> '{}') !~ '^-?[0-9]+$') then raise exception 'Invalid concept type';end if;
  n:=jsonb_array_length(j.source_snapshot->'groups');matched:=0;
  for v in select (value #>> '{}')::int from jsonb_array_elements(p_concepts) loop
   if v< -1 or v>=n or v is null then raise exception 'Invalid concept';end if;
   if v>=0 then matched:=matched+1;end if;
  end loop;
  if matched<>(select count(distinct value) from jsonb_array_elements(p_concepts) where value<>'-1'::jsonb) then raise exception 'Duplicate concept';end if;
  if p_units is distinct from (case when expected=1 then matched*2 else matched end) then raise exception 'Invalid units';end if;
  if (p_status='candidate' and p_units<=j.baseline_units) or (p_status='no_change' and p_units>j.baseline_units) then raise exception 'Invalid candidate delta';end if;
 else p_units:=null;p_concepts:=null;end if;
 if p_status in ('candidate','no_change') and (p_model is null or length(p_model)>100 or p_model !~ '^gemini-[a-zA-Z0-9.-]+$') then raise exception 'Verified model required';end if;
 update private.buklod_bible_hybrid_jobs set status=p_status,
 result=jsonb_build_object('units',p_units,'concepts',p_concepts,'policy','bible-hybrid-v1'),
 verified_model=case when p_status in ('candidate','no_change') then p_model else null end,
 verified_at=case when p_status in ('candidate','no_change') then now() else null end,
 lease_id=null,lease_until=null where id=j.id;
 return true;
end;
$$;
revoke all on function public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb,text) from public,anon,authenticated;
grant execute on function public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb,text) to service_role;

-- Full reviewed alias matching only, never a model-supplied score.
-- An enumeration needs two different answer fields and two different concepts.
create or replace function private.buklod_bible_hybrid_exact_units(p_source jsonb,p_answer jsonb)
returns int language plpgsql immutable set search_path='' as $$
declare answers jsonb; n int; score int;
begin
 if jsonb_typeof(p_source->'groups') is distinct from 'array' then return 0;end if;
 if jsonb_array_length(p_source->'groups') not between 1 and 32 then return 0;end if;
 if exists(select 1 from jsonb_array_elements(p_source->'groups') g where jsonb_typeof(g.value) is distinct from 'array') then return 0;end if;
 if p_source->>'kind'='identification' then
  if jsonb_typeof(p_answer) is distinct from 'string' then return 0;end if;
  answers:=jsonb_build_array(p_answer);n:=1;
 elsif p_source->>'kind'='enumeration' then
  if jsonb_typeof(p_answer) is distinct from 'array' then return 0;end if;
  answers:=p_answer;n:=2;
 else return 0;end if;
 if jsonb_array_length(answers)<>n then return 0;end if;
 if exists(select 1 from jsonb_array_elements(answers) a where jsonb_typeof(a.value) is distinct from 'string' or length(a.value #>> '{}')>120 or private.buklod_bible_v4_enum_normalize(a.value #>> '{}')='') then return 0;end if;
 if n=2 and private.buklod_bible_v4_enum_normalize(answers->>0)=private.buklod_bible_v4_enum_normalize(answers->>1) then return 0;end if;
 with edges as (
  select a.ordinality ai,g.ordinality gi
  from jsonb_array_elements_text(answers) with ordinality a(value,ordinality)
  cross join jsonb_array_elements(p_source->'groups') with ordinality g(value,ordinality)
  where exists(select 1 from jsonb_array_elements_text(g.value) z(v)
    where private.buklod_bible_v4_enum_normalize(z.v)=private.buklod_bible_v4_enum_normalize(a.value))
 )
 select case when n=1 then case when exists(select 1 from edges) then 2 else 0 end
  when exists(select 1 from edges e join edges f on e.ai<>f.ai and e.gi<>f.gi) then 2
  when exists(select 1 from edges) then 1 else 0 end into score;
 return score;
end;
$$;
revoke all on function private.buklod_bible_hybrid_exact_units(jsonb,jsonb) from public,anon,authenticated;

-- No provider credential needed. Service role only. Independent switch OFF.
-- Locks control -> job -> attempt; never accepts a user id, score, points or answer from caller.
create or replace function public.buklod_bible_hybrid_settle_exact()
returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; a record; q record; r record; rule record; ans jsonb; n int; old int; score int;
 review jsonb; credit int; desired int; bonus int:=0; original uuid; receipt uuid; k text; daykey text;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 perform 1 from private.buklod_bible_hybrid_control where singleton and enabled and deterministic_settlement_enabled for update;
 if not found then return jsonb_build_object('status','disabled');end if;
 select * into j from private.buklod_bible_hybrid_jobs where status in ('queued','candidate','unresolved','no_change') and deterministic_checked_at is null order by created_at,id limit 1 for update skip locked;
 if not found then return jsonb_build_object('status','idle');end if;
 update private.buklod_bible_hybrid_jobs set deterministic_checked_at=now() where id=j.id;
 select * into a from private.buklod_bible_v4_attempts where id=j.attempt_id and state='completed' for update;
 if not found then return jsonb_build_object('status','stale');end if;
 select * into q from private.buklod_bible_v4_questions where id=j.question_id and active and reviewed for share;
 ans:=a.submitted_answers->j.question_id;
 if not found or ans is null or j.answer_hash is distinct from encode(sha256(convert_to(ans::text,'UTF8')),'hex') or j.source_snapshot is distinct from private.buklod_bible_hybrid_source(j.question_id) then
  update private.buklod_bible_hybrid_jobs set status='stale' where id=j.id;
  return jsonb_build_object('status','stale');
 end if;
 n:=private.buklod_bible_hybrid_exact_units(j.source_snapshot,ans);
 if jsonb_typeof(a.review_items) is distinct from 'array' or a.score_units is null or a.points_awarded is null then return jsonb_build_object('status','inconsistent');end if;
 if (select count(*) from jsonb_array_elements(a.review_items) x where x.value->>'id'=j.question_id)<>1 then return jsonb_build_object('status','inconsistent');end if;
 select item,ordinal into r from jsonb_array_elements(a.review_items) with ordinality t(item,ordinal) where item->>'id'=j.question_id and item->>'kind'=q.kind;
 if not found then return jsonb_build_object('status','inconsistent');end if;
 old:=(r.item->>'earned_units')::int;
 if old is null or old not between 0 and 2 then return jsonb_build_object('status','inconsistent');end if;
 if n<=old then return jsonb_build_object('status','no_exact_improvement');end if;
 if jsonb_array_length(a.review_items)<>5 or (select count(distinct x.value->>'id') from jsonb_array_elements(a.review_items) x)<>5
 or exists(select 1 from jsonb_array_elements(a.review_items) x where coalesce(x.value->>'earned_units','') not in ('0','1','2'))
 or (select sum((x.value->>'earned_units')::int) from jsonb_array_elements(a.review_items) x) is distinct from a.score_units::bigint then
 return jsonb_build_object('status','inconsistent');end if;
 score:=a.score_units+n-old;
 if score not between 0 and 10 then return jsonb_build_object('status','inconsistent');end if;
 daykey:='bible_quiz:r3:'||a.local_date::text;
 -- Include all same-day original credits and all previously versioned corrections for this attempt.
 select coalesce(sum(l.points),0) into credit from public.buklod_points_ledger l where l.user_id=a.user_id and l.direction='credit' and (l.source_key=daykey or (l.source_key like 'bible_quiz:v4:%' and right(l.source_key,36)=a.id::text));
 if credit<>a.points_awarded or exists(select 1 from public.buklod_points_ledger l where l.user_id=a.user_id and (l.source_key=daykey or (l.source_key like 'bible_quiz:v4:%' and right(l.source_key,36)=a.id::text)) and (l.direction<>'credit' or l.activity_type<>'bible_quiz_'||a.difficulty)) then return jsonb_build_object('status','ledger_mismatch');end if;
 if a.ledger_id is not null and not exists(select 1 from public.buklod_points_ledger l where l.id=a.ledger_id and l.user_id=a.user_id and l.source_key=daykey and l.direction='credit' and l.activity_type='bible_quiz_'||a.difficulty) then return jsonb_build_object('status','ledger_mismatch');end if;
 if a.ledger_id is null and (credit<>0 or exists(select 1 from public.buklod_points_ledger l where l.user_id=a.user_id and l.source_key=daykey)) then return jsonb_build_object('status','ledger_mismatch');end if;
 select base_points,max_points_per_event,is_active into rule from public.buklod_point_rules where activity_type='bible_quiz_'||a.difficulty;
 if found and rule.is_active then
  desired:=least(private.buklod_bible_v4_points(a.difficulty,score),rule.base_points,coalesce(rule.max_points_per_event,12),12);
  bonus:=greatest(desired-credit,0);
 end if;
 original:=a.ledger_id;
 if bonus>0 then
  k:=case when original is null then daykey else 'bible_quiz:v4:hybrid-exact:'||j.question_id||':'||a.id::text end;
  insert into public.buklod_points_ledger(user_id,direction,points,activity_type,source_key,description,awarded_by)
  values(a.user_id,'credit',bonus,'bible_quiz_'||a.difficulty,k,'Reviewed Bible Quiz equivalent answer correction',a.user_id)
  on conflict(user_id,source_key) do nothing returning id into receipt;
  if receipt is null then raise exception 'Correction ledger conflict';end if;
  original:=coalesce(original,receipt);
 end if;
 review:=jsonb_set(a.review_items,array[(r.ordinal-1)::text],jsonb_set(jsonb_set(r.item,'{earned_units}',to_jsonb(n)),'{correct_answer}',q.answer_spec));
 update private.buklod_bible_v4_attempts set review_items=review,score_units=score,points_awarded=credit+bonus,ledger_id=original where id=a.id;
 update private.buklod_bible_hybrid_jobs set status='settled',result=jsonb_build_object('units',n,'old_units',old,'bonus',bonus,'policy','reviewed_exact_v1') where id=j.id;
 begin
  insert into public.notifications(user_id,title,body,kind,data) values(a.user_id,'Bible Quiz: inayos ang iyong marka','Naitama ang iyong quiz score sa '||score||'/10. '||case when bonus>0 then '+'||bonus||' BP ang naidagdag.' else 'Walang karagdagang BP.' end,'bible_quiz_result',jsonb_build_object('attempt_id',a.id,'score_units',score,'points_added',bonus,'route','/faith/bible-quiz','correction_version','hybrid_exact_v1'));
 exception when others then raise warning 'Optional correction notification failed: %',sqlstate;end;
 return jsonb_build_object('status','settled','units_added',n-old,'points_added',bonus);
end;
$$;
revoke all on function public.buklod_bible_hybrid_settle_exact() from public,anon,authenticated;
grant execute on function public.buklod_bible_hybrid_settle_exact() to service_role;

-- Same-account, unchanged source, exact stored answer, same model, direct full verdict only.
-- Cache hit is a shadow candidate, never a score or BP mutation. Reuse cannot renew TTL.
create or replace function public.buklod_bible_hybrid_reuse_candidate(p_model text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare j record; origin record; target_job record;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if p_model is null or length(p_model)>100 or p_model !~ '^gemini-[a-zA-Z0-9.-]+$' then return jsonb_build_object('status','disabled');end if;
 perform 1 from private.buklod_bible_hybrid_control where singleton and enabled and shadow_cache_enabled for update;
 if not found then return jsonb_build_object('status','disabled');end if;
 select target.id as target_id,prev.id as origin_id into j
 from (select * from private.buklod_bible_hybrid_jobs where status='queued' order by created_at,id limit 100) target
 join private.buklod_bible_v4_attempts ta on ta.id=target.attempt_id and ta.state='completed'
 join private.buklod_bible_hybrid_jobs prev on prev.question_id=target.question_id and prev.answer_hash=target.answer_hash
 and prev.source_snapshot=target.source_snapshot and prev.status='candidate'
 and prev.verified_model=p_model and prev.verified_at>now()-interval '7 days' and prev.verified_at<=now()
 and prev.cache_origin_job_id is null and prev.result->>'units'='2' and prev.result->>'policy'='bible-hybrid-v1'
 join private.buklod_bible_v4_attempts pa on pa.id=prev.attempt_id and pa.state='completed' and pa.user_id=ta.user_id and pa.id<>ta.id
 where target.source_snapshot=private.buklod_bible_hybrid_source(target.question_id)
 and (ta.submitted_answers->target.question_id)=(pa.submitted_answers->prev.question_id)
 and target.answer_hash=encode(sha256(convert_to((ta.submitted_answers->target.question_id)::text,'UTF8')),'hex')
 order by target.created_at,target.id,prev.verified_at desc limit 1;
 if not found then return jsonb_build_object('status','miss');end if;
 -- All queue writers share the control lock. Recheck current rows and source.
 select * into origin from private.buklod_bible_hybrid_jobs where id=j.origin_id for share;
 select * into target_job from private.buklod_bible_hybrid_jobs where id=j.target_id and status='queued' for update;
 if not found or origin.id is null or origin.status<>'candidate' or origin.verified_model is distinct from p_model
 or origin.verified_at is null or origin.verified_at<=now()-interval '7 days' or origin.verified_at>now()
 or origin.cache_origin_job_id is not null or origin.result->>'units' is distinct from '2'
 or origin.result->>'policy' is distinct from 'bible-hybrid-v1'
 or origin.question_id is distinct from target_job.question_id or origin.answer_hash is distinct from target_job.answer_hash
 or origin.source_snapshot is distinct from target_job.source_snapshot then return jsonb_build_object('status','miss');end if;
 perform 1 from private.buklod_bible_v4_questions where id=target_job.question_id and active and reviewed for share;
 if not found or target_job.source_snapshot is distinct from private.buklod_bible_hybrid_source(target_job.question_id) then return jsonb_build_object('status','miss');end if;
 if not exists(select 1 from private.buklod_bible_v4_attempts t join private.buklod_bible_v4_attempts o on o.id=origin.attempt_id and o.user_id=t.user_id
 where t.id=target_job.attempt_id and t.state='completed' and o.state='completed'
 and (t.submitted_answers->target_job.question_id)=(o.submitted_answers->target_job.question_id)
 and target_job.answer_hash=encode(sha256(convert_to((t.submitted_answers->target_job.question_id)::text,'UTF8')),'hex'))
 then return jsonb_build_object('status','miss');end if;
 if exists(select 1 from private.buklod_bible_hybrid_jobs z
 join private.buklod_bible_v4_attempts za on za.id=z.attempt_id
 join private.buklod_bible_v4_attempts ta on ta.id=target_job.attempt_id and za.user_id=ta.user_id
 where z.question_id=target_job.question_id and z.answer_hash=target_job.answer_hash and z.source_snapshot=target_job.source_snapshot
 and z.verified_model=p_model and z.verified_at>now()-interval '7 days' and z.verified_at<=now()
 and z.cache_origin_job_id is null and z.status in ('candidate','no_change')
 and z.result->'concepts' is distinct from origin.result->'concepts') then return jsonb_build_object('status','conflict');end if;
 update private.buklod_bible_hybrid_jobs set status='candidate',result=origin.result||jsonb_build_object('cache_reused',true),
 cache_origin_job_id=origin.id,verified_at=null,verified_model=null,lease_id=null,lease_until=null where id=target_job.id;
 return jsonb_build_object('status','cache_hit');
end;
$$;
revoke all on function public.buklod_bible_hybrid_reuse_candidate(text) from public,anon,authenticated;
grant execute on function public.buklod_bible_hybrid_reuse_candidate(text) to service_role;
