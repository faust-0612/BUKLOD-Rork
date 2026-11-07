-- Real mentor-assigned learner roster; transactional session report + attendee assignment.
create table if not exists private.buklod_r2_mentor_report_requests(
 mentor_id uuid not null references public.profiles(id),
 request_key text not null,
 session_id uuid not null unique references public.mentor_teaching_sessions(id),
 created_at timestamptz not null default now(),
 primary key(mentor_id,request_key),
 constraint buklod_r2_mentor_request_key_size check(length(request_key) between 16 and 100)
);
revoke all on private.buklod_r2_mentor_report_requests from public,anon,authenticated;

create or replace function public.report_my_mentor_teaching_with_roster_r2(
 p_lesson_id uuid,p_attendee_ids uuid[],p_notes text,p_request_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 request_key text := trim(coalesce(p_request_key,''));
 clean_note text := trim(coalesce(p_notes,''));
 unique_count integer;
 valid_count integer;
 session_id uuid;
begin
 if actor is null or not public.has_capability(actor,'mentor') then
   raise exception 'Assigned Mentor capability required' using errcode='42501';
 end if;
 if length(request_key) not between 16 and 100 then
   raise exception 'Valid request key required';
 end if;
 if length(clean_note)<20 or length(clean_note)>2000 then
   raise exception 'Teaching notes of 20-2000 characters required';
 end if;
 select count(distinct u) into unique_count from unnest(p_attendee_ids) as u;
 if unique_count<1 or unique_count>50 then
   raise exception 'Choose 1 to 50 assigned mentees';
 end if;
 select count(distinct ma.disciple_id) into valid_count
 from public.mentor_assignments ma
 join public.profiles p on p.id=ma.disciple_id and p.is_active=true
 where ma.mentor_id=actor and ma.is_active=true and ma.disciple_id=any(p_attendee_ids);
 if valid_count<>unique_count then
   raise exception 'One or more learners are not active assigned mentees';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(actor::text||':mentoring_report:'||request_key,0));
 select q.session_id into session_id from private.buklod_r2_mentor_report_requests q
 where q.mentor_id=actor and q.request_key=request_key;
 if session_id is not null then
   return jsonb_build_object('session_id',session_id,'already_recorded',true);
 end if;
 session_id:=public.report_mentor_teaching_session(
   p_lesson_id,(now() at time zone 'Asia/Manila')::date,unique_count,clean_note);
 perform public.mentor_set_session_attendees(session_id,
   (select array_agg(distinct u) from unnest(p_attendee_ids) as u));
 insert into private.buklod_r2_mentor_report_requests(mentor_id,request_key,session_id)
 values(actor,request_key,session_id);
 return jsonb_build_object('session_id',session_id,'already_recorded',false,
   'attendee_count',unique_count);
end;
$$;
revoke all on function public.report_my_mentor_teaching_with_roster_r2(uuid,uuid[],text,text)
 from public,anon;
grant execute on function public.report_my_mentor_teaching_with_roster_r2(uuid,uuid[],text,text)
 to authenticated;

-- New-photo-policy mentor sessions must also have real registered attendees.
create or replace function private.buklod_r2_guard_mentor_approval_photo()
returns trigger language plpgsql security definer set search_path=''
as $$
declare started timestamptz;
begin
 if new.status='approved' and old.status is distinct from 'approved' then
   select effective_at into started from private.buklod_r2_reward_rollout
    where key='mentor_photo_required';
   if started is not null and new.created_at>=started then
     if not exists(
      select 1 from private.buklod_r2_mentor_session_evidence e
      join storage.objects o on o.bucket_id='buklod-mentoring-evidence'
       and o.name=e.photo_path
      where e.session_id=new.id and e.mentor_id=new.mentor_id
     ) then
       raise exception 'Mentor photo evidence required before reward approval';
     end if;
     if not exists(select 1 from public.mentor_session_attendees a
        where a.session_id=new.id and a.user_id<>new.mentor_id) then
       raise exception 'At least one registered learner required before mentor reward approval';
     end if;
   end if;
 end if;
 return new;
end;
$$;
