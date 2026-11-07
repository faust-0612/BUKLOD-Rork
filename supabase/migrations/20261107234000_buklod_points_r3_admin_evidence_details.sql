-- R3 verification detail: Admin must see WHO, WHEN, WHERE and WHAT before approval.
-- Only authorized System Admin RPCs expose names and private evidence paths.
create or replace function public.admin_get_buklod_r2_mentor_evidence_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'session_id',s.id,'lesson',l.title,'status',s.status,'mentor_id',s.mentor_id,
 'mentor_name',(select p.full_name from public.profiles p where p.id=s.mentor_id),
 'session_date',s.session_date,'session_location',s.session_location,
 'participant_count',s.participant_count,'mentor_notes',s.mentor_notes,
 'attendees',(select coalesce(jsonb_agg(jsonb_build_object('id',a.user_id,'name',p.full_name)
  order by p.full_name),'[]'::jsonb)
  from public.mentor_session_attendees a join public.profiles p on p.id=a.user_id
  where a.session_id=s.id),
 'photo_path',e.photo_path,'submitted_at',e.submitted_at)
 order by s.created_at desc),'[]'::jsonb) into result
 from (select * from public.mentor_teaching_sessions
       where created_at>=now()-interval '90 days'
       order by created_at desc limit 100) s
 join public.learning_lessons l on l.id=s.lesson_id
 left join private.buklod_r2_mentor_session_evidence e on e.session_id=s.id;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_mentor_evidence_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_mentor_evidence_v1() to authenticated;

create or replace function public.admin_get_buklod_home_checkin_queue_r3()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
 raise exception 'System Admin required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'event_id',c.event_id,'member_id',c.user_id,'member_name',p.full_name,
 'status',c.status,'checked_in_at',c.checked_in_at,
 'event',e.title,'place',e.location,'starts_at',e.starts_at,
 'cluster',s.name) order by c.checked_in_at desc),'[]'::jsonb) into result
 from (select * from public.buklod_home_event_checkins_r3
 where status='pending' order by checked_in_at desc limit 100) c
 join public.attendance_events e on e.id=c.event_id
 join public.buklod_scopes s on s.id=c.scope_id
 join public.profiles p on p.id=c.user_id;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_home_checkin_queue_r3() from public,anon;
grant execute on function public.admin_get_buklod_home_checkin_queue_r3() to authenticated;
