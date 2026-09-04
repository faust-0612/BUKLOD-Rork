-- BUKLOD Classroom R1 - term-aware attendance -> gradebook integration.

alter table public.buklod_education_attendance_sessions
  add column if not exists term_key text;

update public.buklod_education_attendance_sessions
set term_key = 'PRELIM'
where term_key is null or btrim(term_key) = '';

alter table public.buklod_education_attendance_sessions
  alter column term_key set default 'PRELIM';
alter table public.buklod_education_attendance_sessions
  alter column term_key set not null;

alter table public.buklod_education_attendance_sessions
  drop constraint if exists buklod_education_attendance_sessions_term_key_check;
alter table public.buklod_education_attendance_sessions
  add constraint buklod_education_attendance_sessions_term_key_check
  check (term_key in ('PRELIM','MIDTERM','SEMIFINALS','FINALS'));

create index if not exists idx_buklod_education_attendance_sessions_class_term
  on public.buklod_education_attendance_sessions(classroom_id, term_key, opened_at);

create or replace function public.buklod_education_sync_attendance_session_to_gradebook_v1(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.buklod_education_attendance_sessions%rowtype;
  v_category_id uuid;
  v_grade_item_id uuid;
  v_rows integer := 0;
  v_title text;
begin
  select * into v_session
  from public.buklod_education_attendance_sessions
  where id = p_session_id;

  if v_session.id is null then raise exception 'Attendance session not found.'; end if;
  if not public.buklod_education_is_faculty_owner_v2(v_session.classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;
  if v_session.closed_at is null then
    raise exception 'Close the attendance session before syncing it to the gradebook.';
  end if;

  select gc.id into v_category_id
  from public.buklod_education_grade_categories gc
  where gc.classroom_id = v_session.classroom_id
    and gc.term_key = v_session.term_key
    and gc.category_type = 'ATTENDANCE'
  order by gc.created_at
  limit 1;

  if v_category_id is null then
    select gc.id into v_category_id
    from public.buklod_education_grade_categories gc
    where gc.classroom_id = v_session.classroom_id
      and gc.term_key = v_session.term_key
      and lower(gc.name) like '%attendance%'
    order by gc.created_at
    limit 1;
  end if;

  if v_category_id is null then
    raise exception 'No Attendance grade category exists for %.', v_session.term_key;
  end if;

  v_title := 'Attendance ' || to_char(v_session.opened_at at time zone 'Asia/Manila', 'YYYY-MM-DD');

  insert into public.buklod_education_grade_items(
    classroom_id, title, category, points_possible, created_by, category_id,
    item_type, source_system, source_ref, instructions, term_key
  ) values (
    v_session.classroom_id, v_title, 'Attendance', 100, auth.uid(), v_category_id,
    'ATTENDANCE', 'BUKLOD_ATTENDANCE', 'classroom-session:' || v_session.id::text,
    '100 raw points for verified time-in; 0 raw points when absent. The classroom grading policy converts the aggregate using the configured equivalent formula.',
    v_session.term_key
  )
  on conflict (classroom_id, source_system, source_ref)
    where source_system is not null and source_ref is not null
  do update set
    title = excluded.title,
    category = excluded.category,
    category_id = excluded.category_id,
    points_possible = 100,
    item_type = 'ATTENDANCE',
    term_key = excluded.term_key
  returning id into v_grade_item_id;

  insert into public.buklod_education_grades(
    classroom_id, grade_item_id, student_user_id, score, status, feedback, updated_by, updated_at
  )
  select
    v_session.classroom_id,
    v_grade_item_id,
    e.student_user_id,
    case when l.time_in is not null then 100::numeric else 0::numeric end,
    'RELEASED',
    case when l.time_in is not null
      then 'Verified BUKLOD Attendance time-in for ' || to_char(v_session.opened_at at time zone 'Asia/Manila', 'YYYY-MM-DD')
      else 'No verified BUKLOD Attendance time-in for ' || to_char(v_session.opened_at at time zone 'Asia/Manila', 'YYYY-MM-DD')
    end,
    auth.uid(),
    now()
  from public.buklod_education_enrollments e
  left join public.buklod_education_attendance_log l
    on l.session_id = v_session.id
   and l.student_user_id = e.student_user_id
  where e.classroom_id = v_session.classroom_id
    and e.status = 'ACTIVE'
  on conflict (grade_item_id, student_user_id)
  do update set
    score = excluded.score,
    status = 'RELEASED',
    feedback = excluded.feedback,
    updated_by = auth.uid(),
    updated_at = now()
  where public.buklod_education_grades.status <> 'LOCKED';

  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'session_id', v_session.id,
    'grade_item_id', v_grade_item_id,
    'term_key', v_session.term_key,
    'synced_students', v_rows
  );
end;
$$;

revoke all on function public.buklod_education_sync_attendance_session_to_gradebook_v1(uuid) from public;
grant execute on function public.buklod_education_sync_attendance_session_to_gradebook_v1(uuid) to authenticated;

create or replace function public.buklod_education_close_attendance_session_v2(
  p_session_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_classroom_id uuid;
  v_result jsonb;
begin
  select classroom_id into v_classroom_id
  from public.buklod_education_attendance_sessions
  where id = p_session_id;

  if v_classroom_id is null then raise exception 'Attendance session not found.'; end if;
  if not public.buklod_education_is_faculty_owner_v2(v_classroom_id) then
    raise exception 'Classroom not found or not authorized.';
  end if;

  update public.buklod_education_attendance_sessions
  set closed_at = coalesce(closed_at, now())
  where id = p_session_id;

  v_result := public.buklod_education_sync_attendance_session_to_gradebook_v1(p_session_id);
  return v_result || jsonb_build_object('closed', true);
end;
$$;

revoke all on function public.buklod_education_close_attendance_session_v2(uuid) from public;
grant execute on function public.buklod_education_close_attendance_session_v2(uuid) to authenticated;

drop function if exists public.buklod_classroom_student_attendance_v1(uuid);
create function public.buklod_classroom_student_attendance_v1(p_classroom_id uuid)
returns table(
  session_id uuid,
  opened_at timestamptz,
  closed_at timestamptz,
  term_key text,
  time_in timestamptz,
  time_out timestamptz,
  status text,
  verification jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,s.opened_at,s.closed_at,s.term_key,l.time_in,l.time_out,
         coalesce(l.status,'ABSENT'),coalesce(l.verification,'{}'::jsonb)
  from public.buklod_education_attendance_sessions s
  left join public.buklod_education_attendance_log l
    on l.session_id=s.id and l.student_user_id=auth.uid()
  where s.classroom_id=p_classroom_id
    and public.buklod_education_is_enrolled_for_classroom_v2(p_classroom_id)
  order by s.opened_at desc;
$$;

revoke all on function public.buklod_classroom_student_attendance_v1(uuid) from public;
grant execute on function public.buklod_classroom_student_attendance_v1(uuid) to authenticated;
