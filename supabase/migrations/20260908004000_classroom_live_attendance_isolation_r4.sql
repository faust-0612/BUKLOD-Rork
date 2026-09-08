create or replace function public.buklod_classroom_student_attendance_v1(p_classroom_id uuid)
returns table(session_id uuid, opened_at timestamptz, closed_at timestamptz, term_key text, time_in timestamptz, time_out timestamptz, status text, verification jsonb)
language sql
stable security definer
set search_path=''
as $$
  select s.id,s.opened_at,s.closed_at,s.term_key,l.time_in,l.time_out,
         coalesce(l.status,'ABSENT'),coalesce(l.verification,'{}'::jsonb)
  from public.buklod_education_attendance_sessions s
  left join public.buklod_education_attendance_log l
    on l.session_id=s.id and l.student_user_id=auth.uid()
  where s.classroom_id=p_classroom_id
    and coalesce((s.policy->>'proposal_only')::boolean,false)=false
    and public.buklod_education_is_enrolled_for_classroom_v2(p_classroom_id)
  order by s.opened_at desc;
$$;

create or replace function public.buklod_education_time_in_v1(p_session_id uuid)
returns uuid
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_uid uuid := auth.uid();
  v_log uuid;
begin
  if not exists (
    select 1
    from public.buklod_education_attendance_sessions s
    join public.buklod_education_enrollments e
      on e.classroom_id = s.classroom_id
    where s.id = p_session_id
      and s.closed_at is null
      and coalesce((s.policy->>'proposal_only')::boolean,false)=false
      and e.student_user_id = v_uid
      and e.status = 'ACTIVE'
  ) then
    raise exception 'Attendance session is not available for this student.';
  end if;

  insert into public.buklod_education_attendance_log(
    session_id,student_user_id,time_in,status,verification
  )
  values(
    p_session_id,v_uid,now(),'PRESENT',
    jsonb_build_object('source','BUKLOD_CLASSROOM','server_time',true)
  )
  on conflict (session_id, student_user_id)
  do update set
    time_in = coalesce(public.buklod_education_attendance_log.time_in, excluded.time_in)
  returning id into v_log;

  return v_log;
end;
$$;

create or replace function public.buklod_education_sync_attendance_session_to_gradebook_v1(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
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
  if coalesce((v_session.policy->>'proposal_only')::boolean,false) then
    raise exception 'Live Classroom attendance requires faculty Live Review finalization before gradebook sync.';
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

create or replace function public.buklod_classroom_finalize_live_attendance_v1(p_live_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid:=auth.uid();
  v_attendance_session_id uuid;
  v_classroom_id uuid;
  v_total integer;
  v_pending integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select s.attendance_session_id,s.classroom_id
    into v_attendance_session_id,v_classroom_id
  from public.buklod_education_classroom_live_sessions s
  join public.buklod_education_classrooms c on c.id=s.classroom_id
  where s.id=p_live_session_id and c.faculty_user_id=v_uid;

  if not found then raise exception 'Faculty access required'; end if;
  if v_attendance_session_id is null then raise exception 'This live class has no linked attendance session'; end if;

  select count(*), count(*) filter (where p.review_status <> 'APPROVED')
    into v_total,v_pending
  from public.buklod_education_classroom_live_attendance_proposals p
  where p.live_session_id=p_live_session_id;

  if v_total=0 then raise exception 'No live attendance proposals exist for this session'; end if;
  if v_pending>0 then raise exception 'Review all attendance proposals before finalizing'; end if;

  update public.buklod_education_attendance_sessions
  set policy = coalesce(policy,'{}'::jsonb) || jsonb_build_object(
    'proposal_only',false,
    'review_finalized',true,
    'review_finalized_by',v_uid,
    'review_finalized_at',now()
  )
  where id=v_attendance_session_id;

  return public.buklod_education_sync_attendance_session_to_gradebook_v1(v_attendance_session_id);
end;
$$;

grant execute on function public.buklod_classroom_student_attendance_v1(uuid) to authenticated;
grant execute on function public.buklod_education_time_in_v1(uuid) to authenticated;
grant execute on function public.buklod_education_sync_attendance_session_to_gradebook_v1(uuid) to authenticated;
grant execute on function public.buklod_classroom_finalize_live_attendance_v1(uuid) to authenticated;
