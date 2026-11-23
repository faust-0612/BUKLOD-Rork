-- DEV-only. Mentor-entered mentee names are requests, NEVER verified attendance.
-- Only a System Admin may bind a request to an active BUKLOD member.
create table if not exists public.buklod_mentor_mentee_link_requests_v1 (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id),
  mentee_name text not null check (length(btrim(mentee_name)) between 3 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'assigned', 'rejected')),
  disciple_id uuid references public.profiles(id),
  review_note text,
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.buklod_mentor_mentee_link_requests_v1 enable row level security;
revoke all on table public.buklod_mentor_mentee_link_requests_v1
  from public, anon, authenticated;
create unique index if not exists buklod_mentee_link_pending_unique_v1
  on public.buklod_mentor_mentee_link_requests_v1
  (mentor_id, lower(btrim(mentee_name))) where status='pending';
create index if not exists buklod_mentee_link_queue_v1
  on public.buklod_mentor_mentee_link_requests_v1(status, created_at);

create or replace function public.request_my_mentee_link_v1(p_mentee_name text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  clean_name text := btrim(pg_catalog.regexp_replace(coalesce(p_mentee_name,''), '\s+', ' ', 'g'));
  existing uuid;
  req_id uuid;
  my_name text;
begin
  if actor is null or not public.has_capability(actor,'mentor') then
    raise exception 'Active mentor permission required' using errcode='42501';
  end if;
  select p.full_name into my_name from public.profiles p
  where p.id=actor and p.is_active=true and p.role::text <> 'system_admin';
  if not found or exists (
    select 1 from public.buklod_foundation_protected_principals pp
    where pp.user_id=actor and pp.protected=true
  ) then
    raise exception 'Active verified mentor required' using errcode='42501';
  end if;
  if length(clean_name) not between 3 and 120
    or lower(clean_name)=lower(coalesce(my_name,'')) then
    raise exception 'Enter the actual mentee full name (3 to 120 characters)';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mentee-link:'||actor::text,0));
  select r.id into existing
  from public.buklod_mentor_mentee_link_requests_v1 r
  where r.mentor_id=actor and r.status='pending'
    and lower(btrim(r.mentee_name))=lower(clean_name);
  if found then
    return pg_catalog.jsonb_build_object('request_id',existing,'already_requested',true);
  end if;
  if (select count(*) from public.buklod_mentor_mentee_link_requests_v1 r
      where r.mentor_id=actor and r.status='pending') >= 5
    or (select count(*) from public.buklod_mentor_mentee_link_requests_v1 r
      where r.mentor_id=actor and r.created_at>now()-interval '1 day') >= 10 then
    raise exception 'Mentee request limit reached. Wait for review before adding more.';
  end if;
  insert into public.buklod_mentor_mentee_link_requests_v1(mentor_id,mentee_name)
  values(actor,clean_name) returning id into req_id;
  return pg_catalog.jsonb_build_object('request_id',req_id,'already_requested',false);
end;
$$;
revoke all on function public.request_my_mentee_link_v1(text) from public,anon;
grant execute on function public.request_my_mentee_link_v1(text) to authenticated;

create or replace function public.get_my_mentee_link_requests_v1()
returns table(id uuid,mentee_name text,status text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Sign in required' using errcode='42501';
  end if;
  return query select r.id,r.mentee_name,r.status,r.created_at
  from public.buklod_mentor_mentee_link_requests_v1 r
  where r.mentor_id=actor order by r.created_at desc limit 30;
end;
$$;
revoke all on function public.get_my_mentee_link_requests_v1() from public,anon;
grant execute on function public.get_my_mentee_link_requests_v1() to authenticated;

create or replace function public.admin_pending_mentee_link_requests_v1()
returns table(id uuid,mentor_id uuid,mentor_name text,mentee_name text,created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
begin
  if (select auth.uid()) is null or not public.is_system_admin() then
    raise exception 'System Admin permission required' using errcode='42501';
  end if;
  return query select r.id,r.mentor_id,p.full_name,r.mentee_name,r.created_at
  from public.buklod_mentor_mentee_link_requests_v1 r
  join public.profiles p on p.id=r.mentor_id
  where r.status='pending'
  order by r.created_at asc limit 100;
end;
$$;
revoke all on function public.admin_pending_mentee_link_requests_v1() from public,anon;
grant execute on function public.admin_pending_mentee_link_requests_v1() to authenticated;

create or replace function public.admin_review_mentee_link_request_v1(
  p_request_id uuid, p_disciple_id uuid, p_approve boolean, p_review_note text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := (select auth.uid());
  req public.buklod_mentor_mentee_link_requests_v1%rowtype;
  candidate public.profiles%rowtype;
  mentor_active boolean;
  clean_note text := btrim(coalesce(p_review_note,''));
begin
  if actor is null or not public.is_system_admin() then
    raise exception 'System Admin permission required' using errcode='42501';
  end if;
  if p_request_id is null or p_approve is null
    or length(clean_note) not between 12 and 500 then
    raise exception 'Request, decision, and 12 to 500 character review note required';
  end if;
  select * into req from public.buklod_mentor_mentee_link_requests_v1
  where id=p_request_id for update;
  if not found then raise exception 'Mentee link request unavailable'; end if;
  if req.status<>'pending' then
    if req.status='assigned' and p_approve=true
      and req.disciple_id=p_disciple_id then
      return pg_catalog.jsonb_build_object('assigned',true,'already_reviewed',true);
    end if;
    if req.status='rejected' and p_approve=false then
      return pg_catalog.jsonb_build_object('assigned',false,'already_reviewed',true);
    end if;
    raise exception 'This request has already been reviewed';
  end if;
  if p_approve then
    if p_disciple_id is null or p_disciple_id=req.mentor_id then
      raise exception 'Choose a real learner different from the mentor';
    end if;
    select p.is_active into mentor_active from public.profiles p
    where p.id=req.mentor_id and p.role::text<>'system_admin';
    if not found or mentor_active is distinct from true
      or not public.has_capability(req.mentor_id,'mentor')
      or exists(select 1 from public.user_roles ur
                where ur.user_id=req.mentor_id and ur.role='system_admin' and ur.is_active=true)
      or exists(select 1 from public.buklod_foundation_protected_principals pp
                where pp.user_id=req.mentor_id and pp.protected=true) then
      raise exception 'Mentor is not an active authorized mentor' using errcode='42501';
    end if;
    select * into candidate from public.profiles where id=p_disciple_id;
    if not found or candidate.is_active is distinct from true
      or candidate.role::text='system_admin'
      or exists(select 1 from public.user_roles ur
                where ur.user_id=p_disciple_id and ur.role='system_admin' and ur.is_active=true)
      or exists(select 1 from public.buklod_foundation_protected_principals pp
                where pp.user_id=p_disciple_id and pp.protected=true) then
      raise exception 'Learner must be an active unprotected member';
    end if;
    insert into public.mentor_assignments(mentor_id,disciple_id,is_active)
    values(req.mentor_id,p_disciple_id,true)
    on conflict(mentor_id,disciple_id) do update set is_active=true;
  end if;
  update public.buklod_mentor_mentee_link_requests_v1 r
  set status=case when p_approve then 'assigned' else 'rejected' end,
      disciple_id=case when p_approve then p_disciple_id else null end,
      reviewed_by=actor,review_note=clean_note,reviewed_at=now()
  where r.id=req.id;
  return pg_catalog.jsonb_build_object(
    'assigned',p_approve,'already_reviewed',false,'request_id',req.id);
end;
$$;
revoke all on function public.admin_review_mentee_link_request_v1(uuid,uuid,boolean,text)
  from public,anon;
grant execute on function public.admin_review_mentee_link_request_v1(uuid,uuid,boolean,text)
  to authenticated;
