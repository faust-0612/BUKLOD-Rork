-- Mentoring teaching-session photo evidence, tied to existing lesson and approved mentor workflow.
-- New sessions only: historical approvals and balances remain intact.
create table if not exists private.buklod_r2_reward_rollout(
 key text primary key, effective_at timestamptz not null default now()
);
insert into private.buklod_r2_reward_rollout(key) values('mentor_photo_required')
on conflict(key) do nothing;
revoke all on private.buklod_r2_reward_rollout from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('buklod-mentoring-evidence','buklod-mentoring-evidence',false,5242880,
 array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do nothing;

drop policy if exists "Mentor photo upload own path R2" on storage.objects;
create policy "Mentor photo upload own path R2" on storage.objects for insert
to authenticated with check (
 bucket_id='buklod-mentoring-evidence'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);
drop policy if exists "Mentor photo read own or admin R2" on storage.objects;
create policy "Mentor photo read own or admin R2" on storage.objects for select
to authenticated using (
 bucket_id='buklod-mentoring-evidence'
 and ((storage.foldername(name))[1]=(select auth.uid())::text
 or public.is_system_admin())
);
drop policy if exists "Mentor photo delete own R2" on storage.objects;
create policy "Mentor photo delete own R2" on storage.objects for delete
to authenticated using (
 bucket_id='buklod-mentoring-evidence'
 and (storage.foldername(name))[1]=(select auth.uid())::text
);

create table if not exists private.buklod_r2_mentor_session_evidence(
 session_id uuid primary key references public.mentor_teaching_sessions(id) on delete cascade,
 mentor_id uuid not null references public.profiles(id),
 photo_path text not null,
 submitted_at timestamptz not null default now(),
 constraint buklod_r2_mentor_photo_path_check check(length(photo_path) between 30 and 240)
);
revoke all on private.buklod_r2_mentor_session_evidence from public,anon,authenticated;

create or replace function public.attach_my_mentor_session_photo_r2(
 p_session_id uuid,p_photo_path text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); row_rec record;
begin
 if actor is null then raise exception 'Authentication required';end if;
 select id,mentor_id,status,created_at into row_rec from public.mentor_teaching_sessions
 where id=p_session_id for update;
 if not found or row_rec.mentor_id<>actor then
   raise exception 'Mentor session unavailable' using errcode='42501';
 end if;
 if row_rec.status in ('approved','rejected') then
   raise exception 'Reviewed mentoring session cannot be changed';
 end if;
 if p_photo_path is null or p_photo_path !~ ('^'||actor::text||'/'||p_session_id::text||'/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$') then
   raise exception 'Invalid mentor evidence photo path';
 end if;
 if not exists(select 1 from storage.objects o
   where o.bucket_id='buklod-mentoring-evidence' and o.name=p_photo_path) then
   raise exception 'Uploaded mentor photo not found';
 end if;
 insert into private.buklod_r2_mentor_session_evidence(session_id,mentor_id,photo_path)
 values(p_session_id,actor,p_photo_path)
 on conflict(session_id) do update
   set photo_path=excluded.photo_path,submitted_at=now();
 return jsonb_build_object('attached',true,'session_id',p_session_id);
end;
$$;
revoke all on function public.attach_my_mentor_session_photo_r2(uuid,text) from public,anon;
grant execute on function public.attach_my_mentor_session_photo_r2(uuid,text) to authenticated;

create or replace function private.buklod_r2_guard_mentor_approval_photo()
returns trigger language plpgsql security definer set search_path=''
as $$
declare started timestamptz;
begin
 if new.status='approved' and old.status is distinct from 'approved' then
   select effective_at into started from private.buklod_r2_reward_rollout where key='mentor_photo_required';
   if started is not null and new.created_at>=started and not exists (
     select 1 from private.buklod_r2_mentor_session_evidence e
     join storage.objects o on o.bucket_id='buklod-mentoring-evidence'
      and o.name=e.photo_path
     where e.session_id=new.id and e.mentor_id=new.mentor_id
   ) then
     raise exception 'Mentor photo evidence required before reward approval';
   end if;
 end if;
 return new;
end;
$$;
drop trigger if exists buklod_r2_mentor_photo_approval_guard on public.mentor_teaching_sessions;
create trigger buklod_r2_mentor_photo_approval_guard
before update of status on public.mentor_teaching_sessions
for each row execute function private.buklod_r2_guard_mentor_approval_photo();

create or replace function public.get_my_mentor_photo_tasks_r2()
returns jsonb language sql stable security definer set search_path=''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
 'session_id',s.id,'session_date',s.session_date,'status',s.status,
 'lesson',l.title,'has_photo',(e.session_id is not null)
 ) order by s.created_at desc),'[]'::jsonb)
from public.mentor_teaching_sessions s
join public.learning_lessons l on l.id=s.lesson_id
left join private.buklod_r2_mentor_session_evidence e on e.session_id=s.id
where s.mentor_id=(select auth.uid()) and s.created_at>=now()-interval '180 days'
$$;
revoke all on function public.get_my_mentor_photo_tasks_r2() from public,anon;
grant execute on function public.get_my_mentor_photo_tasks_r2() to authenticated;
