-- R3 pipeline totals include Check In Today records separately from legacy Attendance events.
-- Existing admin dashboard fields preserved for compatibility.
create or replace function public.admin_get_buklod_r2_pipeline_monitor_v1()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if (select auth.uid()) is null or not public.is_system_admin() then
  raise exception 'System Admin required' using errcode='42501';
 end if;
 select jsonb_build_object(
 'as_of',now(),'window','last_30_days',
 'bible_quiz',jsonb_build_object(
   'daily_attempts',(select count(*) from private.buklod_r2_bible_quiz_attempts where created_at>=now()-interval '30 days'),
   'completed',(select count(*) from private.buklod_r2_bible_quiz_attempts where completed_at>=now()-interval '30 days'),
   'rewarded',(select count(*) from private.buklod_r2_bible_quiz_attempts where completed_at>=now()-interval '30 days' and points_awarded>0)),
 'attendance',jsonb_build_object(
   'cluster_present_or_late_records',(select count(*) from public.attendance_records r
     join public.attendance_events e on e.id=r.event_id join public.buklod_scopes s on s.id=e.scope_id
     where r.checked_in_at>=now()-interval '30 days' and r.status in ('present','late') and s.scope_type='CLUSTER'),
   'scope_points_credits',(select count(*) from public.buklod_points_ledger l
     where l.created_at>=now()-interval '30 days' and l.direction='credit' and l.activity_type='scope_attendance'),
   'home_checkins',(select count(*) from public.buklod_home_event_checkins_r3 c
      where c.checked_in_at>=now()-interval '30 days'),
   'home_pending',(select count(*) from public.buklod_home_event_checkins_r3 c where c.status='pending'),
   'home_approved',(select count(*) from public.buklod_home_event_checkins_r3 c
     where c.checked_in_at>=now()-interval '30 days' and c.status='approved'),
   'home_rejected',(select count(*) from public.buklod_home_event_checkins_r3 c
     where c.checked_in_at>=now()-interval '30 days' and c.status='rejected'),
   'home_rewarded',(select count(*) from public.buklod_home_event_checkins_r3 c
     where c.checked_in_at>=now()-interval '30 days' and c.ledger_id is not null)),
 'mentoring',jsonb_build_object(
   'reported',(select count(*) from public.mentor_teaching_sessions s where s.created_at>=now()-interval '30 days'),
   'approved',(select count(*) from public.mentor_teaching_sessions s
     where s.admin_reviewed_at>=now()-interval '30 days' and s.status='approved'),
   'pending_pastor',(select count(*) from public.mentor_teaching_sessions s where s.status='reported'),
   'pending_admin',(select count(*) from public.mentor_teaching_sessions s where s.status='pending_admin'))
 ) into result;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_pipeline_monitor_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_pipeline_monitor_v1() to authenticated;
