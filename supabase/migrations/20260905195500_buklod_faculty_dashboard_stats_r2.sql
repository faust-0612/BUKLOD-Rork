create or replace function public.buklod_education_faculty_dashboard_stats_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with assigned as (
    select c.id
    from public.buklod_education_classroom_faculty f
    join public.buklod_education_classrooms c on c.id=f.classroom_id
    where f.faculty_user_id=auth.uid()
      and upper(f.status)='ACTIVE'
      and f.ended_at is null
      and c.status='ACTIVE'
      and public.buklod_is_active_faculty_focus_user_v1(auth.uid())
  )
  select jsonb_build_object(
    'classrooms',(select count(*) from assigned),
    'students',(
      select count(*)
      from public.buklod_education_enrollments e
      where e.classroom_id in (select id from assigned)
        and upper(e.status)='ACTIVE'
    ),
    'pending_grades',(
      select count(*)
      from public.buklod_education_grades g
      where g.classroom_id in (select id from assigned)
        and upper(g.status) in ('DRAFT','COMPUTED','REVIEWED')
    ),
    'open_attendance',(
      select count(*)
      from public.buklod_education_attendance_sessions s
      where s.classroom_id in (select id from assigned)
        and s.closed_at is null
    )
  );
$$;

revoke all on function public.buklod_education_faculty_dashboard_stats_v1() from public, anon;
grant execute on function public.buklod_education_faculty_dashboard_stats_v1() to authenticated;
