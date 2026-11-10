-- Mentor report R4: attach makes the session reviewable, resubmission is explicit,
-- private evidence remains owner/admin scoped, and review status is visible to the mentor.
-- Historical approved reports and existing point ledger entries are untouched.
create or replace function public.attach_my_mentor_session_photo_r2(
 p_session_id uuid,p_photo_path text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=(select auth.uid());
 row_rec record;
 previous_path text;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select id,mentor_id,status into row_rec
 from public.mentor_teaching_sessions
 where id=p_session_id for update;
 if not found or row_rec.mentor_id<>actor then
   raise exception 'Mentor session unavailable' using errcode='42501';
 end if;
 if row_rec.status<>'reported' then
   raise exception 'Photo locked during Admin review; wait for a correction request';
 end if;
 if p_photo_path is null or
   p_photo_path !~ ('^'||actor::text||'/'||p_session_id::text||'/[A-Za-z0-9_-]+[.](jpg|jpeg|png|webp)$') then
   raise exception 'Invalid mentor evidence photo path';
 end if;
 if not exists(select 1 from storage.objects o
   where o.bucket_id='buklod-mentoring-evidence' and o.name=p_photo_path) then
   raise exception 'Uploaded mentor photo not found';
 end if;
 select photo_path into previous_path
 from private.buklod_r2_mentor_session_evidence
 where session_id=p_session_id for update;
 insert into private.buklod_r2_mentor_session_evidence(session_id,mentor_id,photo_path)
 values(p_session_id,actor,p_photo_path)
 on conflict(session_id) do update
  set photo_path=excluded.photo_path,submitted_at=now();
 -- The R2 implementation only stored the image, leaving "reported" rows invisible
 -- to the R3 System Admin queue. Submit to that queue in the SAME transaction.
 update public.mentor_teaching_sessions set status='pending_admin'
 where id=p_session_id and mentor_id=actor and status='reported';
 return jsonb_build_object(
   'attached',true,'session_id',p_session_id,'status','pending_admin',
   'previous_photo_path',
   case when previous_path is distinct from p_photo_path then previous_path else null end);
end;
$$;
revoke all on function public.attach_my_mentor_session_photo_r2(uuid,text) from public,anon;
grant execute on function public.attach_my_mentor_session_photo_r2(uuid,text) to authenticated;

-- Once submitted, a photo is immutable until the Admin returns the report for
-- correction. Otherwise a reviewer could view photo A and approve photo B.
drop policy if exists "Mentor photo upload own path R2" on storage.objects;
create policy "Mentor photo upload own path R2" on storage.objects for insert
to authenticated with check (
 bucket_id='buklod-mentoring-evidence'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
 and exists(
  select 1 from public.mentor_teaching_sessions s
  where s.id::text=(storage.foldername(name))[2]
   and s.mentor_id=(select auth.uid()) and s.status='reported'
 )
);
drop policy if exists "Mentor photo delete own R2" on storage.objects;
create policy "Mentor photo delete own R2" on storage.objects for delete
to authenticated using (
 bucket_id='buklod-mentoring-evidence'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(
  select 1 from public.mentor_teaching_sessions s
  where s.id::text=(storage.foldername(name))[2]
   and s.mentor_id=(select auth.uid()) and s.status='reported'
 )
);

-- Retain the original reviewer decision when a rejected report is corrected.
-- This table is private: no client selects, and no existing ledger row is touched.
create table if not exists private.buklod_r4_mentor_revision_audit(
 id bigint generated always as identity primary key,
 session_id uuid not null references public.mentor_teaching_sessions(id) on delete cascade,
 mentor_id uuid not null references public.profiles(id),
 original_reviewer uuid,
 original_reviewed_at timestamptz,
 original_admin_note text,
 original_location text,
 original_notes text,
 original_photo_path text,
 reopened_at timestamptz not null default now()
);
alter table private.buklod_r4_mentor_revision_audit enable row level security;
revoke all on private.buklod_r4_mentor_revision_audit from public,anon,authenticated;

-- One mentor may correct THEIR rejected session, but cannot reopen an approved
-- or rewarded session. A new evidence image is required before reentering review.
create or replace function public.revise_my_rejected_mentor_session_r4(
 p_session_id uuid,p_location text,p_notes text,p_attendee_ids uuid[])
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=(select auth.uid());
 row_rec record;
 old_photo text;
 clean_location text:=trim(coalesce(p_location,''));
 clean_notes text:=trim(coalesce(p_notes,''));
 unique_count integer;
 valid_count integer;
begin
 if actor is null or not public.has_capability(actor,'mentor') then
   raise exception 'Assigned Mentor required' using errcode='42501';
 end if;
 if length(clean_location) not between 4 and 180 then
   raise exception 'Location must be 4-180 characters';
 end if;
 if length(clean_notes) not between 20 and 2000 then
   raise exception 'Teaching summary must be 20-2000 characters';
 end if;
 select count(distinct attendee) into unique_count from unnest(p_attendee_ids) attendee;
 if unique_count not between 1 and 50 or
    coalesce(array_length(p_attendee_ids,1),0)<>unique_count then
   raise exception 'Choose 1 to 50 distinct assigned attendees';
 end if;
 select count(distinct ma.disciple_id) into valid_count
 from public.mentor_assignments ma
 join public.profiles p on p.id=ma.disciple_id and p.is_active=true
 where ma.mentor_id=actor and ma.is_active=true
   and ma.disciple_id=any(p_attendee_ids);
 if valid_count<>unique_count then
   raise exception 'Only active assigned mentees may be reported';
 end if;
 select id,mentor_id,status,admin_id,admin_note,admin_reviewed_at,
   session_location,mentor_notes into row_rec
 from public.mentor_teaching_sessions
 where id=p_session_id for update;
 if not found or row_rec.mentor_id<>actor or row_rec.status<>'rejected' then
   raise exception 'Only your rejected reports may be revised' using errcode='42501';
 end if;
 if exists(select 1 from public.buklod_points_ledger
   where user_id=actor and source_key='mentor_session:'||p_session_id::text) then
   raise exception 'Credited mentoring sessions cannot be reopened';
 end if;
 select photo_path into old_photo
 from private.buklod_r2_mentor_session_evidence where session_id=p_session_id;
 insert into private.buklod_r4_mentor_revision_audit(
  session_id,mentor_id,original_reviewer,original_reviewed_at,
  original_admin_note,original_location,original_notes,original_photo_path)
 values(
  p_session_id,actor,row_rec.admin_id,row_rec.admin_reviewed_at,
  row_rec.admin_note,row_rec.session_location,row_rec.mentor_notes,old_photo);
 delete from private.buklod_r2_mentor_session_evidence
 where session_id=p_session_id;
 update public.mentor_teaching_sessions
 set status='reported',session_location=clean_location,mentor_notes=clean_notes,
   admin_id=null,admin_reviewed_at=null,admin_note=null
 where id=p_session_id;
 perform public.mentor_set_session_attendees(p_session_id,p_attendee_ids);
 return jsonb_build_object('session_id',p_session_id,'status','reported',
  'attendee_count',unique_count,'previous_photo_path',old_photo);
end;
$$;
revoke all on function public.revise_my_rejected_mentor_session_r4(uuid,text,text,uuid[]) from public,anon;
grant execute on function public.revise_my_rejected_mentor_session_r4(uuid,text,text,uuid[]) to authenticated;

-- Only current user sees session details, their own review feedback, and a path
-- to their own private evidence. Award status derives from the immutable ledger.
create or replace function public.get_my_mentor_photo_tasks_r2()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'session_id',s.id,'session_date',s.session_date,'status',s.status,
   'lesson',l.title,'location',s.session_location,'notes',s.mentor_notes,
   'participant_count',s.participant_count,
   'attendee_ids',(select coalesce(jsonb_agg(a.user_id order by a.user_id),'[]'::jsonb)
      from public.mentor_session_attendees a where a.session_id=s.id),
   'admin_note',case when s.status in ('approved','rejected') then s.admin_note else null end,
   'reviewed_at',s.admin_reviewed_at,
   'has_photo',(e.session_id is not null and o.id is not null),
   'photo_path',case when o.id is not null then e.photo_path else null end,
   'points_credited',coalesce((
    select sum(p.points) from public.buklod_points_ledger p
    where p.user_id=s.mentor_id and p.source_key='mentor_session:'||s.id::text
   ),0)
 ) order by s.created_at desc),'[]'::jsonb)
 from (
  select * from public.mentor_teaching_sessions
  where mentor_id=(select auth.uid())
    and created_at>=now()-interval '180 days'
  order by created_at desc limit 120
 ) s
 join public.learning_lessons l on l.id=s.lesson_id
 left join private.buklod_r2_mentor_session_evidence e on e.session_id=s.id
 left join storage.objects o on o.bucket_id='buklod-mentoring-evidence'
    and o.name=e.photo_path
