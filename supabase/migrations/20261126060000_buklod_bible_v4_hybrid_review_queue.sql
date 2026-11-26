-- DEV ONLY: deploy after isolated PostgreSQL tests; both switches default OFF.
-- Existing V4 scoring/finalize RPC and historical rewards stay unchanged.
create table if not exists private.buklod_bible_hybrid_control (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 daily_calls integer not null default 20 check(daily_calls between 0 and 100)
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
 status text not null default 'queued' check(status in ('queued','leased','candidate','no_change','unresolved','stale')),
 tries integer not null default 0 check(tries between 0 and 3),
 available_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 result jsonb,
 created_at timestamptz not null default now(),
 unique(attempt_id,question_id)
);
create index if not exists buklod_bible_hybrid_jobs_queue_idx on private.buklod_bible_hybrid_jobs(status,available_at,created_at);
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
 if not found or not cfg.enabled or cfg.daily_calls<2 then return null;end if;
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
create or replace function public.buklod_bible_hybrid_record(p_job uuid,p_lease uuid,p_status text,p_units int,p_concepts jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare j record; n int; ans jsonb; expected int; matched int; v int;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if p_status not in ('candidate','no_change','unresolved','retry') or p_status is null then raise exception 'Invalid outcome';end if;
 select * into j from private.buklod_bible_hybrid_jobs where id=p_job and status='leased' and lease_id=p_lease and lease_until>now() for update;
 if not found then return false;end if;
 if not exists(select 1 from private.buklod_bible_hybrid_control where singleton and enabled) then return false;end if;
 select submitted_answers->j.question_id into ans from private.buklod_bible_v4_attempts where id=j.attempt_id and state='completed';
 if ans is null or j.answer_hash is distinct from encode(sha256(convert_to(ans::text,'UTF8')),'hex') or j.source_snapshot is distinct from private.buklod_bible_hybrid_source(j.question_id) then
  update private.buklod_bible_hybrid_jobs set status='stale',lease_id=null,lease_until=null where id=j.id;return false;
 end if;
 if p_status='retry' then
  update private.buklod_bible_hybrid_jobs set status=case when tries>=3 then 'unresolved' else 'queued' end,available_at=now()+make_interval(mins=>tries*5),lease_id=null,lease_until=null where id=j.id;return true;
 end if;
 if p_status in ('candidate','no_change') then
  expected:=case when j.source_snapshot->>'kind'='identification' then 1 else 2 end;
  if jsonb_typeof(p_concepts) is distinct from 'array' then raise exception 'Invalid concepts';end if;
  if jsonb_array_length(p_concepts)<>expected then raise exception 'Invalid concept count';end if;
  n:=jsonb_array_length(j.source_snapshot->'groups');matched:=0;
  for v in select (value #>> '{}')::int from jsonb_array_elements(p_concepts) loop
   if v< -1 or v>=n or v is null then raise exception 'Invalid concept';end if;
   if v>=0 then matched:=matched+1;end if;
  end loop;
  if matched<>(select count(distinct value) from jsonb_array_elements(p_concepts) where value<>'-1'::jsonb) then raise exception 'Duplicate concept';end if;
  if p_units is distinct from (case when expected=1 then matched*2 else matched end) then raise exception 'Invalid units';end if;
  if (p_status='candidate' and p_units<=j.baseline_units) or (p_status='no_change' and p_units>j.baseline_units) then raise exception 'Invalid candidate delta';end if;
 else p_units:=null;p_concepts:=null;end if;
 update private.buklod_bible_hybrid_jobs set status=p_status,result=jsonb_build_object('units',p_units,'concepts',p_concepts,'policy','bible-hybrid-v1'),lease_id=null,lease_until=null where id=j.id;
 return true;
end;
$$;
revoke all on function public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb) from public,anon,authenticated;
grant execute on function public.buklod_bible_hybrid_record(uuid,uuid,text,int,jsonb) to service_role;
