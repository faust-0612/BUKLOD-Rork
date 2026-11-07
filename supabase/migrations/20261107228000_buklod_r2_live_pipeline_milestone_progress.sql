-- Member-facing measurable milestone progress. Metrics do not mint points.
-- Thresholds are transparent R2 milestone targets and always require evidence review.
create or replace function public.get_my_buklod_r2_milestone_progress_v1()
returns jsonb language sql stable security definer set search_path=''
as $$
with a as (
 select (select count(*) from public.buklod_abc_growth_progress p
  where p.user_id=(select auth.uid())) as abc_completed,
 (select count(*) from public.mentor_teaching_sessions s
  where s.mentor_id=(select auth.uid()) and s.status='approved') as mentor_approved,
 (select count(*) from private.buklod_kingdom_level_progress_v1 g
  where g.user_id=(select auth.uid()) and g.first_cleared_at is not null) as kingdom_cleared,
 (select count(*) from public.buklod_points_ledger l
  join public.attendance_events e on e.id=l.source_id
  join public.buklod_scopes sc on sc.id=e.scope_id
  where l.user_id=(select auth.uid())
   and l.activity_type='scope_attendance' and l.direction='credit'
   and upper(sc.scope_type)='CLUSTER') as cluster_attended,
 (select count(*) from public.buklod_points_ledger l
  where l.user_id=(select auth.uid()) and l.direction='credit'
   and l.activity_type in ('community_helpful_dugtong','community_challenge_complete',
      'verified_volunteer_service','ministry_activity')) as community_contributions
)
select jsonb_build_object(
 'as_of',now(),'source','verified existing BUKLOD database records',
 'bonus_approval','Evidence and System Admin review remain mandatory',
 'bible_scholar',jsonb_build_object('completed',abc_completed,'target',28,'basis','ABC verified lesson completions'),
 'faithful_mentor',jsonb_build_object('completed',mentor_approved,'target',4,'basis','Admin-approved learning teaching sessions'),
 'kingdom_champion',jsonb_build_object('completed',kingdom_cleared,'target',20,'basis','Recorded Kingdom levels; client score not independently attested'),
 'community_builder',jsonb_build_object('recorded_contributions',community_contributions,
   'cluster_attendance_events',cluster_attended,
   'basis','Indicative contributions only; actual service project requires separately verified evidence')
) from a where (select auth.uid()) is not null
$$;
revoke all on function public.get_my_buklod_r2_milestone_progress_v1() from public,anon;
grant execute on function public.get_my_buklod_r2_milestone_progress_v1() to authenticated;

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
    'daily_attempts',(select count(*) from private.buklod_r2_bible_quiz_attempts
      where created_at>=now()-interval '30 days'),
    'completed',(select count(*) from private.buklod_r2_bible_quiz_attempts
      where completed_at>=now()-interval '30 days'),
    'rewarded',(select count(*) from private.buklod_r2_bible_quiz_attempts
      where completed_at>=now()-interval '30 days' and points_awarded>0)),
  'attendance',jsonb_build_object(
    'cluster_present_or_late_records',(select count(*) from public.attendance_records r
      join public.attendance_events e on e.id=r.event_id
      join public.buklod_scopes s on s.id=e.scope_id
      where r.checked_in_at>=now()-interval '30 days' and r.status in ('present','late')
      and upper(s.scope_type)='CLUSTER'),
    'scope_points_credits',(select count(*) from public.buklod_points_ledger l
      where l.created_at>=now()-interval '30 days' and l.direction='credit'
        and l.activity_type='scope_attendance')),
  'mentoring',jsonb_build_object(
    'reported',(select count(*) from public.mentor_teaching_sessions s
      where s.created_at>=now()-interval '30 days'),
    'approved',(select count(*) from public.mentor_teaching_sessions s
      where s.admin_reviewed_at>=now()-interval '30 days' and s.status='approved'),
    'pending_pastor',(select count(*) from public.mentor_teaching_sessions s
      where s.status='reported'),
    'pending_admin',(select count(*) from public.mentor_teaching_sessions s
      where s.status='pending_admin'))
 ) into result;
 return result;
end;
$$;
revoke all on function public.admin_get_buklod_r2_pipeline_monitor_v1() from public,anon;
grant execute on function public.admin_get_buklod_r2_pipeline_monitor_v1() to authenticated;
