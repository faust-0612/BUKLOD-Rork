-- BUKLOD Academy SALIKSIK automated faculty: additive state, secure service finalizer.
-- Existing manual admin approval is revoked. Feature remains OFF pending staging QA.
alter table public.buklod_academy_research_submissions
  drop constraint if exists buklod_academy_research_submissions_status_check;
alter table public.buklod_academy_research_submissions
  add constraint buklod_academy_research_submissions_status_check
  check(status in ('SUBMITTED','REVIEWING','REWORK','VERIFIED','REJECTED'));
alter table public.buklod_academy_research_submissions
  add column if not exists review_token uuid,
  add column if not exists review_started_at timestamptz,
  add column if not exists ai_model text,
  add column if not exists feedback_json jsonb not null default '{}'::jsonb,
  add column if not exists content_hash text,
  add column if not exists review_attempts integer not null default 0;

create index if not exists buklod_academy_research_retry_idx
  on public.buklod_academy_research_submissions(status,review_started_at);

create table if not exists public.buklod_academy_research_review_history (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null references public.buklod_academy_research_submissions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 attempt_number integer not null,
 decision text not null check(decision in ('VERIFIED','REWORK')),
 score integer not null check(score between 0 and 100),
 rubric jsonb not null default '{}'::jsonb,
 feedback jsonb not null default '{}'::jsonb,
 evidence_hash text not null,
 model text not null,
 created_at timestamptz not null default now(),
 unique(submission_id,attempt_number)
);
alter table public.buklod_academy_research_review_history enable row level security;
revoke all on public.buklod_academy_research_review_history from anon,authenticated;
grant select on public.buklod_academy_research_review_history to authenticated;
create policy buklod_academy_research_review_history_own
 on public.buklod_academy_research_review_history for select to authenticated
 using(user_id=(select auth.uid()));

-- The original manual review RPC must not be executable after automated faculty promotion.
revoke all on function public.buklod_academy_review_research_v1(uuid,boolean,integer,boolean,boolean,text)
 from public,anon,authenticated;
drop function if exists public.buklod_academy_review_research_v1(uuid,boolean,integer,boolean,boolean,text);