$$;
revoke all on function public.get_my_mentor_photo_tasks_r2() from public,anon;
grant execute on function public.get_my_mentor_photo_tasks_r2() to authenticated;

-- Queue first shows unreviewed reports so the latest finalized reports cannot
-- displace pending ones when review volume is high. Admin permissions unchanged.
create or replace function public.admin_get_buklod_r2_mentor_evidence_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'session_id',s.id,'lesson',l.title,'status',s.status,'mentor_id',s.mentor_id,
  'mentor_name',(select p.full_name from public.profiles p where p.id=s.mentor_id),
  'session_date',s.session_date,'session_location',s.session_location,
  'participant_count',s.participant_count,'mentor_notes',s.mentor_notes,
  'attendees',(select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.user_id,'name',p.full_name) order by p.full_name),'[]'::jsonb)
    from public.mentor_session_attendees a join public.profiles p on p.id=a.user_id
    where a.session_id=s.id),
  'photo_path',e.photo_path,'submitted_at',e.submitted_at)
  order by case when s.status in ('reported','pending_admin') then 0 else 1 end,
     s.created_at desc),'[]'::jsonb) into result
 from (
   select * from public.mentor_teaching_sessions
   where created_at>=now()-interval '180 days'
   order by case when status in ('reported','pending_admin') then 0 else 1 end,
     created_at desc limit 200
 ) s
 join public.learning_lessons l on l.id=s.lesson_id
 left join private.buklod_r2_mentor_session_evidence e on e.session_id=s.id;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_mentor_evidence_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_mentor_evidence_v1() to authenticated;

-- Recovery: pre-R4 attachments already have private evidence but never moved
-- to pending_admin. Migrate only unreviewed reported rows with a real object.
update public.mentor_teaching_sessions s set status='pending_admin'
from private.buklod_r2_mentor_session_evidence e
join storage.objects o on o.bucket_id='buklod-mentoring-evidence'
 and o.name=e.photo_path
where s.id=e.session_id and s.mentor_id=e.mentor_id and s.status='reported';
