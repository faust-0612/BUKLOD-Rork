-- BUKLOD Academy of Higher Learning / SALIKSIK research bridge.
-- DEV-only; activate only after source provenance, human academic review and staging QA.
create table if not exists public.buklod_academy_research_submissions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 research_key text not null,
 research_type text not null check(research_type in
  ('design','exegesis','comparative','bachelors_capstone','masters_capstone')),
 title text not null check(length(title) between 10 and 180),
 method text not null check(length(method) between 10 and 1500),
 bible_references text not null check(length(bible_references) between 10 and 1500),
 paper_text text not null check(length(paper_text) between 300 and 30000),
 status text not null default 'SUBMITTED' check(status in ('SUBMITTED','REWORK','VERIFIED','REJECTED')),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 reviewer_note text,
 citations_verified boolean not null default false,
 originality_checked boolean not null default false,
 rubric_score integer check(rubric_score between 0 and 100),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,research_key)
);
create index if not exists buklod_academy_research_review_idx
 on public.buklod_academy_research_submissions(status,created_at);
alter table public.buklod_academy_research_submissions enable row level security;
revoke all on public.buklod_academy_research_submissions from anon,authenticated;
grant select on public.buklod_academy_research_submissions to authenticated;
create policy academy_research_read_own on public.buklod_academy_research_submissions
 for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.buklod_academy_submit_research_v1(
 p_key text,p_type text,p_title text,p_method text,p_references text,p_paper text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); result uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not exists(select 1 from public.buklod_university_config where enabled and singleton)
  then raise exception 'Academy research is not enabled';end if;
 if p_type not in ('design','exegesis','comparative','bachelors_capstone','masters_capstone')
  then raise exception 'Invalid research format';end if;
 if p_key is null or p_key !~ '^[a-zA-Z0-9_:-]{8,80}$' then raise exception 'Invalid research identity';end if;
 if length(trim(coalesce(p_title,''))) not between 10 and 180 or
    length(trim(coalesce(p_method,''))) not between 10 and 1500 or
    length(trim(coalesce(p_references,''))) not between 10 and 1500 or
    length(trim(coalesce(p_paper,''))) not between 300 and 30000
  then raise exception 'Incomplete research paper or methodology';end if;
 if (select count(*) from public.buklod_academy_research_submissions
  where user_id=actor and status='SUBMITTED')>=5 then raise exception 'Finish pending reviews before submitting more';end if;
 insert into public.buklod_academy_research_submissions(
  user_id,research_key,research_type,title,method,bible_references,paper_text)
 values(actor,p_key,p_type,trim(p_title),trim(p_method),trim(p_references),trim(p_paper))
 on conflict (user_id,research_key) do update set
  research_type=excluded.research_type,title=excluded.title,method=excluded.method,
  bible_references=excluded.bible_references,paper_text=excluded.paper_text,
  status='SUBMITTED',reviewed_by=null,reviewed_at=null,reviewer_note=null,
  citations_verified=false,originality_checked=false,rubric_score=null,updated_at=now()
 where public.buklod_academy_research_submissions.status='REWORK'
 returning id into result;
 if result is null then raise exception 'Research key already submitted or verified';end if;
 return result;
end;
$$;

create or replace function public.buklod_academy_review_research_v1(
 p_submission uuid,p_approved boolean,p_score integer,p_citations_verified boolean,
 p_originality_checked boolean,p_feedback text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := (select auth.uid()); item record; amount integer;
begin
 if actor is null or not public.is_system_admin() then
  raise exception 'System Admin authorization required' using errcode='42501';end if;
 if not exists(select 1 from public.buklod_university_config where enabled and singleton)
  then raise exception 'Academy review is not enabled';end if;
 if length(trim(coalesce(p_feedback,'')))<50 or length(p_feedback)>2000
  then raise exception 'Substantive reviewer feedback required';end if;
 if p_score is null or p_score<0 or p_score>100 then raise exception 'Valid rubric grade required';end if;
 select * into item from public.buklod_academy_research_submissions
  where id=p_submission for update;
 if not found or item.status<>'SUBMITTED' then raise exception 'Submission is not pending review';end if;
 if item.user_id=actor then raise exception 'Cannot review your own research';end if;
 if p_approved and (p_score<80 or p_citations_verified is distinct from true
    or p_originality_checked is distinct from true)
  then raise exception 'Verification conditions incomplete';end if;
 amount:=case item.research_type when 'design' then 40 when 'exegesis' then 60
  when 'comparative' then 80 when 'bachelors_capstone' then 100
  when 'masters_capstone' then 150 else 0 end;
 update public.buklod_academy_research_submissions
  set status=case when p_approved then 'VERIFIED' else 'REWORK' end,
  reviewed_by=actor,reviewed_at=now(),reviewer_note=trim(p_feedback),
  citations_verified=coalesce(p_citations_verified,false),
  originality_checked=coalesce(p_originality_checked,false),rubric_score=p_score,updated_at=now()
  where id=p_submission;
 if p_approved then
  insert into public.buklod_university_uc_ledger(
   user_id,source_module,source_key,uc,verified_at,policy_version)
  values(item.user_id,'saliksik_research',item.research_key,amount,now(),'BU-ACADEMY-5')
  on conflict(user_id,source_module,source_key) do nothing;
 end if;
 return jsonb_build_object('reviewed',true,'approved',p_approved,'uc',case when p_approved then amount else 0 end);
end;
$$;

create or replace function public.buklod_academy_admin_research_queue_v1(
 p_status text default 'SUBMITTED',p_limit integer default 25)
returns table(id uuid,member_name text,research_type text,title text,
 method text,bible_references text,paper_text text,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501';end if;
 return query select r.id,coalesce(nullif(p.full_name,''),'Member')::text,
 r.research_type,r.title,r.method,r.bible_references,r.paper_text,r.created_at
 from public.buklod_academy_research_submissions r
 left join public.profiles p on p.id=r.user_id
 where r.status=coalesce(nullif(p_status,''),'SUBMITTED')
 order by r.created_at asc limit least(50,greatest(1,coalesce(p_limit,25)));
end;
$$;
revoke all on function public.buklod_academy_submit_research_v1(text,text,text,text,text,text),
 public.buklod_academy_review_research_v1(uuid,boolean,integer,boolean,boolean,text),
 public.buklod_academy_admin_research_queue_v1(text,integer) from public,anon;
grant execute on function public.buklod_academy_submit_research_v1(text,text,text,text,text,text),
 public.buklod_academy_review_research_v1(uuid,boolean,integer,boolean,boolean,text),
 public.buklod_academy_admin_research_queue_v1(text,integer) to authenticated;