create or replace function public.buklod_academy_claim_research_review_v2(
 p_id uuid,p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rec record;
begin
 if (select auth.role()) <> 'service_role' then
  raise exception 'Trusted Academy reviewer required' using errcode='42501';
 end if;
 if p_id is null or p_token is null then raise exception 'Missing review token';end if;
 if not exists(select 1 from public.buklod_university_config where singleton and enabled)
   then raise exception 'Academy is not enabled';end if;
 update public.buklod_academy_research_submissions
 set status='REVIEWING',review_token=p_token,review_started_at=now(),
     review_attempts=review_attempts+1,updated_at=now()
 where id=p_id and (
   status='SUBMITTED'
   or (status='REVIEWING' and review_started_at<now()-interval '2 minutes')
 )
 returning id,user_id,research_key,research_type,title,method,bible_references,paper_text,
     review_attempts into rec;
 if not found then return jsonb_build_object('claimed',false);end if;
 return jsonb_build_object('claimed',true,'id',rec.id,'user_id',rec.user_id,
 'research_key',rec.research_key,'research_type',rec.research_type,
 'title',rec.title,'method',rec.method,'bible_references',rec.bible_references,
 'paper_text',rec.paper_text,'attempt',rec.review_attempts);
end;
$$;

create or replace function public.buklod_academy_finalize_research_review_v2(
 p_id uuid,p_token uuid,p_decision text,p_score integer,
 p_rubric jsonb,p_feedback jsonb,p_model text,p_evidence_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rec record; amount integer; inserted integer:=0;
begin
 if (select auth.role()) <> 'service_role' then
  raise exception 'Trusted Academy reviewer required' using errcode='42501';end if;
 if p_decision not in ('VERIFIED','REWORK') or p_score not between 0 and 100
   or length(coalesce(p_model,'')) not between 3 and 100
   or p_evidence_hash !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_rubric)<>'object' or jsonb_typeof(p_feedback)<>'object'
 then raise exception 'Invalid automated assessment payload';end if;
 update public.buklod_academy_research_submissions set
  status=p_decision,review_token=null,review_started_at=null,reviewed_at=now(),
  reviewer_note=left(coalesce(p_feedback->>'headline',''),500),
  ai_model=p_model,
  feedback_json=p_feedback,citations_verified=true,originality_checked=true,
  rubric_score=p_score,content_hash=p_evidence_hash,updated_at=now()
 where id=p_id and review_token=p_token and status='REVIEWING'
 returning user_id,research_key,research_type,review_attempts into rec;
 if not found then return jsonb_build_object('finalized',false,'reason','review_claim_expired');end if;
 insert into public.buklod_academy_research_review_history
  (submission_id,user_id,attempt_number,decision,score,rubric,feedback,evidence_hash,model)
 values(p_id,rec.user_id,rec.review_attempts,p_decision,p_score,p_rubric,p_feedback,p_evidence_hash,p_model)
 on conflict(submission_id,attempt_number) do nothing;
 amount:=case rec.research_type when 'design' then 40 when 'exegesis' then 60
  when 'comparative' then 80 when 'bachelors_capstone' then 100
  when 'masters_capstone' then 150 else 0 end;
 if p_decision='VERIFIED' then
  insert into public.buklod_university_uc_ledger
   (user_id,source_module,source_key,uc,verified_at,policy_version)
  values(rec.user_id,'saliksik_research',rec.research_key,amount,now(),'BU-ACADEMY-5')
  on conflict(user_id,source_module,source_key) do nothing;
  get diagnostics inserted = row_count;
 end if;
 return jsonb_build_object('finalized',true,'approved',p_decision='VERIFIED',
   'new_uc',case when inserted=1 then amount else 0 end,'score',p_score);
end;
$$;

create or replace function public.buklod_academy_release_research_review_v2(
 p_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if (select auth.role()) <> 'service_role' then
  raise exception 'Trusted Academy reviewer required' using errcode='42501';end if;
 update public.buklod_academy_research_submissions
 set status='SUBMITTED',review_token=null,review_started_at=null,updated_at=now()
 where id=p_id and review_token=p_token and status='REVIEWING';
 return found;
end;
$$;
revoke all on function
 public.buklod_academy_claim_research_review_v2(uuid,uuid),
 public.buklod_academy_finalize_research_review_v2(uuid,uuid,text,integer,jsonb,jsonb,text,text),
 public.buklod_academy_release_research_review_v2(uuid,uuid)
 from public,anon,authenticated;
grant execute on function
 public.buklod_academy_claim_research_review_v2(uuid,uuid),
 public.buklod_academy_finalize_research_review_v2(uuid,uuid,text,integer,jsonb,jsonb,text,text),
 public.buklod_academy_release_research_review_v2(uuid,uuid) to service_role;

create or replace function public.buklod_academy_my_research_v2(p_limit integer default 20)
returns table(id uuid,research_key text,research_type text,title text,status text,
 rubric_score integer,feedback jsonb,ai_model text,created_at timestamptz,updated_at timestamptz)
 language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then raise exception 'Sign in required' using errcode='42501';end if;
 return query
 select r.id,r.research_key,r.research_type,r.title,r.status,r.rubric_score,
 r.feedback_json,r.ai_model,r.created_at,r.updated_at
 from public.buklod_academy_research_submissions r where r.user_id=(select auth.uid())
 order by r.updated_at desc limit least(50,greatest(1,coalesce(p_limit,20)));
end;$$;
revoke all on function public.buklod_academy_my_research_v2(integer) from public,anon;
grant execute on function public.buklod_academy_my_research_v2(integer) to authenticated;

-- Bounded AI spend per authenticated learner. Reserve requests transactionally.
create table if not exists public.buklod_academy_ai_usage (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null check(action in ('review','coach')),
 created_at timestamptz not null default now()
);
create index if not exists buklod_academy_ai_usage_idx on public.buklod_academy_ai_usage(user_id,action,created_at desc);
alter table public.buklod_academy_ai_usage enable row level security;
revoke all on public.buklod_academy_ai_usage from anon,authenticated;

create or replace function public.buklod_academy_reserve_ai_request_v2(p_user uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
declare max_requests integer; current_requests integer;
begin
 if (select auth.role()) <> 'service_role' then
  raise exception 'Trusted reviewer required' using errcode='42501';
 end if;
 if p_user is null or p_action not in ('review','coach') then return false;end if;
 max_requests:=case when p_action='review' then 12 else 8 end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_user::text||':'||p_action));
 select count(*)::integer into current_requests
 from public.buklod_academy_ai_usage
 where user_id=p_user and action=p_action and created_at>now()-interval '1 hour';
 if current_requests>=max_requests then return false;end if;
 insert into public.buklod_academy_ai_usage(user_id,action) values(p_user,p_action);
 return true;
end;$$;
revoke all on function public.buklod_academy_reserve_ai_request_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.buklod_academy_reserve_ai_request_v2(uuid,text) to service_role;
